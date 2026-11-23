import test from 'node:test';
import assert from 'node:assert/strict';
import { replayPolicy } from './phase36-policy-replay.mjs';
import { DEFAULT_SCHEDULER_CONFIG } from '../src/game/agent/scheduler.ts';
import { hashObservation } from '../src/game/agent/log.ts';
import { surfaceDigest } from '../src/game/agent/events.ts';

export function policyFixture() {
  const observation = { tick: 1, hour: 8, isNight: false, weather: { kind: 'clear', cloud: 0, wet: 0, wind: 0 },
    you: { id: 'body', name: 'Test', x: 0, z: 0, hp: 40, maxHp: 40, hunger: 80, energy: 80, ghost: false, mana: 10, notoriety: 'innocent', skills: {}, pack: {}, wear: {}, vault: 0 },
    verbs: [{ verb: 'walk', label: 'Walk', target: { kind: 'tile', id: 'tile:1,1', label: 'Grass', tx: 1, ty: 1 } }],
    people: [], fauna: [], piles: [], buildings: [], plots: [], herbs: [], logTail: [] };
  const triggers = [{ kind: 'boot', survival: false, detail: 'autopilot engaged' }];
  const context = { attemptId: 1, tick: 1, bodyId: 'body', triggers, stateHash: hashObservation(observation), surfaceDigest: surfaceDigest(observation) };
  const exchange = { state: { observation: { ...observation, verbs: [] }, triggers, candidateVerbs: ['walk', 'idle'] }, questions: [{ type: 'choice', id: 'next_action', question: 'What now?', options: ['Walk [1,1]', 'Rest / remain idle'] }] };
  const answers = [{ id: 'next_action', type: 'choice', probabilities: [1, 0], pick: 0 }];
  const action = { type: 'intent', intent: { kind: 'walk', tx: 1, ty: 1, targetId: null, spell: null } };
  const row = { tick: 1, bodyId: 'body', lane: 'reflex', question: 'What now?', candidates: exchange.questions[0].options, answer: 'Walk [1,1]', intent: action.intent, verb: null, stateHash: context.stateHash, outcome: null };
  return { policy: { config: { ...structuredClone(DEFAULT_SCHEDULER_CONFIG), riskGated: false } }, calls: [{ id: 'a', status: 'ok' }], decisions: [{ attemptId: 'a', observation, exchange, answers, raw: { next_action: [1, 0] }, row }],
    trace: [ { type: 'observation', observation }, { type: 'request', attemptId: 'a', exchange, context }, { type: 'response', attemptId: 'a', answers }, { type: 'submit', attemptId: 'a', action }, { type: 'ack', attemptId: 'a', rejection: null }, { type: 'decision', attemptId: 'a', row }, { type: 'stop' } ].map((r, seq) => ({ ...r, seq, wallMs: seq })) };
}

test('replays policy from observations and async order without network calls', async () => {
  const r = await replayPolicy(policyFixture());
  assert.equal(r.pass, true, JSON.stringify(r.mismatches)); assert.equal(r.paidCallsIssued, 0); assert.equal(r.requests, 1);
});
for (const [name, mutate] of [
  ['policy quiet window', e => e.policy.config.cadence.sleepEndHour = 12],
  ['observation', e => e.trace[0].observation.you.hp = 3],
  ['request', e => e.trace[1].exchange.questions[0].question = 'corrupt'],
  ['submit', e => e.trace[3].action.intent.tx = 99],
  ['decision', e => e.trace[5].row.answer = 'wrong'],
  ['response', e => e.trace[2].answers[0].pick = 1],
  ['missing stop', e => e.trace.pop()],
  ['missing request', e => e.trace.splice(1, 1)],
  ['missing config', e => delete e.policy],
  ['missing trace', e => delete e.trace],
  ['sequence', e => e.trace[2].seq = 9],
  ['orphan call', e => e.calls.push({ id: 'b', status: 'ok' })],
]) test(`policy replay detects ${name}`, async () => {
  const e = JSON.parse(JSON.stringify(policyFixture())); mutate(e);
  const r = await replayPolicy(e); assert.equal(r.pass, false, name);
});
