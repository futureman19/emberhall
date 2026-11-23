import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createJsonlAttemptLog, readAttemptLogFile } from "./attempts-file.ts";
import { createAttemptLog, foldAttempts } from "./attempts.ts";
import { DEFAULT_PRICE } from "./pricing.ts";
import { BudgetGuard } from "./budget.ts";
import { createMeteredReflexBackend } from "./metered.ts";
import { replayLog } from "./replay.ts";
import { createShard, shardConfig } from "../../server/shard.ts";
import { createTransport } from "../../server/ws.ts";
import { connectHostFeed } from "./hostfeed.ts";
import { createHostReflex } from "./reflex-runtime.ts";
import { createReflexAutopilot } from "./autopilot.ts";
import { DEFAULT_CADENCE, type ReflexExchange } from "./types.ts";

const exchange: ReflexExchange = { state: {}, questions: [{ id: "q", type: "choice", question: "What now?", options: ["A", "B"] }] };
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status }); }
function answer(init: RequestInit | undefined, select: (options: string[]) => string = (o) => o[0]!) {
  const request = JSON.parse(String(init?.body));
  return { model: DEFAULT_PRICE.model, usage: { input_tokens: 100, output_tokens: 0 }, answers: Object.fromEntries(Object.entries(request.questions).map(([id, raw]) => {
    const q = raw as { criteria: Record<string, string> };
    const options = Object.keys(q.criteria), pick = select(options);
    return [id, { type: "choice", choice: pick, probabilities: Object.fromEntries(options.map(o => [o, o === pick ? 1 : 0])) }];
  })) };
}
async function waitFor(check: () => boolean) {
  for (let n = 0; n < 300; n++) { if (check()) return; await new Promise(r => setTimeout(r, 5)); }
  assert.fail("local integration timed out");
}

test("every HTTP retry sees a durable begin and its own reservation; replay survives file reopen", async t => {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "reflex-integration-"));
  const path = join(dir, "attempts.jsonl"), log = createJsonlAttemptLog(path), guard = new BudgetGuard();
  t.after(() => { log.close(); rmSync(dir, { recursive: true, force: true }); });
  let calls = 0;
  const backend = createMeteredReflexBackend({ agentId: "test", guard, log, maxRetries: 2, backoffMs: 0,
    jev: { apiKey: "fixture", maxRetries: 5, fetchImpl: async (_url, init) => {
      calls++;
      assert.equal(readAttemptLogFile(path).filter(l => l.type === "begin").length, calls);
      assert.equal(guard.snapshot("test").openReservations, 1);
      return calls < 3 ? response({ usage: { input_tokens: 100, output_tokens: 0 } }, 503) : response(answer(init));
    } },
  });
  await backend.decide(exchange);
  const rows = foldAttempts(readAttemptLogFile(path), DEFAULT_PRICE);
  assert.equal(calls, 3); assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(r => r.retryN), [0, 1, 2]);
  assert.equal(rows[1]!.retryOf, rows[0]!.attemptId);
  assert.equal(guard.snapshot("test").spentMicros, 15);
  assert.equal(replayLog(readAttemptLogFile(path)).mismatches.length, 0);
  assert.equal(readFileSync(path, "utf8").includes('"fixture"'), false);
});

test("budget denial between retries forbids a second HTTP attempt", async () => {
  let calls = 0;
  const log = createAttemptLog(), guard = new BudgetGuard({ dailyCapMicros: 10 });
  const backend = createMeteredReflexBackend({ agentId: "test", guard, log, backoffMs: 0,
    jev: { apiKey: "fixture", fetchImpl: async () => { calls++; return response({ usage: { input_tokens: 200, output_tokens: 0 } }, 503); } },
  });
  await assert.rejects(backend.decide(exchange), /daily cap/);
  assert.equal(calls, 1); assert.equal(backend.budgetExhausted(), true);
  assert.deepEqual(foldAttempts(log.lines(), DEFAULT_PRICE).map(r => r.status), ["error", "blocked"]);
});

test("real shard WS + Jev adapter + durable meter executes eating; stopping prevents late actions", async t => {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "reflex-host-"));
  const shard = createShard(shardConfig({ EMBERHALL_DATA_DIR: dir }), { log: () => {} });
  const transport = createTransport(shard), port = await transport.listen(0, "127.0.0.1");
  const feed = await connectHostFeed({ url: `ws://127.0.0.1:${port}`, apiKey: "dev-kett" });
  const log = createJsonlAttemptLog(join(dir, "attempts.jsonl"));
  t.after(async () => { await feed.close(); await transport.close(); shard.stop(); log.close(); rmSync(dir, { recursive: true, force: true }); });
  let selected = "";
  const { autopilot, backend } = createHostReflex({ feed, agentId: "test", log, guard: new BudgetGuard(), price: DEFAULT_PRICE, cadence: { ...DEFAULT_CADENCE, reflexCooldownTicks: 2 },
    jev: { apiKey: "fixture", fetchImpl: async (_url, init) => response(answer(init, options => {
      selected = options.find(o => o.startsWith("Eat ")) ?? "";
      assert.ok(selected, "fresh host body offers its real pack food");
      return selected;
    })) },
  });
  const before = { ...feed.latest.you.pack };
  autopilot.start(); await waitFor(() => log.lines().length >= 2); await autopilot.settled(); autopilot.stop();
  assert.equal(autopilot.log.rows.length, 1, JSON.stringify(log.lines().filter(l => l.type === "end")));
  assert.equal(autopilot.log.rows[0]!.verb, "eat");
  assert.equal(autopilot.log.rows[0]!.outcome, null);
  shard.step(0.1); await waitFor(() => feed.latest.tick >= 1);
  assert.ok(Object.keys(before).some(k => (feed.latest.you.pack[k as keyof typeof before] ?? 0) < (before[k as keyof typeof before] ?? 0)), "host executed actual food consumption");
  assert.equal(backend.meteredCalls, 1);
  assert.equal(foldAttempts(log.lines(), DEFAULT_PRICE)[0]!.status, "ok");
  let resolve!: (r: { answers: [] }) => void;
  let submitted = 0;
  const late = createReflexAutopilot({ config: { cadence: { ...DEFAULT_CADENCE, reflexCooldownTicks: 2 } }, observe: () => feed.latest, backend: { decide: () => new Promise(r => { resolve = r; }) }, submit: () => { submitted++; return null; } });
  late.start(); late.step(); await waitFor(() => typeof resolve === "function"); late.stop(); resolve({ answers: [] }); await late.settled();
  assert.equal(submitted, 0);
});
