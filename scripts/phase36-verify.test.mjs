import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { verifyRun, policyFingerprint, verifyCoverage } from './phase36-verify.mjs';

function coverageFixture() {
  const samples = [0, 1000].map((wallMs, tick) => ({ wallMs, tick, hour: 8 + tick * 24, hp: 40, ghost: false, hunger: 80, energy: 80 }));
  return { bodyId: 'body', samples, segments: [{ mode: 'enabled', startMs: 0, endMs: 1000 }],
    trace: [...samples.map(s => ({ type: 'observation', wallMs: s.wallMs, observation: { tick: s.tick, hour: s.hour, isNight: s.tick === 1, you: { id: 'body', hp: s.hp, ghost: s.ghost, hunger: s.hunger, energy: s.energy } } })), { type: 'stop', wallMs: 1000 }] };
}
test('coverage requires exact observation/sample timing and stop boundaries', () => {
  assert.deepEqual(verifyCoverage(coverageFixture()), []);
  for (const change of [
    e => e.samples[1].wallMs *= 2,
    e => e.trace[2].wallMs = 2000,
    e => e.trace[0].wallMs = -1,
    e => e.samples.pop(),
    e => e.trace.splice(1, 0, { type: 'observation', wallMs: 500, observation: { ...e.trace[0].observation, you: { ...e.trace[0].observation.you, hp: 0, ghost: true } } }),
    e => e.trace[0].observation.you.id = 'other',
  ]) { const e = coverageFixture(); change(e); assert.ok(verifyCoverage(e).length > 0, change.toString()); }
});

test('combined verifier refuses empty and legacy summary evidence', async () => {
  for (const e of [{}, { survivalGate: true, replayMismatches: 0, wallDayProjectionMicros: 1000 }]) {
    const r = await verifyRun(e); assert.equal(r.pass, false); assert.equal(r.acceptance, 'FAIL_OR_INCOMPLETE');
  }
});
test('fingerprint is deterministic and contains code identities, not log claims', () => {
  const hashes = policyFingerprint(); assert.deepEqual(hashes, policyFingerprint());
  assert.match(hashes['game/agent/scheduler.ts'], /^[a-f0-9]{64}$/);
});
test('CLI emits nonzero failure without printing malformed raw input', () => {
  const p = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/phase36-verify.mjs'], { encoding: 'utf8' });
  assert.equal(p.status, 2); assert.equal(JSON.parse(p.stdout).pass, false);
});
