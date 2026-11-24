import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createShard } from "./shard.ts";
import { createDirector } from "./accounts.ts";
import { createAgentRuntime } from "./agent-runtime.ts";
import { bundledReflex } from "./bundled-reflex.ts";
import type { ReflexBackend } from "../game/agent/scheduler.ts";
import type { ReflexExchange, ReflexResult } from "../game/agent/types.ts";

const answer = (e: ReflexExchange): ReflexResult => {
  const q = e.questions[0]; assert.equal(q.type, "choice");
  return { answers: [{ id: q.id, type: "choice", pick: q.options.length - 1, probabilities: q.options.map((_, i) => i === q.options.length - 1 ? 1 : 0) }] };
};
const completion = (text = "I am thinking.") => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ goals: ["stay safe"], journalEntry: text, intentHints: [] }) } }] }));
const pause = () => new Promise<void>(r => setTimeout(r, 5));
function harness(fetchImpl: typeof fetch, backendFactory: ((id: string, signal: AbortSignal) => ReflexBackend) | null = () => ({ decide: async e => answer(e) })) {
  const dir = mkdtempSync(join(tmpdir(), "lifecycle-"));
  const shard = createShard({ dataDir: dir, seed: 42, port: 5587, keys: [] }, { log: () => {} });
  let runtime!: ReturnType<typeof createAgentRuntime>;
  const clock = { now: 0 };
  const director = createDirector({ dataDir: dir, shard, secretKey: Buffer.alloc(32, 7), log: () => {}, runtimeFactory: services => runtime = createAgentRuntime({ shard, services, fetchImpl, backendFactory, now: () => clock.now, mindTimeoutMs: 500, schedulerConfig: { riskGated: false } }) });
  const account = director.createAccount({}, "lifecycle-account-001", "local");
  const c = director.createCharacter(account.accountId, { name: "Cloud", roleId: "banker", directive: "Keep my goods safe.", mind: { kind: "cloud", provider: "openai-compatible", model: "fixture-cloud" } }, "lifecycle-character-01").character;
  director.putMindSecret(account.accountId, c.characterId, { secret: "test-unique-secret", expectedRevision: c.revision });
  const latest = () => director.getCharacter(account.accountId, c.characterId).character;
  return { dir, shard, director, runtime, clock, id: c.characterId, accountId: account.accountId, latest,
    start: () => director.unleash(account.accountId, c.characterId, { expectedRevision: latest().revision }),
    recall: () => director.recall(account.accountId, c.characterId, { expectedRevision: latest().revision }),
    status: () => director.status(account.accountId, c.characterId),
    async close() { runtime.stopAll(); await runtime.settled(); shard.stop(); rmSync(dir, { recursive: true, force: true }); },
  };
}

test("cloud uses key/model/pack once; validated mind status, no billing and no idle model polling", async () => {
  let calls = 0; let prompt = "";
  const h = harness(async (input, init) => {
    calls++; assert.equal(input, "https://api.openai.com/v1/chat/completions");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-unique-secret");
    prompt = String(init?.body); return completion();
  });
  try {
    h.start(); await pause(); await h.runtime.settled();
    assert.equal(h.status().mindState, "awake");
    assert.equal(h.status().driver, "mind");
    assert.equal(calls, 1);
    const request = JSON.parse(prompt);
    const pack = readFileSync(new URL("../../agent-packs/banker.md", import.meta.url), "utf8");
    assert.equal(request.messages[0].content.split(pack).length, 2);
    assert.equal(request.model, "fixture-cloud");
    assert.equal(prompt.includes("test-unique-secret"), false);
    h.clock.now = 1_000_000;
    for (let i = 0; i < 10; i++) h.shard.step(.1);
    await h.runtime.settled(); assert.equal(calls, 1);
    assert.equal(h.latest().billing.entitled, true);
    assert.throws(() => h.director.updateCharacter(h.accountId, h.id, { expectedRevision: h.latest().revision, name: "Changed", roleId: null }), /Recall/);
    assert.equal(h.latest().name, "Cloud", "failed patch is atomic");
  } finally { await h.close(); }
});

test("auth and malformed completions never report an awake mind", async () => {
  let invalid = false; let calls = 0;
  const h = harness(async () => { calls++; return invalid ? new Response(JSON.stringify({ choices: [{ message: { content: "not JSON" } }] })) : new Response("secret provider text", { status: 401 }); });
  try {
    h.start(); await pause(); await h.runtime.settled();
    assert.equal(calls, 1); assert.equal(h.status().reasonCode, "MIND_AUTH");
    assert.equal(h.status().mindState, "error"); assert.equal(h.status().runtimeState, "degraded");
    invalid = true; h.clock.now = 60_001; h.shard.step(.1); await h.runtime.settled();
    assert.equal(h.status().reasonCode, "MIND_INVALID_RESPONSE");
    assert.equal(h.status().lastMindExchangeTick, null);
    assert.equal(JSON.stringify(h.status()).includes("secret provider text"), false);
  } finally { await h.close(); }
});

test("recall fences late mind/reflex results and aborts backend transport", async () => {
  let resolveMind!: (r: Response) => void;
  let resolveReflex!: (r: ReflexResult) => void;
  let captured!: ReflexExchange; let signal!: AbortSignal;
  const h = harness(() => new Promise(r => { resolveMind = r; }), (_id, s) => { signal = s; return { decide: e => { captured = e; return new Promise(r => { resolveReflex = r; }); } }; });
  try {
    h.start(); await pause();
    assert.ok(captured); h.recall();
    assert.equal(signal.aborted, true);
    resolveMind(completion("LATE MIND")); resolveReflex(answer(captured));
    await h.runtime.settled(); h.shard.step(.1);
    assert.equal(h.status().driver, "none");
    assert.equal(h.status().lastReflexTick, null);
    assert.equal(h.status().lastMindExchangeTick, null);
    assert.equal(JSON.stringify(h.status()).includes("LATE MIND"), false);
    assert.equal(h.shard.lastAppliedActionTick(h.id), null);
  } finally { await h.close(); }
});

test("changed directive fences an old completion then uses newest observation exactly once", async () => {
  let release!: (r: Response) => void; let calls = 0; let prompt = "";
  const h = harness((_input, init) => { calls++; prompt = String(init?.body); return calls === 1 ? new Promise(r => { release = r; }) : Promise.resolve(completion("LATEST")); });
  try {
    h.start(); await pause();
    h.director.updateCharacter(h.accountId, h.id, { expectedRevision: h.latest().revision, directive: "New directive" });
    release(completion("STALE")); await h.runtime.settled();
    assert.equal(h.status().mindState, "connecting");
    h.shard.step(.1); await h.runtime.settled();
    assert.equal(calls, 2); assert.match(prompt, /New directive/);
    assert.equal(h.status().mindState, "awake");
    assert.equal(JSON.stringify(h.status()).includes("STALE"), false);
    h.shard.step(.1); await h.runtime.settled(); assert.equal(calls, 2);
  } finally { await h.close(); }
});

test("missing bundled configuration rejects activation, never silently starts a stub", async () => {
  const h = harness(async () => { throw new Error("must not call"); }, null);
  try {
    assert.equal(bundledReflex(h.dir, {}).factory, null);
    assert.throws(h.start, /runtime could not start/);
    assert.equal(h.runtime.size, 0); assert.equal(h.latest().lifecycle, "recalled");
  } finally { await h.close(); }
});

test("reflex provider failure and budget denial are visibly degraded, with no substitute", async () => {
  let exhausted = false; let calls = 0;
  const h = harness(async () => { throw new Error("offline fixture"); }, () => ({ budgetExhausted: () => exhausted, decide: async () => { calls++; throw new Error("private provider error"); } }));
  try {
    h.start(); await pause(); await h.runtime.settled();
    assert.equal(calls, 1); assert.equal(h.status().reflexState, "unavailable");
    assert.equal(h.status().runtimeState, "degraded"); assert.equal(h.status().driver, "none");
    assert.equal(h.status().reasonCode, "REFLEX_UNAVAILABLE");
    exhausted = true; h.shard.step(.1);
    assert.equal(h.status().reflexState, "budget-exhausted");
    assert.equal(h.status().reasonCode, "REFLEX_BUDGET_EXHAUSTED");
    assert.equal(JSON.stringify(h.status()).includes("private provider error"), false);
  } finally { await h.close(); }
});
