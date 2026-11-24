// Authorized bounded provider preflight. Does not certify onboarding.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createMeteredReflexBackend } from '../src/game/agent/metered.ts';
import { jevConfigFromEnv } from '../src/game/agent/jev.ts';
import { BudgetGuard } from '../src/game/agent/budget.ts';
import { createJsonlAttemptLog } from '../src/game/agent/attempts-file.ts';
import { DEFAULT_PRICE } from '../src/game/agent/pricing.ts';
if (process.env.PHASE4_PAID_APPROVED !== '1') throw Error('Explicit authorization required');
const env = parseEnv(readFileSync(process.env.PHASE4_PROTECTED_ENV, 'utf8'));
const output = 'artifacts/phase4-onboarding-qa/live-prerequisites.json';
if (existsSync(output)) throw Error('Refusing automatic repeat paid probe');
const report = { checkedAt: new Date().toISOString(), capUsd: 0.25, cloud: {}, local: {}, reflex: {}, onboardingSeconds: null, gate: 'NOT_PASSED' };
for (const [name, url, key] of [['cloud', 'https://api.openai.com/v1/models', env.OPENAI_API_KEY], ['local', 'http://127.0.0.1:11434/v1/models', null]]) {
  try {
    const r = await fetch(url, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    report[name] = { httpStatus: r.status, models: j.data?.map(x => x.id).filter(x => name === 'local' || /gpt-4.1-nano|gpt-4o-mini/.test(x)), errorCode: j.error?.code ?? null };
  } catch { report[name] = { error: 'discovery unavailable' }; }
}
// One tiny actual reflex request, no retries. Input-only tariff; reserve a full
// $0.01 for this probe externally (well below approved $0.25 combined cap).
// Wire-size admission is stricter than the normal estimate and prevents a
// runaway input from consuming the authorized envelope.
let requests = 0, wireBytes = 0, httpStatus = null;
const log = createJsonlAttemptLog('artifacts/phase4-onboarding-qa/live-reflex-attempts.jsonl');
const guard = new BudgetGuard({ dailyCapMicros: 10000 });
const config = jevConfigFromEnv(env);
if (!config) throw Error('Reflex credential absent');
const backend = createMeteredReflexBackend({ jev: { ...config, fetchImpl: async (url, init) => {
  wireBytes = Buffer.byteLength(init.body);
  if (requests >= 1 || wireBytes > 4096) throw Error('QA envelope denied');
  requests++;
  const r = await fetch(url, init); httpStatus = r.status; return r;
} }, guard, log, agentId: 'phase4-prerequisite', maxRetries: 0, price: DEFAULT_PRICE });
try {
  const result = await backend.decide({ state: { scenario: 'Readiness probe. Stand safely.' }, questions: [{ id: 'ready', type: 'choice', question: 'Choose the safe action.', options: ['rest', 'walk'] }] });
  report.reflex.success = true;
  report.reflex.answers = result.answers;
} catch {
  report.reflex.success = false;
} finally {
  report.reflex = { ...report.reflex, requests, wireBytes, httpStatus, accounting: guard.snapshot('phase4-prerequisite'), reservedProbeEnvelopeUsd: 0.01, price: DEFAULT_PRICE };
  log.close();
  let serialized = JSON.stringify(report, null, 2);
  for (const value of Object.values(env)) if (value.length > 8) serialized = serialized.split(value).join('[redacted]');
  writeFileSync(output, serialized);
  console.log(serialized);
}
