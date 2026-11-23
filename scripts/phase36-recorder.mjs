import { redactForLog } from '../src/game/agent/attempts.ts';

/** Diagnostic-only immutable trace; never changes policy or host state. */
export function createRecorder(sink = () => {}) {
  const trace = [], samples = [];
  function event(type, fields = {}, wallMs = Date.now()) {
    if (trace.length && wallMs < trace.at(-1).wallMs) throw new Error('recorder clock reversal');
    const safe = redactForLog({ seq: trace.length, wallMs, type, ...fields });
    if (safe.redactions) throw new Error('recorder redaction would invalidate replay');
    trace.push(safe.value); sink(safe.value);
    return safe.value;
  }
  return {
    trace, samples, event,
    observe(observation, snapshot, exhausted, wallMs = Date.now()) {
      event('observation', { observation }, wallMs);
      const { tick, hour, you: { hp, ghost, hunger, energy } } = observation;
      const { capMicros, spentMicros, reservedMicros } = snapshot;
      samples.push({ wallMs, tick, hour, hp, ghost, hunger, energy,
        utcDay: new Date(wallMs).toISOString().slice(0, 10),
        guard: { capMicros, spentMicros, reservedMicros, exhausted } });
    },
    stop(wallMs) { event('stop', {}, wallMs); },
  };
}
