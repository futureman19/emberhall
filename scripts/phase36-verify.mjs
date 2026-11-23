import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { verifyEvidence } from './phase36-evidence.mjs';
import { replayDecisions } from './phase36-replay.mjs';
import { replayPolicy } from './phase36-policy-replay.mjs';
import { DEFAULT_SCHEDULER_CONFIG } from '../src/game/agent/scheduler.ts';

/** Fixed source list, never log-selected modules. Risk is absent on the legacy baseline. */
export function policyFingerprint() {
  const paths = ['autopilot.ts', 'scheduler.ts', 'events.ts', 'types.ts', 'log.ts', 'reflex.ts', 'risk.ts'];
  const files = paths.map(p => new URL(`../src/game/agent/${p}`, import.meta.url));
  for (const p of ['player.ts', 'catalog.ts', 'forestry.ts']) files.push(new URL(`../src/game/${p}`, import.meta.url));
  const hashes = {};
  for (const file of files) hashes[file.pathname.split('/src/')[1]] = existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : null;
  return hashes;
}

export function verifyCoverage(e) {
  const problems = [];
  const trace = Array.isArray(e?.trace) ? e.trace : [];
  const samples = Array.isArray(e?.samples) ? e.samples : [];
  const observations = trace.filter(r => r?.type === 'observation');
  const enabled = Array.isArray(e?.segments) ? e.segments.filter(s => s?.mode === 'enabled') : [];
  const segment = enabled[0];
  if (enabled.length !== 1 || !observations.length || observations.length !== samples.length) problems.push('observation/sample coverage incomplete');
  if (!observations.some(r => r.observation?.isNight === true) || !observations.some(r => r.observation?.isNight === false)) problems.push('day/night observation coverage missing');
  for (const [i, r] of observations.entries()) {
    const o = r.observation, s = samples[i];
    if (!s || r.wallMs !== s.wallMs || o?.tick !== s.tick || o?.hour !== s.hour ||
        !o?.you || o.you.id !== e.bodyId || ['hp', 'ghost', 'hunger', 'energy'].some(k => o.you[k] !== s[k])) problems.push(`observation ${i}: sample mismatch`);
    if (!(o?.you?.hp > 0) || o?.you?.ghost !== false) problems.push(`observation ${i}: death/missing vitals`);
    if (!segment || r.wallMs < segment.startMs || r.wallMs > segment.endMs) problems.push(`observation ${i}: outside enabled interval`);
  }
  if (!segment || observations[0]?.wallMs !== segment.startMs || observations.at(-1)?.wallMs !== segment.endMs) problems.push('enabled boundaries differ from observations');
  const stops = trace.filter(r => r?.type === 'stop');
  if (stops.length !== 1 || stops[0] !== trace.at(-1) || stops[0]?.wallMs !== segment?.endMs) problems.push('stop boundary differs from enabled end');
  for (const r of trace) {
    if (!r || !Number.isFinite(r.wallMs) || !segment || r.wallMs < segment.startMs || r.wallMs > segment.endMs) problems.push('trace outside enabled interval');
  }
  for (const c of Array.isArray(e?.calls) ? e.calls : []) {
    const request = trace.filter(r => r?.type === 'request' && r.attemptId === c?.id);
    const response = trace.filter(r => r?.type === 'response' && r.attemptId === c?.id);
    // Metering starts/ends inside these harness boundaries; it must not predate
    // backend entry or outlive the response handed back to the scheduler.
    if (request.length !== 1 || response.length !== 1 || c.startMs < request[0].wallMs || c.endMs > response[0].wallMs || c.startMs > c.endMs) problems.push(`call ${c?.id}: trace timing mismatch`);
  }
  return problems;
}

export async function verifyRun(e) {
  const accounting = verifyEvidence(e);
  const decisions = replayDecisions(e);
  const policy = await replayPolicy(e);
  const problems = [];
  if (e?.policy?.version !== 'phase36-risk-v1') problems.push('Phase 3.6 policy version missing');
  if (DEFAULT_SCHEDULER_CONFIG.riskGated !== true || !isDeepStrictEqual(e?.policy?.config, DEFAULT_SCHEDULER_CONFIG)) problems.push('effective configuration differs from committed Phase 3.6 defaults');
  if (!isDeepStrictEqual(e?.policy?.sourceHashes, policyFingerprint())) problems.push('policy source fingerprint mismatch');
  if (!(e?.maxSampleGapMs > 0 && e.maxSampleGapMs <= 2000)) problems.push('live sampling gap must be <=2000ms');
  problems.push(...verifyCoverage(e));
  const passed = accounting.accountingPass && decisions.pass && policy.pass && problems.length === 0;
  return { schema: 'emberhall-phase36-verdict-v1', pass: passed, accounting, decisions, policy, problems,
    acceptance: passed ? 'PASS_RECORDED_EVIDENCE' : 'FAIL_OR_INCOMPLETE',
    caveat: 'Independent offline verification of recorded inputs, not an invoice audit or proof against omitted host actions. Human review of fresh-agent provenance and raw host logs remains required.' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--fingerprint') console.log(JSON.stringify({ version: 'phase36-risk-v1', config: DEFAULT_SCHEDULER_CONFIG, sourceHashes: policyFingerprint() }, null, 2));
  else {
    try {
      if (!process.argv[2]) throw new Error('input required');
      const result = await verifyRun(JSON.parse(readFileSync(process.argv[2], 'utf8')));
      console.log(JSON.stringify(result, null, 2)); process.exitCode = result.pass ? 0 : 1;
    } catch {
      // Never print raw parse errors/input: malformed evidence can contain credentials.
      console.log(JSON.stringify({ pass: false, acceptance: 'FAIL_OR_INCOMPLETE', problems: ['Invalid evidence file. See docs/phase-3.6-evidence.md; raw content not printed.'] }));
      process.exitCode = 2;
    }
  }
}
