/** Offline accounting; no network clients and no report.json summary claims. */
const finite = n => typeof n === 'number' && Number.isFinite(n);
const amount = n => Number.isSafeInteger(n) && n >= 0;
const utc = ms => new Date(ms).toISOString().slice(0, 10);
export function projectEconomics(costMicros, enabledWallMs, valeHours) {
  if (!amount(costMicros) || !finite(enabledWallMs) || enabledWallMs <= 0 || !finite(valeHours) || valeHours <= 0) throw new RangeError('invalid projection inputs');
  const usdPerAgentWallDay = costMicros / 1000000 * 86400000 / enabledWallMs;
  return { observedUsd: costMicros / 1000000, usdPerAgentWallDay,
    usdPerValeDay: costMicros / 1000000 * 24 / valeHours,
    valeDaysPerWallDay: valeHours / 24 * 86400000 / enabledWallMs,
    thresholdUsd: 0.10, thresholdPass: usdPerAgentWallDay <= 0.10,
    basis: 'provider usage at recorded tariff; sustained enabled-time projection, NOT a measured 24h bill' };
}
export function verifyEvidence(e) {
  const problems = [];
  const check = (ok, message) => { if (!ok) problems.push(message); };
  check(e?.schema === 'emberhall-phase36-v1', 'schema missing/unsupported');
  check(typeof e?.agentId === 'string' && e.agentId.length > 0 && typeof e?.bodyId === 'string', 'agent/body identity missing');
  const lists = {};
  for (const key of ['segments', 'samples', 'calls', 'decisions', 'rejections', 'interventions']) {
    check(Array.isArray(e?.[key]), `${key} missing`);
    const values = Array.isArray(e?.[key]) ? e[key] : [];
    check(values.every(v => v !== null && typeof v === 'object' && !Array.isArray(v)), `${key}: malformed row`);
    lists[key] = values.filter(v => v !== null && typeof v === 'object' && !Array.isArray(v));
  }
  const { segments, samples, calls, decisions } = lists;
  check(e?.reason === 'full-vale-day', 'run not completed full vale day');
  check(e?.rejections?.length === 0, 'rejections present/unknown');
  check(e?.interventions?.length === 0, 'interventions present/unknown');
  check(finite(e?.maxSampleGapMs) && e.maxSampleGapMs > 0, 'sample cadence missing');
  check(samples.length >= 2 && segments.length > 0, 'insufficient duration evidence');
  let enabledWallMs = 0, valeHours = 0, excludedWallMs = 0, lastEnd = null;
  const enabled = [];
  for (const [i, s] of segments.entries()) {
    const valid = [s.startMs, s.endMs, s.startHour, s.endHour].every(finite) && s.endMs > s.startMs && s.endHour >= s.startHour;
    check(valid, `segment ${i}: invalid time`);
    check(lastEnd === null || s.startMs === lastEnd, `segment ${i}: gap/overlap`); lastEnd = s.endMs;
    check(['enabled', 'stopped', 'budget-blocked', 'disconnected'].includes(s.mode), `segment ${i}: unknown mode`);
    if (!valid) continue;
    if (s.mode === 'enabled') { enabledWallMs += s.endMs - s.startMs; valeHours += s.endHour - s.startHour; enabled.push(s); }
    else { excludedWallMs += s.endMs - s.startMs; if (s.mode !== 'stopped') check(false, `segment ${i}: ${s.mode} is not idle savings`); }
  }
  check(enabled.length === 1 && segments[0]?.mode === 'enabled', 'proof must be one uninterrupted enabled interval, with optional stopped tail');
  check(valeHours >= 24, 'less than one enabled vale day');
  for (const s of enabled) {
    const within = samples.filter(x => x.wallMs >= s.startMs && x.wallMs <= s.endMs);
    check(within[0]?.wallMs === s.startMs && within.at(-1)?.wallMs === s.endMs, 'enabled segment missing boundary samples');
    check(within[0]?.hour === s.startHour && within.at(-1)?.hour === s.endHour, 'segment/sample vale time mismatch');
  }
  let costMicros = 0, promptTokens = 0, completionTokens = 0, paidCalls = 0;
  const byStatus = {}, byUtcDay = {}, ids = new Set();
  for (const c of calls) {
    check(typeof c.id === 'string' && !ids.has(c.id), 'duplicate/missing call id'); ids.add(c.id);
    check(c.agentId === e.agentId, `call ${c.id}: wrong agent`);
    check(finite(c.startMs) && finite(c.endMs) && c.endMs >= c.startMs, `call ${c.id}: incomplete timing`);
    check(enabled.some(s => c.startMs >= s.startMs && c.endMs <= s.endMs), `call ${c.id}: outside enabled window`);
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    if (c.status !== 'blocked') paidCalls++;
    check(c.status === 'ok', `call ${c.id}: ${c.status}`);
    const p = c.price, u = c.usage;
    const validPrice = p?.currency === 'USD' && finite(p.promptPerMTok) && p.promptPerMTok >= 0 && finite(p.completionPerMTok) && p.completionPerMTok >= 0 && typeof p.source === 'string' && p.source.length > 0 && typeof p.capturedAt === 'string' && p.model === c.model;
    const validUsage = amount(u?.promptTokens) && amount(u?.completionTokens);
    check(validPrice && validUsage && c.costBasis === 'reported', `call ${c.id}: usage/tariff incomplete or estimated`);
    check(amount(c.costMicros), `call ${c.id}: invalid cost`);
    if (validPrice && validUsage) {
      const computed = Math.ceil(u.promptTokens * p.promptPerMTok + u.completionTokens * p.completionPerMTok);
      check(amount(computed) && c.costMicros === computed, `call ${c.id}: cost mismatch`);
      costMicros += computed; promptTokens += u.promptTokens; completionTokens += u.completionTokens;
      if (finite(c.startMs)) { const day = utc(c.startMs); byUtcDay[day] = (byUtcDay[day] ?? 0) + computed; }
    }
    check(decisions.filter(d => d.attemptId === c.id).length === 1, `call ${c.id}: missing/duplicate decision`);
  }
  for (const d of decisions) check(ids.has(d.attemptId), 'orphan decision');
  check(paidCalls > 0, 'no paid calls: live provider proof absent');
  for (const [day, spend] of Object.entries(byUtcDay)) check(spend <= 500000, `${day}: UTC budget exceeded`);
  let previous = null;
  for (const s of samples) {
    check([s.wallMs, s.hour, s.tick, s.hp, s.hunger, s.energy].every(finite) && typeof s.ghost === 'boolean', 'invalid survival sample');
    check(s.hp > 0 && s.ghost === false, 'death observed');
    if (previous) {
      check(s.wallMs > previous.wallMs && s.wallMs - previous.wallMs <= e.maxSampleGapMs, 'sample gap/nonmonotonic wall clock');
      check(s.tick > previous.tick && s.hour >= previous.hour, 'nonmonotonic simulation');
    }
    previous = s;
    const g = s.guard;
    check(g?.capMicros === 500000 && g.exhausted === false && amount(g.spentMicros) && amount(g.reservedMicros) && g.spentMicros + g.reservedMicros <= 500000, 'guard missing/closed/changed');
    if (finite(s.wallMs)) {
      check(s.utcDay === utc(s.wallMs), 'guard UTC day mismatch');
      const settled = calls.filter(c => finite(c.endMs) && c.endMs <= s.wallMs && finite(c.startMs) && utc(c.startMs) === s.utcDay).reduce((n, c) => n + (amount(c.costMicros) ? c.costMicros : 0), 0);
      check(g?.spentMicros === settled, 'guard spend mismatch (fresh-agent proof required)');
    }
  }
  let economics = null;
  try { economics = projectEconomics(costMicros, enabledWallMs, valeHours); } catch { check(false, 'projection unavailable'); }
  check(economics?.thresholdPass === true, 'wall-day projection exceeds $0.10 or unavailable');
  return { accountingPass: problems.length === 0, liveAcceptance: false, problems, enabledWallMs, excludedWallMs, valeHours,
    paidCalls, byStatus, promptTokens, completionTokens, costMicros, byUtcDay, economics,
    survival: { samples: samples.length, minHp: samples.length ? Math.min(...samples.map(s => s.hp)) : null,
      minHunger: samples.length ? Math.min(...samples.map(s => s.hunger)) : null,
      minEnergy: samples.length ? Math.min(...samples.map(s => s.energy)) : null },
    rejections: e?.rejections?.length ?? null, interventions: e?.interventions?.length ?? null,
    caveat: 'Accounting alone cannot establish replay, unlogged interventions, provider invoices or host truth.' };
}
