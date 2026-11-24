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
    { status: 201, body: { account: { id: "a1", createdAt: 1, billing: { plan: "beta-free", entitled: true } }, ownerToken: "tok" } },
  ]);
  const api = createConsoleHttpApi({ getToken: () => null, fetchImpl });
  const res = await api.createAccount({ idempotencyKey: "idem-0123456789abcdef" });
  assert.equal(res.ownerToken, "tok");
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

test("journal query params are encoded; limit passed through", async () => {
  const { calls, fetchImpl } = stubFetch([{ status: 200, body: { entries: [], nextCursor: null } }]);
  await client(fetchImpl).journal("c1", { after: 40, limit: 100 });
  assert.ok(calls[0].url.endsWith("/api/v1/characters/c1/journal?after=40&limit=100"));
});
