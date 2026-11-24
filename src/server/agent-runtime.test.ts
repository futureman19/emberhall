import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { createShard } from "./shard.ts";
import { createDirector } from "./accounts.ts";
import { createAgentRuntime } from "./agent-runtime.ts";
import { createMindFetch } from "./mind-egress.ts";
import type { ReflexBackend } from "../game/agent/scheduler.ts";

const pause = () => new Promise<void>(r => setTimeout(r, 5));
test("real shard: offline local unleash, actual reflex actions, wake latest revision, recall and restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "runtime-"));
  let awake = false;
  const prompts: string[] = [];
  const endpoint = createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    prompts.push(body);
    if (!awake) { res.writeHead(503); res.end(); return; }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ goals: ["Find food"], journalEntry: "I am back.", intentHints: [] }) } }] }));
  });
  await new Promise<void>(r => endpoint.listen(0, "127.0.0.1", r));
  const address = endpoint.address(); assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  let clock = 0; let reflexCalls = 0;
  const backend: ReflexBackend = { async decide(exchange) {
    reflexCalls++;
    const state = exchange.state as { candidateVerbs: string[]; observation: { you: { x: number; z: number } } };
    const verbs = state.candidateVerbs;
    const question = exchange.questions[0];
    assert.equal(question.type, "choice");
    const pick = Math.max(0, verbs.findIndex((v, i) => v === "walk" && !question.options[i].includes(`[${Math.round(state.observation.you.x)},${Math.round(state.observation.you.z)}]`)));
    return { answers: [{ id: "next_action", type: "choice", pick, probabilities: verbs.map((_, i) => i === pick ? 1 : 0) }] };
  } };
  const config = { dataDir: dir, seed: 42, port: 5587, keys: [] };
  let shard = createShard(config, { log: () => {} });
  let runtime!: ReturnType<typeof createAgentRuntime>;
  const makeDirector = () => createDirector({ dataDir: dir, shard, secretKey: Buffer.alloc(32, 7), policy: { allowPrivateEndpoints: true }, log: () => {},
    runtimeFactory: services => runtime = createAgentRuntime({ shard, services, backendFactory: () => backend, now: () => clock, fetchImpl: createMindFetch({ allowedPrivateOrigins: [origin] }), retryMs: [10, 20, 30], mindTimeoutMs: 100, schedulerConfig: { riskGated: false } }),
  });
  let director = makeDirector();
  try {
    const account = director.createAccount({}, "runtime-account-0001", "local");
    let c = director.createCharacter(account.accountId, { name: "Runner", roleId: "ranger", directive: "Walk safely.", mind: { kind: "local", endpointUrl: origin + "/v1", model: "fixture" } }, "runtime-character-0001").character;
    const id = c.characterId;
    const first = director.unleash(account.accountId, id, { expectedRevision: c.revision });
    const repeat = director.unleash(account.accountId, id, { expectedRevision: 0 });
    assert.equal(first.agentId, repeat.agentId);
    assert.equal(runtime.size, 1);
    for (let i = 0; i < 30; i++) { shard.step(.1); await pause(); }
    await runtime.settled();
    let status = director.status(account.accountId, id);
    assert.equal(status.mindState, "asleep");
    assert.equal(status.driver, "reflex");
    assert.equal(status.runtimeState, "running");
    assert.ok(reflexCalls > 0);
    assert.notEqual(status.lastAppliedActionTick, null);
    assert.equal(status.journalTail.filter(s => s.includes("mind is asleep")).length, 1);
    const firstEffect = status.lastAppliedActionTick!;
    for (let i = 0; i < 200; i++) { shard.step(.1); await pause(); }
    await runtime.settled();
    assert.ok(reflexCalls > 1, "reflex keeps choosing after mind went offline");
    assert.ok(director.status(account.accountId, id).lastAppliedActionTick! > firstEffect, "continued authoritative action, not only admission");
    c = director.getCharacter(account.accountId, id).character;
    director.updateCharacter(account.accountId, id, { expectedRevision: c.revision, roleId: "smith", directive: "Newest directive: collect ore." });
    awake = true; clock = 100;
    shard.step(.1); await runtime.settled();
    status = director.status(account.accountId, id);
    assert.equal(status.mindState, "awake");
    assert.equal(status.autopilotSince, null);
    assert.match(prompts.at(-1)!, /Newest directive: collect ore/);
    assert.match(prompts.at(-1)!, /smith/i);
    assert.equal(status.journalTail.filter(s => s.includes("mind woke")).length, 1);
    const body = shard.agentBody(id);
    runtime.stopAll(); shard.stop();
    shard = createShard(config, { log: () => {} }); director = makeDirector(); director.recover();
    assert.deepEqual(shard.agentBody(id), body);
    assert.equal(runtime.size, 1);
    assert.equal(shard.status().characters, 1);
    c = director.getCharacter(account.accountId, id).character;
    director.recall(account.accountId, id, { expectedRevision: c.revision });
    await runtime.settled();
    const calls = reflexCalls;
    for (let i = 0; i < 10; i++) shard.step(.1);
    await runtime.settled();
    assert.equal(reflexCalls, calls);
    assert.equal(runtime.size, 0);
    assert.equal(director.status(account.accountId, id).driver, "none");
  } finally { runtime.stopAll(); shard.stop(); await new Promise<void>(r => endpoint.close(() => r())); rmSync(dir, { recursive: true, force: true }); }
});

test("activation recovery after world-save before registry write does not duplicate body or reset skills", () => {
  const dir = mkdtempSync(join(tmpdir(), "activation-"));
  const cfg = { dataDir: dir, seed: 42, port: 5587, keys: [] };
  try {
    const a = createShard(cfg, { log: () => {} });
    a.registerAgent({ id: "char-crash", name: "Crash", key: "private-fixture", skills: { archery: 77 } }, true);
    a.stop();
    writeFileSync(join(dir, "characters.json"), "[]"); // crash before registry rename
    const b = createShard(cfg, { log: () => {} });
    b.registerAgent({ id: "char-crash", name: "Crash", key: "private-fixture", skills: { archery: 1 } }, true);
    b.stop();
    const save = JSON.parse(readFileSync(join(dir, "shard-save.json"), "utf8"));
    assert.equal(save.people.filter((p: { id: string }) => p.id === "char-crash").length, 1);
    assert.equal(b.observationFor("char-crash").you.skills.archery, 77);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
