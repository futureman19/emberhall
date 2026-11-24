/**
 * HTTP client conformance for the v1 console API: headers, idempotency,
 * revision bodies, error-envelope mapping, and secret-channel hygiene.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConsoleApiError, createConsoleHttpApi } from "./console-api.ts";

interface CapturedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  cache: string | undefined;
}

function stubFetch(responses: { status: number; body?: unknown }[]): { calls: CapturedCall[]; fetchImpl: typeof fetch } {
  const calls: CapturedCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const next = responses.shift();
    if (!next) throw new Error("no stubbed response left");
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      cache: init?.cache,
    });
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), {
      status: next.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const TOKEN = "owner-token-abc";

function client(fetchImpl: typeof fetch) {
  return createConsoleHttpApi({ getToken: () => TOKEN, fetchImpl });
}

test("account create sends Idempotency-Key and no Authorization", async () => {
  const { calls, fetchImpl } = stubFetch([
    { status: 201, body: { accountId: "a1", billing: { plan: "beta-free", entitled: true }, ownerToken: "tok" } },
  ]);
  const api = createConsoleHttpApi({ getToken: () => null, fetchImpl });
  const res = await api.createAccount({ idempotencyKey: "idem-0123456789abcdef" });
  assert.equal(res.ownerToken, "tok");
  assert.deepEqual(res.account, { id: "a1", createdAt: 0, billing: { plan: "beta-free", entitled: true } });
  assert.equal(calls[0].headers["idempotency-key"], "idem-0123456789abcdef");
  assert.equal(calls[0].headers["authorization"], undefined);
  assert.equal(calls[0].cache, "no-store");
});

test("authenticated calls attach the bearer and never log it", async () => {
  const { calls, fetchImpl } = stubFetch([{ status: 200, body: { characters: [] } }]);
  await client(fetchImpl).listCharacters();
  assert.equal(calls[0].headers["authorization"], `Bearer ${TOKEN}`);
});

test("unleash posts expectedRevision in the request body", async () => {
  const { calls, fetchImpl } = stubFetch([
    { status: 200, body: { characterId: "c1", lifecycle: "unleashed", agentId: "ag1", startedTick: 5, mindState: "awake", driver: "mind" } },
  ]);
  const res = await client(fetchImpl).unleash("c1", { expectedRevision: 7 });
  assert.equal(res.agentId, "ag1");
  assert.deepEqual(calls[0].body, { expectedRevision: 7 });
});

test("mind-secret PUT returns void on 204 and sends the secret only in the body", async () => {
  const { calls, fetchImpl } = stubFetch([{ status: 204 }]);
  const out = await client(fetchImpl).putMindSecret("c1", { secret: "sk-live-xyz", expectedRevision: 3 });
  assert.equal(out, undefined);
  assert.deepEqual(calls[0].body, { secret: "sk-live-xyz", expectedRevision: 3 });
  assert.equal(calls[0].url.includes("sk-live-xyz"), false);
});

test("422 maps the v1 error envelope with fields", async () => {
  const { fetchImpl } = stubFetch([
    {
      status: 422,
      body: {
        error: { code: "CONFIG_INCOMPLETE", message: "Finish the configuration before unleashing." },
        fields: [{ field: "directive", code: "REQUIRED", message: "Write a directive." }],
      },
    },
  ]);
  await assert.rejects(
    () => client(fetchImpl).unleash("c1", { expectedRevision: 1 }),
    (e: unknown) => {
      assert.ok(e instanceof ConsoleApiError);
      assert.equal(e.status, 422);
      assert.equal(e.code, "CONFIG_INCOMPLETE");
      assert.equal(e.fields?.[0]?.field, "directive");
      assert.equal(e.recoverable, false);
      return true;
    },
  );
});

test("409 REVISION_CONFLICT and 503 recoverable map distinctly", async () => {
  const conflict = stubFetch([{ status: 409, body: { error: { code: "REVISION_CONFLICT", message: "changed" } } }]);
  await assert.rejects(client(conflict.fetchImpl).recall("c1", { expectedRevision: 1 }), (e: unknown) => {
    assert.ok(e instanceof ConsoleApiError);
    assert.equal(e.code, "REVISION_CONFLICT");
    assert.equal(e.recoverable, false);
    return true;
  });
  const unavailable = stubFetch([{ status: 503, body: { error: { code: "RUNTIME_UNAVAILABLE", message: "reflex down" } } }]);
  await assert.rejects(client(unavailable.fetchImpl).unleash("c1", { expectedRevision: 1 }), (e: unknown) => {
    assert.ok(e instanceof ConsoleApiError);
    assert.equal(e.status, 503);
    assert.equal(e.recoverable, true);
    return true;
  });
});

test("401 and indistinguishable 404 map cleanly", async () => {
  const unauth = stubFetch([{ status: 401, body: { error: { code: "UNAUTHENTICATED", message: "no" } } }]);
  await assert.rejects(client(unauth.fetchImpl).listCharacters(), (e: unknown) => {
    assert.ok(e instanceof ConsoleApiError && e.status === 401);
    return true;
  });
  const missing = stubFetch([{ status: 404, body: { error: { code: "NOT_FOUND", message: "Not found." } } }]);
  await assert.rejects(client(missing.fetchImpl).getCharacter("foreign"), (e: unknown) => {
    assert.ok(e instanceof ConsoleApiError && e.status === 404 && e.code === "NOT_FOUND");
    return true;
  });
});

test("network failure surfaces as recoverable status-0 error", async () => {
  const fetchImpl = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  await assert.rejects(client(fetchImpl).listCharacters(), (e: unknown) => {
    assert.ok(e instanceof ConsoleApiError);
    assert.equal(e.status, 0);
    assert.equal(e.code, "NETWORK");
    assert.equal(e.recoverable, true);
    return true;
  });
});

test("real host HTTP preserves console view shapes through the owner lifecycle", async () => {
  // Real registry, encrypted secret storage, shard and HTTP routes; explicitly
  // passive runtime means this contract regression never calls a model provider.
  const { mkdtempSync, mkdirSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { randomBytes } = await import("node:crypto");
  const { createShard } = await import("../server/shard.ts");
  const { createTransport } = await import("../server/ws.ts");
  const { createDirector, passiveRuntimePort } = await import("../server/accounts.ts");
  const scratch = process.env.TMPDIR ?? join(process.cwd(), ".hermes", "scratch");
  mkdirSync(scratch, { recursive: true });
  const dataDir = mkdtempSync(join(scratch, "console-host-contract-"));
  const shard = createShard({ port: 0, seed: 20261121, dataDir, keys: [] }, { log: () => {} });
  const director = createDirector({ dataDir, shard, secretKey: randomBytes(32), runtime: passiveRuntimePort, log: () => {} });
  const transport = createTransport(shard, director);
  let token: string | null = null;
  try {
    const port = await transport.listen(0, "127.0.0.1");
    const api = createConsoleHttpApi({ baseUrl: `http://127.0.0.1:${port}`, getToken: () => token });
    const account = await api.createAccount({ idempotencyKey: "console-account-0123456789" });
    assert.ok(account.account.id);
    assert.equal(account.account.createdAt, 0, "host omits creation time; zero denotes unknown, not client time");
    assert.deepEqual(account.account.billing, { plan: "beta-free", entitled: true });
    assert.deepEqual(await api.createAccount({ idempotencyKey: "console-account-0123456789" }), account);
    token = account.ownerToken;
    const roles = await api.listRoles();
    assert.equal(roles.version, 1);
    assert.deepEqual(roles.packs.map(role => role.id).sort(), ["banker", "mule", "ranger", "smith"]);
    assert.ok(roles.packs.every(role => role.file && Object.keys(role.startingSkills).length));
    let view = await api.createCharacter({ idempotencyKey: "console-character-0123456789", name: "Wren" });
    const id = view.character.id;
    assert.ok(id);
    assert.equal(view.character.accountId, account.account.id);
    assert.equal(view.character.lifecycle, "draft");
    assert.equal(view.publicMind, null);
    assert.equal("characterId" in view.character, false);
    assert.deepEqual((await api.listCharacters()).characters, [view]);
    assert.deepEqual(await api.getCharacter(id), view);
    view = await api.patchCharacter(id, {
      expectedRevision: view.character.revision, roleId: "ranger", directive: "Gather oak logs.",
      mind: { kind: "cloud", provider: "openai-compatible", model: "contract-test-model" },
    });
    assert.equal(view.character.id, id);
    assert.equal(view.character.directive, "Gather oak logs.");
    assert.equal(view.publicMind?.secretHint, null);
    const beforeSecret = view.character.revision;
    const secret = "contract-only-not-a-provider-key";
    assert.equal(await api.putMindSecret(id, { expectedRevision: beforeSecret, secret }), undefined);
    view = await api.getCharacter(id);
    assert.equal(view.character.revision, beforeSecret + 1);
    assert.equal(view.publicMind?.secretHint, "configured");
    assert.equal(view.character.lifecycle, "ready");
    assert.equal(JSON.stringify(view).includes(secret), false);
    const unleashed = await api.unleash(id, { expectedRevision: view.character.revision });
    assert.equal(unleashed.characterId, id);
    assert.equal(unleashed.lifecycle, "unleashed");
    assert.ok(unleashed.agentId);
    view = await api.getCharacter(id);
    assert.equal(view.character.lifecycle, "unleashed");
    const status = await api.status(id);
    assert.equal(status.characterId, id);
    assert.equal(status.configRevision, view.character.revision);
    assert.ok((await api.journal(id)).entries.length);
    assert.equal((await api.recall(id, { expectedRevision: view.character.revision })).lifecycle, "recalled");
    view = await api.getCharacter(id);
    assert.equal(view.character.lifecycle, "recalled");
    const beforeDelete = view.character.revision;
    assert.equal(await api.deleteMindSecret(id, { expectedRevision: beforeDelete }), undefined);
    view = await api.getCharacter(id);
    assert.equal(view.character.revision, beforeDelete + 1);
    assert.equal(view.publicMind?.secretHint, null);
    assert.deepEqual((await api.listCharacters()).characters, [view]);
  } finally {
    await transport.close();
    shard.stop();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("journal query params are encoded; limit passed through", async () => {
  const { calls, fetchImpl } = stubFetch([{ status: 200, body: { entries: [], nextCursor: null } }]);
  await client(fetchImpl).journal("c1", { after: 40, limit: 100 });
  assert.ok(calls[0].url.endsWith("/api/v1/characters/c1/journal?after=40&limit=100"));
});
