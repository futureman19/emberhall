/** Offline decision replay. No autopilot execution, backend, clock or submission.
 * Only the domain intent mapper, food priority, catalog and state hash are shared.
 * Triggers are scheduler-owned input, not re-derived here. Outcome must be null:
 * rejection/backfilled deltas cannot be independently proven by this envelope.
 */
import { isDeepStrictEqual } from 'node:util';
import { intentForCandidate } from '../src/game/agent/autopilot.ts';
import { bestFoodInPack } from '../src/game/player.ts';
import { ITEM_META } from '../src/game/catalog.ts';
import { hashObservation } from '../src/game/agent/log.ts';

const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const finite = x => typeof x === 'number' && Number.isFinite(x);
const text = x => typeof x === 'string';
const id = x => text(x) && x.length > 0;
function requireFullObservation(o) {
  const y = o?.you;
  if (!record(o) || !finite(o.tick) || !finite(o.hour) || typeof o.isNight !== 'boolean' ||
      !record(o.weather) || !text(o.weather.kind) || !['cloud', 'wet', 'wind'].every(k => finite(o.weather[k])) ||
      !record(y) || !id(y.id) || !text(y.name) || !text(y.notoriety) || typeof y.ghost !== 'boolean' ||
      !['x', 'z', 'hp', 'maxHp', 'hunger', 'energy', 'mana', 'vault'].every(k => finite(y[k])) ||
      !['skills', 'pack', 'wear'].every(k => record(y[k])) ||
      !Object.values(y.pack).every(finite) || !Object.values(y.skills).every(finite) ||
      !Object.values(y.wear).every(text) ||
      !['people', 'fauna', 'piles', 'buildings', 'plots', 'herbs', 'verbs', 'logTail'].every(k => Array.isArray(o[k])) ||
      !o.logTail.every(text)) throw new Error('missing/malformed full authoritative observation');
  for (const c of o.verbs) {
    if (!record(c) || !text(c.verb) || !text(c.label) || !record(c.target) ||
        !text(c.target.id) || !text(c.target.kind) || !text(c.target.label) ||
        !finite(c.target.tx) || !finite(c.target.ty)) throw new Error('malformed observation candidate');
  }
}

function reconstruct(o) {
  requireFullObservation(o);
  const options = [], actions = [], verbs = [];
  for (const c of o.verbs) {
    const intent = intentForCandidate(c, o);
    if (intent === null) continue;
    const label = `${c.label} [${c.target.tx},${c.target.ty}]`;
    options.push(options.includes(label) ? `${label} (#${options.length + 1})` : label);
    actions.push({ intent, verb: null });
    verbs.push(c.verb);
    if (options.length === 253) break;
  }
  const food = bestFoodInPack(o.you.pack);
  if (food !== null && options.length < 255) {
    options.push(`Eat ${ITEM_META[food]?.label ?? food} from pack`);
    actions.push({ intent: null, verb: 'eat' });
    verbs.push('eat');
  }
  if (options.length < 255) {
    options.push('Rest / remain idle');
    actions.push({ intent: { kind: 'none', tx: 0, ty: 0, targetId: null, spell: null }, verb: null });
    verbs.push('idle');
  }
  if (options.length < 2) throw new Error('observation cannot prepare a paid choice');
  const pack = Object.fromEntries(Object.entries(o.you.pack).filter(([, n]) => typeof n === 'number' && n > 0));
  const wire = { ...o, verbs: [], logTail: o.logTail.slice(-10), you: { ...o.you, pack } };
  return { options, actions, verbs, wire };
}

export function replayDecisions(e) {
  const mismatches = [];
  let checked = 0;
  const fail = message => mismatches.push(message);
  const compare = (actual, expected, label) => { if (!isDeepStrictEqual(actual, expected)) fail(label); };
  if (!Array.isArray(e?.calls)) fail('calls missing/malformed');
  if (!Array.isArray(e?.decisions)) fail('decisions missing/malformed');
  const calls = Array.isArray(e?.calls) ? e.calls : [];
  const decisions = Array.isArray(e?.decisions) ? e.decisions : [];
  const byId = new Map(), linked = new Map();
  for (const c of calls) {
    if (!record(c) || !id(c.id) || !text(c.status)) { fail('call missing/malformed id/status'); continue; }
    if (byId.has(c.id)) fail(`call ${c.id}: duplicate id`);
    byId.set(c.id, c);
  }
  for (const d of decisions) {
    checked++;
    const name = `decision ${checked} (${d?.attemptId ?? '?'})`;
    if (!record(d) || !id(d.attemptId)) { fail(`${name}: missing/malformed attemptId`); continue; }
    linked.set(d.attemptId, (linked.get(d.attemptId) ?? 0) + 1);
    const call = byId.get(d.attemptId);
    if (!call || call.status !== 'ok') fail(`${name}: orphan (no successful call)`);
    try {
      const { options, actions, verbs, wire } = reconstruct(d.observation);
      const weights = d.raw?.next_action;
      if (!record(d.raw) || !Array.isArray(weights) || weights.length !== options.length ||
          Array.from(weights).some(p => typeof p !== 'number')) throw new Error('raw next_action missing/malformed');
      const clean = weights.map(p => Number.isFinite(p) && p > 0 ? p : 0);
      const total = clean.reduce((a, b) => a + b, 0);
      const probabilities = clean.map(p => total <= 0 ? 1 / clean.length : p / total);
      let pick = 0;
      for (let i = 1; i < probabilities.length; i++) if (probabilities[i] > probabilities[pick]) pick = i;
      compare(d.answers, [{ id: 'next_action', type: 'choice', probabilities, pick }], `${name}: normalized answers`);
      const expectedRow = { tick: d.observation.tick, bodyId: d.observation.you.id, lane: 'reflex',
        question: 'What now?', candidates: options, answer: options[pick], ...actions[pick],
        stateHash: hashObservation(d.observation), outcome: null };
      for (const [key, value] of Object.entries(expectedRow)) compare(d.row?.[key], value, `${name}: row.${key}`);
      if (!record(d.row) || Object.keys(d.row).some(k => !(k in expectedRow))) fail(`${name}: unknown/malformed row fields`);
      const triggers = d.exchange?.state?.triggers;
      if (!Array.isArray(triggers) || triggers.some(t => !record(t) || !id(t.kind))) fail(`${name}: malformed wire triggers`);
      compare(d.exchange, { state: { observation: wire, triggers, candidateVerbs: verbs },
        questions: [{ type: 'choice', id: 'next_action', question: 'What now?', options }] }, `${name}: input wire exchange`);
      // If retained in the call evidence, check the independently linked inputs too.
      if (call?.triggers !== undefined) compare(triggers, call.triggers, `${name}: call triggers`);
      if (call?.stateHash !== undefined) compare(expectedRow.stateHash, call.stateHash, `${name}: call stateHash`);
    } catch (error) { fail(`${name}: ${error instanceof Error ? error.message : 'malformed input'}`); }
  }
  for (const [key, count] of linked) if (count !== 1) fail(`decision ${key}: duplicate linkage (${count})`);
  for (const c of byId.values()) if (c.status === 'ok' && linked.get(c.id) !== 1) fail(`call ${c.id}: missing/duplicate decision`);
  return { pass: mismatches.length === 0, checked, mismatches, paidCallsIssued: 0 };
}
