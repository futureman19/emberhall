// Opt-in paid, local-only, diagnostic composition. No scheduler/host overrides.
import { mkdirSync, existsSync, openSync, writeSync, closeSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { connectHostFeed } from '../src/game/agent/hostfeed.ts';
import { createReflexAutopilot } from '../src/game/agent/autopilot.ts';
import { createMeteredReflexBackend } from '../src/game/agent/metered.ts';
import { jevConfigFromEnv } from '../src/game/agent/jev.ts';
import { BudgetGuard } from '../src/game/agent/budget.ts';
import { createJsonlAttemptLog, readAttemptLogFile } from '../src/game/agent/attempts-file.ts';
import { DEFAULT_PRICE } from '../src/game/agent/pricing.ts';
import { DEFAULT_SCHEDULER_CONFIG } from '../src/game/agent/scheduler.ts';
import { policyFingerprint } from './phase36-verify.mjs';
import { createRecorder } from './phase36-recorder.mjs';

if (process.env.EMBERHALL_REFLEX_PAID_APPROVED !== '1') throw new Error('explicit paid-run authorization required');
const jev = jevConfigFromEnv(process.env);
if (!jev) throw new Error('TYPESAFE_API_KEY missing');
const url = process.env.EMBERHALL_REFLEX_WS;
const apiKey = process.env.EMBERHALL_REFLEX_CHARACTER_KEY;
const agentId = process.env.EMBERHALL_REFLEX_AGENT_ID;
if (!url?.startsWith('ws://127.0.0.1:') || !apiKey || !agentId) throw new Error('dedicated local host and identity required');
jev.model = DEFAULT_PRICE.model;
const dir = resolve(process.argv[2] ?? 'evidence/phase36-live/raw');
mkdirSync(dir, { recursive: true });
const attemptPath = join(dir, 'attempts.jsonl');
if (existsSync(attemptPath)) throw new Error('fresh attempt directory required');
const durable = createJsonlAttemptLog(attemptPath);
const traceFd = openSync(join(dir, 'trace.jsonl'), 'wx');
const r = createRecorder(row => writeSync(traceFd, JSON.stringify(row) + '\n'));
const guard = new BudgetGuard();
const decisions = [], rejections = [], interventions = [], errors = [];
const policy = { version: 'phase36-risk-v1', config: structuredClone(DEFAULT_SCHEDULER_CONFIG), sourceHashes: policyFingerprint() };
let current = null, latestObservation, active = false, stopped = false, reason = 'setup-failed';
let finish;
const done = new Promise(resolveDone => { finish = resolveDone; });
const feed = await connectHostFeed({ url, apiKey });
const log = {
  begin(row) {
    durable.begin(row);
    current.id = row.attemptId;
    r.event('request', { attemptId: row.attemptId, exchange: current.exchange, context: current.context }, current.wallMs);
  },
  end(row) { durable.end(row); current.end = structuredClone(row); },
  lines: () => durable.lines(), toJSONL: () => durable.toJSONL(),
};
const metered = createMeteredReflexBackend({ jev, guard, log, agentId, bodyId: feed.characterId, price: DEFAULT_PRICE });
const backend = {
  budgetExhausted: () => metered.budgetExhausted(),
  async decide(exchange, context) {
    active = true;
    current = { exchange: structuredClone(exchange), context: structuredClone(context),
      observation: structuredClone(latestObservation), wallMs: Date.now() };
    try {
      const result = await metered.decide(exchange, context);
      current.answers = structuredClone(result.answers);
      r.event('response', { attemptId: current.id, answers: result.answers });
      return result;
    } catch (error) { errors.push({ wallMs: Date.now(), kind: 'backend-failure', message: String(error.message) }); throw error; }
  },
};
async function send(action) {
  r.event('submit', { attemptId: current.id, action });
  const rejection = action.type === 'intent' ? await feed.submit(action.intent) : await feed.verb({ verb: action.verb, item: action.item });
  const row = r.event('ack', { attemptId: current.id, rejection });
  if (rejection !== null) rejections.push(row);
  return rejection;
}
const auto = createReflexAutopilot({ backend,
  submit: intent => send({ type: 'intent', intent }),
  verb: req => send({ type: 'verb', ...req }),
  hooks: {
    onAttemptEnd(row) { active = false; if (row.status !== 'ok') errors.push({ wallMs: Date.now(), kind: 'scheduler', status: row.status }); },
    onDecision(row) {
      r.event('decision', { attemptId: current.id, row });
      decisions.push({ attemptId: current.id, observation: current.observation, row: structuredClone(row),
        exchange: current.exchange, raw: current.end.response.raw, answers: current.answers });
    },
  },
});
function stop(why, wallMs) {
  if (stopped) return;
  stopped = true; reason = why;
  r.stop(wallMs); auto.stop(); finish();
}
const signal = () => { interventions.push({ wallMs: Date.now(), kind: 'operator-stop' }); stop('operator-stop', Date.now()); };
process.once('SIGTERM', signal); process.once('SIGINT', signal);
const watchdog = setTimeout(() => { interventions.push({ wallMs: Date.now(), kind: 'watchdog' }); stop('watchdog', Date.now()); }, 3600000);
auto.start();
const unsubscribe = feed.source.subscribe(obs => {
  if (stopped) return;
  latestObservation = obs;
  const wallMs = Date.now();
  r.observe(obs, guard.snapshot(agentId), metered.budgetExhausted(), wallMs);
  auto.ingest(obs);
  // A microtask lets synchronous scheduler admission enter backend.decide.
  // Stop only on an observation boundary with no paid work outstanding.
  queueMicrotask(() => {
    if (active || r.trace.at(-1)?.type !== 'observation') return;
    if (obs.you.ghost || obs.you.hp <= 0) stop('death', wallMs);
    else if (obs.hour - r.samples[0].hour >= 24) stop('full-vale-day', wallMs);
  });
});
try { await done; }
finally {
  clearTimeout(watchdog); unsubscribe(); auto.stop(); await auto.settled(); await feed.close();
  durable.close(); closeSync(traceFd);
  const lines = readAttemptLogFile(attemptPath);
  const calls = lines.filter(x => x.type === 'begin').map(begin => {
    const end = lines.find(x => x.type === 'end' && x.attemptId === begin.attemptId);
    return { id: begin.attemptId, agentId, startMs: begin.startedAt, endMs: end?.endedAt,
      status: end?.status ?? 'interrupted', usage: end?.usage, price: end?.cost.price ?? begin.price,
      model: begin.provider.model, costMicros: end?.cost.micros, costBasis: end?.cost.basis };
  });
  const first = r.samples[0], last = r.samples.at(-1);
  const envelope = { schema: 'emberhall-phase36-v1', agentId, bodyId: feed.characterId, reason, policy, maxSampleGapMs: 2000,
    segments: [{ startMs: first.wallMs, endMs: last.wallMs, startHour: first.hour, endHour: last.hour, mode: 'enabled' }],
    samples: r.samples, trace: r.trace, decisions, calls, rejections, interventions, errors };
  writeFileSync(join(dir, 'run.json'), JSON.stringify(envelope));
  console.log(JSON.stringify({ reason, agentId, samples: r.samples.length, calls: calls.length, rejections: rejections.length, errors: errors.length }));
}
