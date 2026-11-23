import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder } from './phase36-recorder.mjs';

test('recorder snapshots every observation with identical boundary clocks and guard state', () => {
  const r = createRecorder();
  const obs = { tick: 1, hour: 5, you: { hp: 40, ghost: false, hunger: 80, energy: 70 } };
  r.observe(obs, { capMicros: 500000, spentMicros: 0, reservedMicros: 20 }, false, 1000);
  obs.you.hp = 0;
  assert.equal(r.trace[0].observation.you.hp, 40);
  assert.equal(r.samples[0].wallMs, r.trace[0].wallMs);
  assert.equal(r.samples[0].guard.reservedMicros, 20);
  r.stop(1000);
  assert.equal(r.trace.at(-1).wallMs, r.samples.at(-1).wallMs);
  assert.deepEqual(r.trace.map(x => x.seq), [0, 1]);
});
test('recorder refuses redacted evidence and clock reversals', () => {
  const r = createRecorder();
  assert.throws(() => r.event('request', { password: 'secret' }, 1000), /redaction/);
  r.event('stop', {}, 1000);
  assert.throws(() => r.event('stop', {}, 999), /clock/);
});
