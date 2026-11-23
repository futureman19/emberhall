import test from 'node:test';
import assert from 'node:assert/strict';
import { projectEconomics, verifyEvidence } from './phase36-evidence.mjs';

export function fixture() {
  return {
    schema: 'emberhall-phase36-v1', agentId: 'test-agent', bodyId: 'body',
    policy: { version: 'test', config: {} },
    segments: [{ startMs: 0, endMs: 864000, startHour: 8, endHour: 32, mode: 'enabled' }],
    samples: [0, 216000, 432000, 648000, 864000].map((wallMs, i) => ({ wallMs, hour: 8 + i * 6, tick: i, hp: 40, ghost: false, hunger: 80 - i, energy: 90 - i, guard: { capMicros: 500000, spentMicros: i ? 1000 : 0, reservedMicros: 0, exhausted: false }, utcDay: '1970-01-01' })),
    maxSampleGapMs: 216000, calls: [{ id: 'a', agentId: 'test-agent', startMs: 100, endMs: 200, status: 'ok', usage: { promptTokens: 1000, completionTokens: 20 }, price: { model: 'test', currency: 'USD', promptPerMTok: 1, completionPerMTok: 0, source: 'test rate', capturedAt: '1970-01-01' }, model: 'test', costMicros: 1000, costBasis: 'reported' }],
    decisions: [{ attemptId: 'a' }], rejections: [], interventions: [], reason: 'full-vale-day',
  };
}

test('refuses shutdown/restart seams and malformed null rows', () => {
  const f = fixture();
  f.segments = [
    { startMs: 0, endMs: 432000, startHour: 8, endHour: 20, mode: 'enabled' },
    { startMs: 432000, endMs: 648000, startHour: 20, endHour: 26, mode: 'stopped' },
    { startMs: 648000, endMs: 864000, startHour: 26, endHour: 50, mode: 'enabled' },
  ];
  f.samples[4].hour = 50;
  assert.equal(verifyEvidence(f).accountingPass, false);
  for (const key of ['calls', 'samples', 'segments', 'decisions']) {
    const invalid = fixture(); invalid[key] = [null];
    assert.equal(verifyEvidence(invalid).accountingPass, false);
  }
});

test('wall-day units use measured enabled time, not a vale-day multiplier', () => {
  const r = projectEconomics(1000, 864000, 24);
  assert.equal(r.usdPerAgentWallDay, 0.1);
  assert.equal(r.usdPerValeDay, 0.001);
  assert.equal(r.valeDaysPerWallDay, 100);
  assert.equal(r.thresholdPass, true);
  assert.equal(projectEconomics(1001, 864000, 24).thresholdPass, false);
  assert.ok(Math.abs(projectEconomics(12607, 954804, 24.00277777777131).usdPerAgentWallDay - 1.140804604924152) < 1e-12);
});

test('reject invalid projection denominators and noninteger costs', () => {
  for (const args of [[1, 0, 24], [1, -1, 24], [1, Infinity, 24], [1, 10, 0], [-1, 10, 24], [0.5, 10, 24]]) assert.throws(() => projectEconomics(...args));
});

test('complete measured evidence passes accounting but never claims replay', () => {
  const r = verifyEvidence(fixture());
  assert.equal(r.accountingPass, true, JSON.stringify(r.problems));
  assert.equal(r.liveAcceptance, false);
  assert.equal(r.paidCalls, 1);
  assert.equal(r.promptTokens, 1000);
  assert.equal(r.completionTokens, 20);
});

test('shutdown tail never dilutes always-on projection', () => {
  const f = fixture(); f.segments.push({ startMs: 864000, endMs: 86400000, startHour: 32, endHour: 32, mode: 'stopped' });
  const r = verifyEvidence(f);
  assert.equal(r.economics.usdPerAgentWallDay, 0.1);
  assert.equal(r.enabledWallMs, 864000);
});

test('guard forced idle is not savings and fails acceptance', () => {
  const f = fixture(); f.segments[0].mode = 'budget-blocked';
  assert.equal(verifyEvidence(f).accountingPass, false);
});

test('incomplete, inconsistent and failed evidence cannot pass', () => {
  const mutations = [
    f => delete f.interventions, f => delete f.rejections, f => f.samples.pop(),
    f => f.calls[0].usage = null, f => f.calls[0].costMicros = 0,
    f => f.calls[0].costBasis = 'estimated', f => f.calls[0].status = 'interrupted',
    f => f.calls.push(structuredClone(f.calls[0])), f => f.calls[0].agentId = 'other',
    f => f.samples[2].hp = 0, f => f.samples[2].ghost = true,
    f => f.samples[2].guard.capMicros = 1000000, f => f.samples[2].guard.exhausted = true,
    f => f.samples[2].guard.spentMicros = 0, f => f.samples[2].hour = 7,
    f => f.rejections.push({ reason: 'bad intent' }), f => f.interventions.push({ kind: 'manual' }),
    f => f.reason = 'operator-stop', f => f.decisions = [],
    f => f.segments[0].endHour = 31, f => f.calls[0].endMs = 900000,
  ];
  for (const mutate of mutations) { const f = fixture(); mutate(f); assert.equal(verifyEvidence(f).accountingPass, false, mutate.toString()); }
});
