/**
 * Phase 4 director acceptance tests (v1 §7.2 + card requirements):
 * create/read/update, restart persistence, ownership isolation, credential
 * protection, role injection idempotency, invalid configuration, lifecycle,
 * idempotency keys, revision CAS, journal pagination and the closed envelope.
 *
 * These tests spend no provider tokens: the default runtime port is passive.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createShard } from "./shard.ts";
import { createTransport } from "./ws.ts";
import { createDirector, type DirectorOptions, type RuntimePort } from "./accounts.ts";
import { BETA_BILLING } from "../game/agent/account.ts";

const SECRET_VALUE = "sk-test-director-secret-0123456789";
const IDEM_KEY = "idem-key-0123456789abcdef";

function makeHost(extra: Partial<DirectorOptions> = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), "emberhall-director-"));
  const shard = createShard({ port: 0, seed: 20261121, dataDir, keys: [] }, { log: () => {} });
  const director = createDirector({ dataDir, shard, secretKey: randomBytes(32), log: () => {}, ...extra });
  return { dataDir, shard, director };
}

type Host = ReturnType<typeof makeHost>;

async function makeHttp(host: Host) {
  const transport = createTransport(host.shard, host.director);
  const port = await transport.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${port}`;
  async function call(method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(opts.headers ?? {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, text };
  }
  return { base, call, close: () => transport.close() };
}

function fullBody(name = "Wren") {
  return {
    name,
    roleId: "ranger",
    directive: "Gather oak logs near the hall and bank them.",
    mind: { kind: "cloud", model: "test-model" },
    apiKey: SECRET_VALUE,
  };
}

async function newAccount(http: Awaited<ReturnType<typeof makeHttp>>, body: unknown = {}, headers: Record<string, string> = {}) {
  const res = await http.call("POST", "/api/v1/accounts", { body, headers });
  assert.equal(res.status, 201);
  return res.body as { accountId: string; ownerToken: string; billing: typeof BETA_BILLING };
}

function checkpointStates(host: Host): Record<string, { skills: Record<string, number> }> {
  return JSON.parse(host.shard.checkpoint()).playerStates ?? {};
}

function cleanup(host: Host) {
  try { host.shard.stop(); } catch { /* already stopped */ }
  rmSync(host.dataDir, { recursive: true, force: true });
}

test("account create: token, beta-free billing, idempotent replay, key reuse conflict", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  try {
    const first = await newAccount(http, { displayName: "Keeper" }, { "idempotency-key": IDEM_KEY });
    assert.match(first.ownerToken, /^ehk_/);
    assert.deepEqual(first.billing, BETA_BILLING);
    assert.equal(first.billing.plan, "beta-free");
    assert.equal(first.billing.entitled, true);
    const replay = await http.call("POST", "/api/v1/accounts", { body: { displayName: "Keeper" }, headers: { "idempotency-key": IDEM_KEY } });
    assert.equal(replay.status, 201);
    assert.equal(replay.body.ownerToken, first.ownerToken);
    assert.equal(replay.body.accountId, first.accountId);
    const conflict = await http.call("POST", "/api/v1/accounts", { body: { displayName: "Other" }, headers: { "idempotency-key": IDEM_KEY } });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error.code, "CONFLICT");
    const shortKey = await http.call("POST", "/api/v1/accounts", { body: {}, headers: { "idempotency-key": "short" } });
    assert.equal(shortKey.status, 422);
    assert.equal(shortKey.body.error.code, "VALIDATION");
  } finally { await http.close(); cleanup(host); }
});

test("roles endpoint serves the manifest; unknown routes use the closed envelope", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  try {
    const roles = await http.call("GET", "/api/v1/roles");
    assert.equal(roles.status, 200);
    const ids = roles.body.roles.map((r: { id: string }) => r.id).sort();
    assert.deepEqual(ids, ["banker", "mule", "ranger", "smith"]);
    for (const role of roles.body.roles) {
      assert.equal(typeof role.label, "string");
      assert.equal(typeof role.summary, "string");
      assert.ok(Object.keys(role.startingSkills).length > 0);
    }
    const missing = await http.call("GET", "/api/v1/nope");
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, "NOT_FOUND");
    assert.equal(typeof missing.body.error.message, "string");
  } finally { await http.close(); cleanup(host); }
});

test("character create: ready view, secret hint only, journal seeded, no credential in response", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  try {
    const account = await newAccount(http);
    const res = await http.call("POST", "/api/v1/characters", { token: account.ownerToken, body: fullBody(), headers: { "idempotency-key": IDEM_KEY } });
    assert.equal(res.status, 201);
    const view = res.body;
    assert.equal(view.character.name, "Wren");
    assert.equal(view.character.roleId, "ranger");
    assert.equal(view.character.lifecycle, "ready");
    assert.equal(view.character.revision, 1);
    assert.equal(view.publicMind.secretHint, "configured");
    assert.equal(view.publicMind.config.kind, "cloud");
    assert.ok(!res.text.includes(SECRET_VALUE), "API key must never appear in a response");
    assert.ok(!res.text.includes("apiKey"));
    const replay = await http.call("POST", "/api/v1/characters", { token: account.ownerToken, body: fullBody(), headers: { "idempotency-key": IDEM_KEY } });
    assert.equal(replay.status, 201);
    assert.equal(replay.body.character.characterId, view.character.characterId);
    const journal = await http.call("GET", `/api/v1/characters/${view.character.characterId}/journal`, { token: account.ownerToken });
    assert.equal(journal.status, 200);
    assert.equal(journal.body.entries.length, 1);
    assert.equal(journal.body.entries[0].source, "system");
    assert.equal(journal.body.nextCursor, null);
  } finally { await http.close(); cleanup(host); }
});

test("invalid configuration returns actionable field errors", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  try {
    const account = await newAccount(http);
    const token = account.ownerToken;
    const badName = await http.call("POST", "/api/v1/characters", { token, body: { ...fullBody(), name: "x" } });
    assert.equal(badName.status, 422);
    assert.equal(badName.body.error.code, "VALIDATION");
    assert.ok(badName.body.fields.some((f: { field: string }) => f.field === "name"));
    const badRole = await http.call("POST", "/api/v1/characters", { token, body: { ...fullBody(), roleId: "wizard" } });
    assert.equal(badRole.status, 422);
    assert.equal(badRole.body.error.code, "UNKNOWN_ROLE");
    assert.equal(badRole.body.error.field, "roleId");
    const unknownField = await http.call("POST", "/api/v1/characters", { token, body: { ...fullBody(), sneaky: 1 } });
    assert.equal(unknownField.status, 422);
    assert.ok(unknownField.body.fields.some((f: { code: string }) => f.code === "UNKNOWN_FIELD"));
    const privateEndpoint = await http.call("POST", "/api/v1/characters", { token, body: { name: "Local", mind: { kind: "local", endpointUrl: "http://127.0.0.1:11434/v1" } } });
    assert.equal(privateEndpoint.status, 422);
    assert.ok(privateEndpoint.body.fields.some((f: { field: string }) => f.field === "mind.endpointUrl"));
    const localWithKey = await http.call("POST", "/api/v1/characters", { token, body: { name: "Local", mind: { kind: "local", endpointUrl: "https://example.com/v1" }, apiKey: SECRET_VALUE } });
    assert.equal(localWithKey.status, 422);
    assert.equal(localWithKey.body.error.field, "apiKey");
    const duplicate = await http.call("POST", "/api/v1/characters", { token, body: fullBody() });
    assert.equal(duplicate.status, 201);
    const dupName = await http.call("POST", "/api/v1/characters", { token, body: fullBody() });
    assert.equal(dupName.status, 409);
    assert.equal(dupName.body.error.code, "CONFLICT");
  } finally { await http.close(); cleanup(host); }
});

test("oversized body is rejected with 413", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  try {
    const account = await newAccount(http);
    const res = await http.call("POST", "/api/v1/characters", { token: account.ownerToken, body: { name: "Wren", directive: "x".repeat(20_000) } });
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, "PAYLOAD_TOO_LARGE");
  } finally { await http.close(); cleanup(host); }
});

test("ownership isolation: another account sees 404 everywhere", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  try {
    const owner = await newAccount(http);
    const intruder = await newAccount(http);
    const created = await http.call("POST", "/api/v1/characters", { token: owner.ownerToken, body: fullBody() });
    const id = created.body.character.characterId;
    for (const [method, path, body] of [
      ["GET", `/api/v1/characters/${id}`, undefined],
      ["PATCH", `/api/v1/characters/${id}`, { expectedRevision: 1, directive: "steal" }],
      ["GET", `/api/v1/characters/${id}/status`, undefined],
      ["GET", `/api/v1/characters/${id}/journal`, undefined],
      ["POST", `/api/v1/characters/${id}/unleash`, { expectedRevision: 1 }],
      ["PUT", `/api/v1/characters/${id}/mind-secret`, { expectedRevision: 1, secret: "sk-other" }],
    ] as const) {
      const res = await http.call(method, path, { token: intruder.ownerToken, ...(body !== undefined ? { body } : {}) });
      assert.equal(res.status, 404, `${method} ${path}`);
      assert.equal(res.body.error.code, "NOT_FOUND");
    }
    const list = await http.call("GET", "/api/v1/characters", { token: intruder.ownerToken });
    assert.deepEqual(list.body.characters, []);
    const noAuth = await http.call("GET", "/api/v1/characters");
    assert.equal(noAuth.status, 401);
    const badAuth = await http.call("GET", "/api/v1/characters", { token: "ehk_wrong" });
    assert.equal(badAuth.status, 401);
  } finally { await http.close(); cleanup(host); }
});

test("revision CAS: stale expectedRevision conflicts, fresh succeeds", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  try {
    const account = await newAccount(http);
    const created = await http.call("POST", "/api/v1/characters", { token: account.ownerToken, body: fullBody() });
    const id = created.body.character.characterId;
    const stale = await http.call("PATCH", `/api/v1/characters/${id}`, { token: account.ownerToken, body: { expectedRevision: 99, directive: "New orders." } });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, "REVISION_CONFLICT");
    const fresh = await http.call("PATCH", `/api/v1/characters/${id}`, { token: account.ownerToken, body: { expectedRevision: 1, directive: "New orders.", roleId: "smith" } });
    assert.equal(fresh.status, 200);
    assert.equal(fresh.body.character.revision, 2);
    assert.equal(fresh.body.character.directive, "New orders.");
    assert.equal(fresh.body.character.roleId, "smith");
    const missingCas = await http.call("PATCH", `/api/v1/characters/${id}`, { token: account.ownerToken, body: { directive: "No CAS." } });
    assert.equal(missingCas.status, 409);
  } finally { await http.close(); cleanup(host); }
});

test("mind-secret lifecycle: encrypted at rest, hint-only reads, recall gate on delete", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  try {
    const account = await newAccount(http);
    const created = await http.call("POST", "/api/v1/characters", { token: account.ownerToken, body: { ...fullBody(), apiKey: undefined } });
    const id = created.body.character.characterId;
    assert.equal(created.body.character.lifecycle, "draft");
    assert.equal(created.body.publicMind.secretHint, null);
    const put = await http.call("PUT", `/api/v1/characters/${id}/mind-secret`, { token: account.ownerToken, body: { expectedRevision: 1, secret: SECRET_VALUE } });
    assert.equal(put.status, 204);
    const after = await http.call("GET", `/api/v1/characters/${id}`, { token: account.ownerToken });
    assert.equal(after.body.publicMind.secretHint, "configured");
    assert.equal(after.body.character.lifecycle, "ready");
    assert.ok(!after.text.includes(SECRET_VALUE));
    const stored = readFileSync(join(host.dataDir, "secrets", `${id}.enc`), "utf8");
    assert.ok(!stored.includes(SECRET_VALUE), "secret must be encrypted at rest");
    const unleash = await http.call("POST", `/api/v1/characters/${id}/unleash`, { token: account.ownerToken, body: { expectedRevision: 2 } });
    assert.equal(unleash.status, 200);
    const gatedDelete = await http.call("DELETE", `/api/v1/characters/${id}/mind-secret`, { token: account.ownerToken, body: { expectedRevision: 3 } });
    assert.equal(gatedDelete.status, 409);
    assert.equal(gatedDelete.body.error.code, "RECALL_REQUIRED");
    const recall = await http.call("POST", `/api/v1/characters/${id}/recall`, { token: account.ownerToken, body: { expectedRevision: 3 } });
    assert.equal(recall.status, 200);
    const del = await http.call("DELETE", `/api/v1/characters/${id}/mind-secret`, { token: account.ownerToken, body: { expectedRevision: 4 } });
    assert.equal(del.status, 204);
    const gone = await http.call("GET", `/api/v1/characters/${id}`, { token: account.ownerToken });
    assert.equal(gone.body.publicMind.secretHint, null);
    assert.equal(gone.body.character.lifecycle, "draft");
  } finally { await http.close(); cleanup(host); }
});

test('restart without operator key: protected mind cannot unleash', async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  let ownerToken = ''; let id = '';
  try {
    const account = await newAccount(http);
    ownerToken = account.ownerToken;
    const created = await http.call('POST', '/api/v1/characters', { token: ownerToken, body: fullBody() });
    id = created.body.character.characterId;
    const unleash = await http.call('POST', '/api/v1/characters/' + id + '/unleash', { token: ownerToken, body: { expectedRevision: 1 } });
    assert.equal(unleash.status, 200);
    await http.call('POST', '/api/v1/characters/' + id + '/recall', { token: ownerToken, body: { expectedRevision: 2 } });
  } finally { await http.close(); try { host.shard.stop(); } catch { /* already stopped */ } }
  const shard2 = createShard({ port: 0, seed: 20261121, dataDir: host.dataDir, keys: [] }, { log: () => {} });
  const director2 = createDirector({ dataDir: host.dataDir, shard: shard2, secretKey: null, log: () => {} });
  director2.recover();
  const transport2 = createTransport(shard2, director2);
  const port2 = await transport2.listen(0, '127.0.0.1');
  try {
    const res = await fetch('http://127.0.0.1:' + port2 + '/api/v1/characters/' + id + '/unleash', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + ownerToken, 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 3 }),
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error.code, 'PROTECTION_UNAVAILABLE');
  } finally {
    await transport2.close();
    try { shard2.stop(); } catch { /* already stopped */ }
    rmSync(host.dataDir, { recursive: true, force: true });
  }
});

test("protection unavailable: keyless host rejects secret writes with 503", async () => {
  const host = makeHost({ secretKey: null });
  const http = await makeHttp(host);
  try {
    const account = await newAccount(http);
    const withKey = await http.call("POST", "/api/v1/characters", { token: account.ownerToken, body: fullBody() });
    assert.equal(withKey.status, 503);
    assert.equal(withKey.body.error.code, "PROTECTION_UNAVAILABLE");
    const created = await http.call("POST", "/api/v1/characters", { token: account.ownerToken, body: { ...fullBody("Keyless"), apiKey: undefined } });
    assert.equal(created.status, 201);
    const id = created.body.character.characterId;
    const put = await http.call("PUT", `/api/v1/characters/${id}/mind-secret`, { token: account.ownerToken, body: { expectedRevision: 1, secret: SECRET_VALUE } });
    assert.equal(put.status, 503);
    assert.equal(put.body.error.code, "PROTECTION_UNAVAILABLE");
  } finally { await http.close(); cleanup(host); }
});

test("unleash: readiness gate, role skill injection, idempotent repeat", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  try {
    const account = await newAccount(http);
    const draft = await http.call("POST", "/api/v1/characters", { token: account.ownerToken, body: { name: "Bare" } });
    const draftId = draft.body.character.characterId;
    const gated = await http.call("POST", `/api/v1/characters/${draftId}/unleash`, { token: account.ownerToken, body: { expectedRevision: 1 } });
    assert.equal(gated.status, 409);
    assert.equal(gated.body.error.code, "CONFIG_INCOMPLETE");
    assert.ok(Array.isArray(gated.body.fields) && gated.body.fields.length > 0);
    const created = await http.call("POST", "/api/v1/characters", { token: account.ownerToken, body: fullBody() });
    const id = created.body.character.characterId;
    const unleash = await http.call("POST", `/api/v1/characters/${id}/unleash`, { token: account.ownerToken, body: { expectedRevision: 1 } });
    assert.equal(unleash.status, 200);
    assert.equal(unleash.body.lifecycle, "unleashed");
    assert.equal(typeof unleash.body.agentId, "string");
    assert.equal(typeof unleash.body.startedTick, "number");
    assert.ok(host.shard.hasAgent(unleash.body.agentId));
    const states = checkpointStates(host);
    const skills = states[unleash.body.agentId].skills;
    assert.ok(Object.keys(skills).length > 0, "ranger pack skills must be injected");
    const repeat = await http.call("POST", `/api/v1/characters/${id}/unleash`, { token: account.ownerToken, body: { expectedRevision: 0 } });
    assert.equal(repeat.status, 200, "already-unleashed is idempotent even with a stale revision");
    assert.equal(repeat.body.agentId, unleash.body.agentId);
    const body = host.shard.agentBody(unleash.body.agentId);
    assert.ok(body && body.hp > 0);
  } finally { await http.close(); cleanup(host); }
});

test("shard seam: existing bodies are never re-granted skills", () => {
  const host = makeHost();
  try {
    const seed = { id: "char-seam", name: "Seam", key: "seam-key", skills: { woodcutting: 30 } };
    const first = host.shard.registerAgent(seed, true);
    assert.equal(first.created, true);
    const before = checkpointStates(host)["char-seam"].skills.woodcutting;
    assert.equal(before, 30);
    const second = host.shard.registerAgent({ ...seed, skills: { woodcutting: 99 } }, true);
    assert.equal(second.created, false);
    assert.equal(checkpointStates(host)["char-seam"].skills.woodcutting, 30, "re-registration must not re-inject");
    host.shard.recallAgent("char-seam");
    assert.ok(host.shard.hasAgent("char-seam"), "recall keeps the durable body");
  } finally { cleanup(host); }
});

test("recall: not-running gate, idempotent repeat, durable body survives", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  try {
    const account = await newAccount(http);
    const created = await http.call("POST", "/api/v1/characters", { token: account.ownerToken, body: fullBody() });
    const id = created.body.character.characterId;
    const notRunning = await http.call("POST", `/api/v1/characters/${id}/recall`, { token: account.ownerToken, body: { expectedRevision: 1 } });
    assert.equal(notRunning.status, 409);
    assert.equal(notRunning.body.error.code, "NOT_RUNNING");
    await http.call("POST", `/api/v1/characters/${id}/unleash`, { token: account.ownerToken, body: { expectedRevision: 1 } });
    const recall = await http.call("POST", `/api/v1/characters/${id}/recall`, { token: account.ownerToken, body: { expectedRevision: 2 } });
    assert.equal(recall.status, 200);
    assert.equal(recall.body.lifecycle, "recalled");
    const again = await http.call("POST", `/api/v1/characters/${id}/recall`, { token: account.ownerToken, body: { expectedRevision: 3 } });
    assert.equal(again.status, 200, "already-recalled is idempotent");
    const status = await http.call("GET", `/api/v1/characters/${id}/status`, { token: account.ownerToken });
    assert.ok(status.body.body, "body persists after recall");
    const reUnleash = await http.call("POST", `/api/v1/characters/${id}/unleash`, { token: account.ownerToken, body: { expectedRevision: 3 } });
    assert.equal(reUnleash.status, 200);
  } finally { await http.close(); cleanup(host); }
});

test("restart persistence: accounts, characters, bodies, skills and journal survive", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  let accountId = ""; let ownerToken = ""; let id = ""; let agentId = "";
  try {
    const account = await newAccount(http);
    accountId = account.accountId; ownerToken = account.ownerToken;
    const created = await http.call("POST", "/api/v1/characters", { token: ownerToken, body: fullBody() });
    id = created.body.character.characterId;
    const unleash = await http.call("POST", `/api/v1/characters/${id}/unleash`, { token: ownerToken, body: { expectedRevision: 1 } });
    agentId = unleash.body.agentId;
    host.shard.step(0.05);
  } finally { await http.close(); try { host.shard.stop(); } catch { /* already stopped */ } }
  // Reopen the SAME data dir with a fresh shard + director (restart).
  const shard2 = createShard({ port: 0, seed: 20261121, dataDir: host.dataDir, keys: [] }, { log: () => {} });
  const director2 = createDirector({ dataDir: host.dataDir, shard: shard2, secretKey: randomBytes(32), log: () => {} });
  director2.recover();
  const transport2 = createTransport(shard2, director2);
  const port2 = await transport2.listen(0, "127.0.0.1");
  const call2 = async (method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
    const res = await fetch(`http://127.0.0.1:${port2}${path}`, {
      method,
      headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.body !== undefined ? { "content-type": "application/json" } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    const got = await call2("GET", `/api/v1/characters/${id}`, { token: ownerToken });
    assert.equal(got.status, 200, "owner token survives restart");
    assert.equal(got.body.character.lifecycle, "unleashed");
    assert.equal(got.body.publicMind.secretHint, "configured");
    assert.ok(shard2.hasAgent(agentId), "body recovered");
    const states = JSON.parse(shard2.checkpoint()).playerStates;
    assert.ok(Object.keys(states[agentId].skills).length > 0, "skills survive restart");
    const people = JSON.parse(shard2.checkpoint()).people.filter((p: { id: string }) => p.id === agentId);
    assert.equal(people.length, 1, "recovery must not duplicate the body");
    const journal = await call2("GET", `/api/v1/characters/${id}/journal`, { token: ownerToken });
    assert.ok(journal.body.entries.length >= 2, "journal survives restart");
    const status = await call2("GET", `/api/v1/characters/${id}/status`, { token: ownerToken });
    assert.equal(status.status, 200);
    assert.ok(status.body.body);
    void accountId;
  } finally {
    await transport2.close();
    try { shard2.stop(); } catch { /* already stopped */ }
    rmSync(host.dataDir, { recursive: true, force: true });
  }
});

test("runtime unavailable: lifecycle rolls back, body persists, retry succeeds", async () => {
  const broken: RuntimePort = {
    ensureAgent: () => ({ ok: false, reason: "no runtime" }),
    stopAgent: () => {},
    status: () => ({ driver: "none", mindState: "asleep", runtimeState: "inactive", reflexState: "ready", reasonCode: null, autopilotSince: null, lastMindExchangeTick: null, lastReflexTick: null, lastAppliedActionTick: null }),
  };
  const host = makeHost({ runtime: broken });
  const http = await makeHttp(host);
  let id = ""; let ownerToken = "";
  try {
    const account = await newAccount(http);
    ownerToken = account.ownerToken;
    const created = await http.call("POST", "/api/v1/characters", { token: ownerToken, body: fullBody() });
    id = created.body.character.characterId;
    const failed = await http.call("POST", `/api/v1/characters/${id}/unleash`, { token: ownerToken, body: { expectedRevision: 1 } });
    assert.equal(failed.status, 503);
    assert.equal(failed.body.error.code, "RUNTIME_UNAVAILABLE");
    const after = await http.call("GET", `/api/v1/characters/${id}`, { token: ownerToken });
    assert.equal(after.body.character.lifecycle, "recalled");
  } finally { await http.close(); cleanup(host); }
  // Restart with a working runtime; the spawned body must not be re-injected.
  const shard2 = createShard({ port: 0, seed: 20261121, dataDir: host.dataDir, keys: [] }, { log: () => {} });
  const director2 = createDirector({ dataDir: host.dataDir, shard: shard2, secretKey: randomBytes(32), log: () => {} });
  director2.recover();
  try {
    const accountRow = JSON.parse(readFileSync(join(host.dataDir, "accounts.json"), "utf8")).accounts[0];
    const retry = director2.unleash(accountRow.id, id, { expectedRevision: 3 });
    assert.equal(retry.lifecycle, "unleashed");
    assert.ok(shard2.hasAgent(retry.agentId));
  } finally {
    try { shard2.stop(); } catch { /* already stopped */ }
    rmSync(host.dataDir, { recursive: true, force: true });
  }
});

test("journal pagination and cursor validation", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  try {
    const account = await newAccount(http);
    const created = await http.call("POST", "/api/v1/characters", { token: account.ownerToken, body: fullBody() });
    const id = created.body.character.characterId;
    await http.call("POST", `/api/v1/characters/${id}/unleash`, { token: account.ownerToken, body: { expectedRevision: 1 } });
    await http.call("POST", `/api/v1/characters/${id}/recall`, { token: account.ownerToken, body: { expectedRevision: 2 } });
    const page1 = await http.call("GET", `/api/v1/characters/${id}/journal?after=0&limit=2`, { token: account.ownerToken });
    assert.equal(page1.body.entries.length, 2);
    assert.equal(page1.body.nextCursor, 2);
    const page2 = await http.call("GET", `/api/v1/characters/${id}/journal?after=2&limit=2`, { token: account.ownerToken });
    assert.equal(page2.body.entries.length, 1);
    assert.equal(page2.body.nextCursor, null);
    assert.equal(page2.body.entries[0].sequence, 3);
    for (const entry of [...page1.body.entries, ...page2.body.entries]) {
      assert.deepEqual(Object.keys(entry).sort(), ["sequence", "source", "text", "tick"]);
      assert.ok(entry.source === "mind" || entry.source === "system");
    }
    const bad = await http.call("GET", `/api/v1/characters/${id}/journal?after=-1`, { token: account.ownerToken });
    assert.equal(bad.status, 422);
  } finally { await http.close(); cleanup(host); }
});

test("status projection carries runtime overlay, body and journal tail", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  try {
    const account = await newAccount(http);
    const created = await http.call("POST", "/api/v1/characters", { token: account.ownerToken, body: fullBody() });
    const id = created.body.character.characterId;
    const before = await http.call("GET", `/api/v1/characters/${id}/status`, { token: account.ownerToken });
    assert.equal(before.status, 200);
    assert.equal(before.body.characterId, id);
    assert.equal(before.body.lifecycle, "ready");
    assert.equal(before.body.driver, "none");
    assert.equal(before.body.body, null);
    assert.ok(Array.isArray(before.body.journalTail));
    await http.call("POST", `/api/v1/characters/${id}/unleash`, { token: account.ownerToken, body: { expectedRevision: 1 } });
    const after = await http.call("GET", `/api/v1/characters/${id}/status`, { token: account.ownerToken });
    assert.equal(after.body.lifecycle, "unleashed");
    assert.ok(after.body.body && typeof after.body.body.hp === "number");
    assert.equal(typeof after.body.configRevision, "number");
    assert.ok(after.body.journalTail.length >= 2);
  } finally { await http.close(); cleanup(host); }
});

test("origin guard on mutations; GET stays open", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  try {
    const evil = await http.call("POST", "/api/v1/accounts", { body: {}, headers: { origin: "https://evil.example" } });
    assert.equal(evil.status, 403);
    assert.equal(evil.body.error.code, "FORBIDDEN");
    const allowed = await http.call("POST", "/api/v1/accounts", { body: {}, headers: { origin: "http://localhost:5173" } });
    assert.equal(allowed.status, 201);
    const roles = await http.call("GET", "/api/v1/roles", { headers: { origin: "https://evil.example" } });
    assert.equal(roles.status, 200);
  } finally { await http.close(); cleanup(host); }
});

test("account creation rate limit", async () => {
  const host = makeHost({ rateLimits: { accountCreatePerHour: 2 } });
  const http = await makeHttp(host);
  try {
    await newAccount(http);
    await newAccount(http);
    const third = await http.call("POST", "/api/v1/accounts", { body: {} });
    assert.equal(third.status, 429);
    assert.equal(third.body.error.code, "RATE_LIMITED");
  } finally { await http.close(); cleanup(host); }
});

test("directive route updates with CAS and gates empty writes while unleashed", async () => {
  const host = makeHost();
  const http = await makeHttp(host);
  try {
    const account = await newAccount(http);
    const created = await http.call("POST", "/api/v1/characters", { token: account.ownerToken, body: fullBody() });
    const id = created.body.character.characterId;
    const updated = await http.call("POST", `/api/v1/characters/${id}/directive`, { token: account.ownerToken, body: { expectedRevision: 1, directive: "Fish the starter pond at dawn." } });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.character.directive, "Fish the starter pond at dawn.");
    assert.equal(updated.body.character.revision, 2);
    await http.call("POST", `/api/v1/characters/${id}/unleash`, { token: account.ownerToken, body: { expectedRevision: 2 } });
    const empty = await http.call("POST", `/api/v1/characters/${id}/directive`, { token: account.ownerToken, body: { expectedRevision: 3, directive: "   " } });
    assert.equal(empty.status, 409);
    assert.equal(empty.body.error.code, "RECALL_REQUIRED");
    const missing = await http.call("POST", `/api/v1/characters/${id}/directive`, { token: account.ownerToken, body: { expectedRevision: 3 } });
    assert.equal(missing.status, 422);
  } finally { await http.close(); cleanup(host); }
});