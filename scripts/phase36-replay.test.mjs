import assert from 'node:assert/strict';
import test from 'node:test';
import { hashObservation } from '../src/game/agent/log.ts';
import { replayDecisions } from './phase36-replay.mjs';

function fixture({ food = false, count = 2, pick = 0, raw } = {}) {
  const candidate = { verb: 'chop', label: 'Chop', target: { kind: 'tile', id: '12,7', tx: 12, ty: 7, label: 'tree' } };
  const observation = {
    tick: 7, hour: 10, isNight: false, weather: { kind: 'clear', cloud: 0, wet: 0, wind: 0 },
    you: { id: 'you', name: 'You', x: 0, z: 0, hp: 30, maxHp: 30, hunger: 60, energy: 90,
      ghost: false, mana: 10, notoriety: 'innocent', skills: {}, pack: { gold: 0, ...(food ? { bread: 1 } : {}) }, wear: {}, vault: 0 },
    people: [], fauna: [], piles: [], buildings: [], plots: [], herbs: [],
    verbs: [{ ...candidate, verb: 'talk' }, ...Array.from({ length: count }, () => structuredClone(candidate))],
    logTail: Array.from({ length: 15 }, (_, i) => `line ${i}`),
  };
  const n = Math.min(count, 253);
  const options = Array.from({ length: n }, (_, i) => `Chop [12,7]${i ? ` (#${i + 1})` : ''}`);
  if (food) options.push('Eat Bread from pack');
  options.push('Rest / remain idle');
  const weights = raw ?? options.map((_, i) => i === pick ? 1 : 0);
  const probabilities = weights.every(v => v <= 0) ? weights.map(() => 1 / weights.length) : weights;
  const idle = pick === options.length - 1;
  const eat = food && pick === n;
  const row = { tick: 7, bodyId: 'you', lane: 'reflex', question: 'What now?', candidates: options,
    answer: options[pick], intent: eat ? null : { kind: idle ? 'none' : 'chop', tx: idle ? 0 : 12, ty: idle ? 0 : 7, targetId: null, spell: null },
    verb: eat ? 'eat' : null, stateHash: hashObservation(observation), outcome: null };
  return { calls: [{ id: 'a1', status: 'ok' }], decisions: [{ attemptId: 'a1', observation, row,
    exchange: { state: { observation: { ...structuredClone(observation), verbs: [], logTail: observation.logTail.slice(-10), you: { ...structuredClone(observation.you), pack: food ? { bread: 1 } : {} } }, triggers: [{ kind: 'heartbeat' }], candidateVerbs: [...Array(n).fill('chop'), ...(food ? ['eat'] : []), 'idle'] }, questions: [{ type: 'choice', id: 'next_action', question: 'What now?', options: [...options] }] },
    raw: { next_action: weights }, answers: [{ id: 'next_action', type: 'choice', probabilities, pick }] }] };
}

for (const [name, opts] of Object.entries({ ordinary: {}, rest: { pick: 2 }, food: { food: true, pick: 2 }, cap: { count: 260, food: true, pick: 254 }, uniform: { raw: [0, -1, 0] }, tie: { raw: [0.5, 0.5, 0] } })) {
  test(`accepts independent ${name} fixture without mutation`, () => {
    const e = fixture(opts), before = structuredClone(e);
    assert.deepEqual(replayDecisions(e), { pass: true, checked: 1, mismatches: [], paidCallsIssued: 0 });
    assert.deepEqual(e, before);
  });
}
test('normalizes positive weights, non-finite values and negative entries independently', () => {
  for (const [raw, probabilities, pick] of [
    [[2, 6, -4], [0.25, 0.75, 0], 1],
    [[NaN, Infinity, -2], [1 / 3, 1 / 3, 1 / 3], 0],
    [[4, 4, 0], [0.5, 0.5, 0], 0],
  ]) {
    const e = fixture({ pick });
    e.decisions[0].raw.next_action = raw;
    e.decisions[0].answers[0].probabilities = probabilities;
    assert.equal(replayDecisions(e).pass, true);
  }
});
test('food-only choice and no-food capped menu replay', () => {
  assert.equal(replayDecisions(fixture({ count: 0, food: true })).pass, true);
  assert.equal(replayDecisions(fixture({ count: 260, pick: 253 })).pass, true);
  assert.equal(replayDecisions(fixture({ count: 0 })).pass, false);
});
test('counts each linked decision, ignores unsuccessful calls without decisions', () => {
  const e = fixture(), other = fixture({ pick: 2 }).decisions[0];
  other.attemptId = 'a2';
  e.calls.push({ id: 'a2', status: 'ok' }, { id: 'a3', status: 'error' });
  e.decisions.push(other);
  assert.deepEqual(replayDecisions(e), { pass: true, checked: 2, mismatches: [], paidCallsIssued: 0 });
});
const mutations = {
  candidates: d => { d.row.candidates = ['forged']; },
  answer: d => { d.row.answer = 'forged'; },
  intent: d => { d.row.intent.tx++; },
  verb: d => { d.row.verb = 'eat'; },
  hash: d => { d.row.stateHash = 'deadbeef'; },
  tick: d => { d.row.tick++; },
  body: d => { d.row.bodyId = 'other'; },
  lane: d => { d.row.lane = 'mind'; },
  question: d => { d.row.question = 'Why?'; },
  outcome: d => { d.row.outcome = { submitRejected: 1 }; },
  wire: d => { d.exchange.state.observation.you.hp++; },
  wireMenu: d => { d.exchange.state.observation.verbs = d.observation.verbs; },
  wirePack: d => { d.exchange.state.observation.you.pack.gold = 0; },
  wireLogs: d => { d.exchange.state.observation.logTail = []; },
  wireVerbs: d => { d.exchange.state.candidateVerbs.reverse(); },
  wireQuestion: d => { d.exchange.questions[0].options = ['forged']; },
  raw: d => { d.raw.next_action = [0, 1, 0]; },
  missingRaw: d => { delete d.raw; },
  rawLength: d => { d.raw.next_action = [1]; },
  rawType: d => { d.raw.next_action[0] = '1'; },
  normalized: d => { d.answers[0].probabilities = [0.9, 0.1, 0]; },
  pick: d => { d.answers[0].pick = 1; },
  extraAnswer: d => { d.answers.push(structuredClone(d.answers[0])); },
  missingObservation: d => { delete d.observation; },
  incompleteObservation: d => { delete d.observation.people; },
  incompleteBody: d => { delete d.observation.you.hp; },
};
for (const [name, mutate] of Object.entries(mutations)) test(`rejects ${name} mutation`, () => {
  const e = fixture(); mutate(e.decisions[0]);
  const result = replayDecisions(e);
  assert.equal(result.pass, false); assert.ok(result.mismatches.length); assert.equal(result.paidCallsIssued, 0);
});
for (const [name, mutate] of Object.entries({
  duplicateDecision: e => e.decisions.push(structuredClone(e.decisions[0])),
  orphanDecision: e => { e.decisions[0].attemptId = 'orphan'; },
  missingDecision: e => { e.decisions = []; },
  duplicateCall: e => e.calls.push(structuredClone(e.calls[0])),
  failedCall: e => { e.calls[0].status = 'error'; },
})) test(`rejects ${name}`, () => {
  const e = fixture(); mutate(e); assert.equal(replayDecisions(e).pass, false);
});
for (const e of [null, {}, { calls: [null], decisions: [null] }, { calls: [], decisions: [42] }]) test('malformed evidence fails closed without throwing', () => {
  assert.equal(replayDecisions(e).pass, false);
});
