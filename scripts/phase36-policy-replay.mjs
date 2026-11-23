/** Independent offline driver of the pinned policy, with no real backend or host.
 * This is reproducibility checking, NOT a separately implemented scheduler oracle.
 * Action/normalization reconstruction lives separately in phase36-replay.mjs.
 */
import { isDeepStrictEqual } from 'node:util';
import { setImmediate as drain } from 'node:timers/promises';
import { createReflexAutopilot } from '../src/game/agent/autopilot.ts';
import { DEFAULT_SCHEDULER_CONFIG } from '../src/game/agent/scheduler.ts';

export async function replayPolicy(e) {
  const mismatches = [];
  const fail = s => mismatches.push(s);
  const compare = (a, b, label) => { if (!isDeepStrictEqual(a, b)) fail(label); };
  const config = e?.policy?.config;
  const required = Object.keys(DEFAULT_SCHEDULER_CONFIG);
  if (!config || required.some(k => config[k] === undefined) || config.maxConcurrentAttempts !== 1 ||
      !config.cadence || Object.keys(DEFAULT_SCHEDULER_CONFIG.cadence).some(k => !Number.isFinite(config.cadence[k])) ||
      !config.events || Object.keys(DEFAULT_SCHEDULER_CONFIG.events).some(k => !Number.isFinite(config.events[k]))) fail('effective policy configuration missing/unsupported (requires single-flight)');
  if (!Array.isArray(e?.trace) || !e.trace.length) fail('ordered trace missing');
  if (mismatches.length) return { pass: false, mismatches, requests: 0, paidCallsIssued: 0 };
  const produced = [], unresolved = new Set(), seen = new Set();
  let activeId = null, response = null, ack = null, stopped = false, requests = 0, wall = 0, lastTick = null;
  const deferred = () => {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    const complete = value => { unresolved.delete(complete); resolve(value); };
    unresolved.add(complete);
    return { promise, complete };
  };
  const submit = action => {
    const d = deferred(); ack = d.complete;
    produced.push({ type: 'submit', attemptId: activeId, action });
    return d.promise;
  };
  const auto = createReflexAutopilot({ config, now: () => wall,
    backend: { decide(exchange, context) {
      const d = deferred(); response = d.complete;
      produced.push({ type: 'request', exchange, context }); return d.promise;
    } },
    submit: intent => submit({ type: 'intent', intent }),
    verb: req => submit({ type: 'verb', ...req }),
    hooks: { onDecision: row => produced.push({ type: 'decision', attemptId: activeId, row }) },
  });
  auto.start();
  try {
    for (const [seq, r] of e.trace.entries()) {
      if (r.seq !== seq || !Number.isFinite(r.wallMs) || r.wallMs < wall) fail(`trace ${seq}: sequence/time`);
      wall = r.wallMs;
      if (stopped) { fail(`trace ${seq}: after stop`); continue; }
      if (r.type === 'observation') {
        if (produced.length) fail(`trace ${seq}: unrecorded output before observation`);
        if (!Number.isFinite(r.observation?.tick) || (lastTick !== null && r.observation.tick <= lastTick)) fail(`trace ${seq}: observation tick`);
        lastTick = r.observation?.tick; auto.ingest(structuredClone(r.observation));
      } else if (r.type === 'request') {
        const actual = produced.shift();
        compare(actual, { type: 'request', exchange: r.exchange, context: r.context }, `trace ${seq}: policy request mismatch`);
        if (typeof r.attemptId !== 'string' || seen.has(r.attemptId)) fail(`trace ${seq}: duplicate/missing attempt id`);
        seen.add(r.attemptId); activeId = r.attemptId; requests++;
        const decision = e.decisions?.find(d => d.attemptId === activeId);
        compare(decision?.exchange, r.exchange, `trace ${seq}: decision exchange linkage`);
        compare(decision?.observation?.tick, r.context?.tick, `trace ${seq}: observation linkage`);
      } else if (r.type === 'response') {
        if (r.attemptId !== activeId || !response) fail(`trace ${seq}: orphan response`);
        compare(e.decisions?.find(d => d.attemptId === activeId)?.answers, r.answers, `trace ${seq}: response linkage`);
        response?.({ answers: r.answers }); response = null;
      } else if (r.type === 'submit' || r.type === 'decision') {
        const expected = r.type === 'submit' ? { type: r.type, attemptId: r.attemptId, action: r.action } : { type: r.type, attemptId: r.attemptId, row: r.row };
        compare(produced.shift(), expected, `trace ${seq}: ${r.type} mismatch`);
        if (r.type === 'decision') compare(e.decisions?.find(d => d.attemptId === r.attemptId)?.row, r.row, `trace ${seq}: row linkage`);
      } else if (r.type === 'ack') {
        if (r.attemptId !== activeId || !ack || !(r.rejection === null || typeof r.rejection === 'string')) fail(`trace ${seq}: orphan/malformed ack`);
        ack?.(r.rejection); ack = null;
      } else if (r.type === 'stop') {
        if (unresolved.size || produced.length) fail(`trace ${seq}: incomplete calls at stop`);
        auto.stop(); stopped = true;
      } else fail(`trace ${seq}: unknown event`);
      // Exhaust promise microtasks without inventing latency or advancing simulation.
      await drain();
    }
    if (!stopped || produced.length || unresolved.size) fail('trace incomplete/unconsumed output');
    compare([...seen].sort(), (e.calls ?? []).map(c => c.id).sort(), 'call/trace linkage');
  } catch (error) { fail(`malformed trace: ${error.message}`); }
  finally {
    auto.stop();
    for (const complete of [...unresolved]) complete({ answers: [] });
    await drain();
  }
  return { pass: mismatches.length === 0, mismatches, requests, paidCallsIssued: 0 };
}
