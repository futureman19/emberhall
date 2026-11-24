/**
 * The v1 mock host is the console's contract reference: idempotency,
 * closed-key validation, write-validation vs readiness, the unleash state
 * machine, secret handling, ownership isolation, and truthful sleep/degraded
 * overlays. The live host must answer these same shapes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConsoleApiError } from "./console-api.ts";
import { createMockConsoleApi } from "./console-mock.ts";

const KEY = "idem-key-0123456789abcdef";

function harness() {
  let token: string | null = null;
  const { api, controls } = createMockConsoleApi({ getToken: () => token });
  return {
    api,
    controls,
    setToken: (t: string | null) => {
      token = t;
    },
    getToken: () => token,
  };
}

async function makeAccount(h: ReturnType<typeof harness>) {
  const res = await h.api.createAccount({ idempotencyKey: KEY });
  h.setToken(res.ownerToken);
  return res;
}

async function makeReadyCloudCharacter(h: ReturnType<typeof harness>, name = "Wren") {
  // Name-scoped key: two different characters in ONE harness must not share
  // an idempotency key (same key + different payload is a 409 by contract).
  const created = await h.api.createCharacter({ idempotencyKey: `${KEY}-c-${name}`, name });
  const id = created.character.id;
  let v = await h.api.patchCharacter(id, { roleId: "ranger", expectedRevision: 1 });
  v = await h.api.patchCharacter(id, { directive: "Chop, sell, eat, sleep.", expectedRevision: v.character.revision });
  v = await h.api.patchCharacter(id, {
    mind: { kind: "cloud", provider: "openai-compatible", model: "gpt-4o-mini" },
    expectedRevision: v.character.revision,
  });
  await h.api.putMindSecret(id, { secret: "sk-test-key-123456", expectedRevision: v.character.revision });
  return h.api.getCharacter(id);
}

test("account create is idempotent: replay returns the same account and token", async () => {
  const h = harness();
  const a = await h.api.createAccount({ idempotencyKey: KEY });
  const b = await h.api.createAccount({ idempotencyKey: KEY });
  assert.equal(a.account.id, b.account.id);
  assert.equal(a.ownerToken, b.ownerToken);
  assert.equal(h.controls.counts().accounts, 1);
  assert.equal(a.account.billing.entitled, true); // beta free — never a gate
});

test("same idempotency key with a different payload conflicts 409", async () => {
  const h = harness();
  await makeAccount(h);
  await h.api.createCharacter({ idempotencyKey: `${KEY}-x`, name: "First" });
  await assert.rejects(
    () => h.api.createCharacter({ idempotencyKey: `${KEY}-x`, name: "Second" }),
    (e: unknown) => e instanceof ConsoleApiError && e.status === 409 && e.code === "IDEMPOTENCY_CONFLICT",
  );
  assert.equal(h.controls.counts().characters, 1);
});

test("short or missing Idempotency-Key is rejected", async () => {
  const h = harness();
  await assert.rejects(
    () => h.api.createAccount({ idempotencyKey: "short" }),
    (e: unknown) => e instanceof ConsoleApiError && e.status === 422,
  );
});

test("name-only draft saves; readiness is a separate bar", async () => {
  const h = harness();
  await makeAccount(h);
  const v = await h.api.createCharacter({ idempotencyKey: `${KEY}-c`, name: "Drafty" });
  assert.equal(v.character.lifecycle, "draft");
  assert.equal(v.character.roleId, null);
  await assert.rejects(
    () => h.api.unleash(v.character.id, { expectedRevision: 1 }),
    (e: unknown) => {
      assert.ok(e instanceof ConsoleApiError);
      assert.equal(e.code, "CONFIG_INCOMPLETE");
      const fields = e.fields?.map((f) => f.field) ?? [];
      assert.ok(fields.includes("roleId") && fields.includes("directive") && fields.includes("mind"));
      return true;
    },
  );
});

test("write validation: name, role, directive, URL, closed-key mind, model", async () => {
  const h = harness();
  await makeAccount(h);
  const v = await h.api.createCharacter({ idempotencyKey: `${KEY}-c`, name: "Testy" });
  const id = v.character.id;

  // name too long / duplicate (case-insensitive)
  await assert.rejects(
    () => h.api.patchCharacter(id, { name: "x".repeat(33), expectedRevision: 1 }),
    (e: unknown) => e instanceof ConsoleApiError && e.status === 422 && e.fields?.[0]?.code === "TOO_LONG",
  );
  await h.api.createCharacter({ idempotencyKey: `${KEY}-c2`, name: "Other" });
  await assert.rejects(
    () => h.api.patchCharacter(id, { name: "other", expectedRevision: 1 }),
    (e: unknown) => e instanceof ConsoleApiError && e.fields?.[0]?.code === "NAME_TAKEN",
  );

  // unknown role
  await assert.rejects(
    () => h.api.patchCharacter(id, { roleId: "wizard" as never, expectedRevision: 1 }),
    (e: unknown) => e instanceof ConsoleApiError && e.fields?.[0]?.code === "UNKNOWN_ROLE",
  );

  // directive too long
  await assert.rejects(
    () => h.api.patchCharacter(id, { directive: "d".repeat(2001), expectedRevision: 1 }),
    (e: unknown) => e instanceof ConsoleApiError && e.fields?.[0]?.field === "directive",
  );

  // URL rules: scheme, userinfo, query/fragment
  for (const [url, code] of [
    ["ftp://host/v1", "BAD_SCHEME"],
    ["https://user:pass@host/v1", "USERINFO"],
    ["https://host/v1?key=1", "URL_PARTS"],
    ["not-a-url", "BAD_URL"],
  ] as const) {
    await assert.rejects(
      () =>
        h.api.patchCharacter(id, {
          mind: { kind: "local", endpointUrl: url, model: "m" },
          expectedRevision: 1,
        }),
      (e: unknown) => e instanceof ConsoleApiError && e.fields?.some((f) => f.code === code) === true,
    );
  }

  // secrets embedded in config are rejected, never persisted
  await assert.rejects(
    () =>
      h.api.patchCharacter(id, {
        mind: { kind: "cloud", provider: "openai-compatible", apiKey: "sk-embedded" } as never,
        expectedRevision: 1,
      }),
    (e: unknown) => e instanceof ConsoleApiError && e.fields?.[0]?.code === "UNKNOWN_KEY",
  );

  // model bounds
  await assert.rejects(
    () =>
      h.api.patchCharacter(id, {
        mind: { kind: "local", endpointUrl: "http://127.0.0.1:11434/v1", model: " ".repeat(129) },
        expectedRevision: 1,
      }),
    (e: unknown) => e instanceof ConsoleApiError && e.fields?.[0]?.code === "MODEL_LENGTH",
  );
});

test("whitespace directive saves as draft but blocks unleash", async () => {
  const h = harness();
  await makeAccount(h);
  const created = await h.api.createCharacter({ idempotencyKey: `${KEY}-c`, name: "Spacy" });
  const id = created.character.id;
  let v = await h.api.patchCharacter(id, { roleId: "mule", expectedRevision: 1 });
  v = await h.api.patchCharacter(id, { directive: "   ", expectedRevision: v.character.revision });
  assert.equal(v.character.directive, "   ");
  assert.equal(v.character.lifecycle, "draft");
  await assert.rejects(
    () => h.api.unleash(id, { expectedRevision: v.character.revision }),
    (e: unknown) =>
      e instanceof ConsoleApiError && e.code === "CONFIG_INCOMPLETE" && e.fields?.some((f) => f.field === "directive") === true,
  );
});

test("cloud readiness demands model and stored key; secret never serializes", async () => {
  const h = harness();
  await makeAccount(h);
  const created = await h.api.createCharacter({ idempotencyKey: `${KEY}-c`, name: "Nimbus" });
  const id = created.character.id;
  let v = await h.api.patchCharacter(id, { roleId: "smith", expectedRevision: 1 });
  v = await h.api.patchCharacter(id, { directive: "Mine and smith.", expectedRevision: v.character.revision });
  v = await h.api.patchCharacter(id, {
    mind: { kind: "cloud", provider: "openai-compatible" },
    expectedRevision: v.character.revision,
  });
  await assert.rejects(
    () => h.api.unleash(id, { expectedRevision: v.character.revision }),
    (e: unknown) => {
      const fields = (e as ConsoleApiError).fields?.map((f) => f.field) ?? [];
      assert.ok(fields.includes("mind.model") && fields.includes("mind.key"));
      return true;
    },
  );
  await h.api.putMindSecret(id, { secret: "sk-super-secret-value", expectedRevision: v.character.revision });
  v = await h.api.getCharacter(id);
  // missing model still blocks
  await assert.rejects(() => h.api.unleash(id, { expectedRevision: v.character.revision }), ConsoleApiError);
  v = await h.api.patchCharacter(id, {
    mind: { kind: "cloud", provider: "openai-compatible", model: "gpt-4o-mini" },
    expectedRevision: v.character.revision,
  });
  assert.equal(v.publicMind?.secretHint, "configured");
  const serialized = JSON.stringify(v);
  assert.equal(serialized.includes("sk-super-secret-value"), false);
  assert.equal(serialized.includes("secret-value"), false);
  assert.equal(v.character.lifecycle, "ready");
});

test("local connector needs no key; valid offline URL can still unleash", async () => {
  const h = harness();
  await makeAccount(h);
  const created = await h.api.createCharacter({ idempotencyKey: `${KEY}-c`, name: "Bram" });
  const id = created.character.id;
  let v = await h.api.patchCharacter(id, { roleId: "ranger", expectedRevision: 1 });
  v = await h.api.patchCharacter(id, { directive: "Work the north stand.", expectedRevision: v.character.revision });
  v = await h.api.patchCharacter(id, {
    mind: { kind: "local", endpointUrl: "https://bram-tunnel.example.com/v1", model: "qwen3:8b" },
    expectedRevision: v.character.revision,
  });
  assert.equal(v.character.lifecycle, "ready");
  assert.equal(v.publicMind?.secretHint, null);
  // mind offline at unleash: warning state, NOT an activation error (S11)
  h.controls.sleepMind(id);
  const res = await h.api.unleash(id, { expectedRevision: v.character.revision });
  assert.equal(res.lifecycle, "unleashed");
  assert.equal(res.mindState, "asleep");
  assert.equal(res.driver, "reflex");
  const status = await h.api.status(id);
  assert.equal(status.autopilotSince !== null, true);
  assert.equal(status.lifecycle, "unleashed");
});

test("unleash is idempotent: repeated calls return the same agent, even stale revision", async () => {
  const h = harness();
  await makeAccount(h);
  const v = await makeReadyCloudCharacter(h);
  const id = v.character.id;
  const first = await h.api.unleash(id, { expectedRevision: v.character.revision });
  const second = await h.api.unleash(id, { expectedRevision: v.character.revision }); // stale
  assert.equal(first.agentId, second.agentId);
  const status = await h.api.status(id);
  assert.equal(status.lifecycle, "unleashed");
  assert.equal(status.driver, "mind");
  assert.equal(status.mindState, "awake");
});

test("unleash from draft refuses; runtime gate is the only 503", async () => {
  const h = harness();
  await makeAccount(h);
  const created = await h.api.createCharacter({ idempotencyKey: `${KEY}-c`, name: "Early" });
  await assert.rejects(
    () => h.api.unleash(created.character.id, { expectedRevision: 1 }),
    (e: unknown) => e instanceof ConsoleApiError && e.status === 422 && e.code === "CONFIG_INCOMPLETE",
  );
  const v = await makeReadyCloudCharacter(h, "Gated");
  h.controls.setReflexReady(false);
  await assert.rejects(
    () => h.api.unleash(v.character.id, { expectedRevision: v.character.revision }),
    (e: unknown) => e instanceof ConsoleApiError && e.status === 503 && e.code === "RUNTIME_UNAVAILABLE",
  );
});

test("revision conflicts are distinct from validation", async () => {
  const h = harness();
  await makeAccount(h);
  const created = await h.api.createCharacter({ idempotencyKey: `${KEY}-c`, name: "Revvy" });
  const id = created.character.id;
  await h.api.patchCharacter(id, { directive: "First.", expectedRevision: 1 });
  await assert.rejects(
    () => h.api.patchCharacter(id, { directive: "Second.", expectedRevision: 1 }),
    (e: unknown) => e instanceof ConsoleApiError && e.status === 409 && e.code === "REVISION_CONFLICT",
  );
});

test("recall: unleashed→recalled, idempotent, NOT_RUNNING from draft", async () => {
  const h = harness();
  await makeAccount(h);
  const v = await makeReadyCloudCharacter(h, "Cally");
  const id = v.character.id;
  await assert.rejects(
    () => h.api.recall(id, { expectedRevision: v.character.revision }),
    (e: unknown) => e instanceof ConsoleApiError && e.code === "NOT_RUNNING",
  );
  await h.api.unleash(id, { expectedRevision: v.character.revision });
  const fresh = await h.api.getCharacter(id);
  const r = await h.api.recall(id, { expectedRevision: fresh.character.revision });
  assert.equal(r.lifecycle, "recalled");
  const again = await h.api.recall(id, { expectedRevision: 1 }); // stale: no-op success
  assert.equal(again.lifecycle, "recalled");
  const status = await h.api.status(id);
  assert.equal(status.driver, "none");
  assert.equal(status.runtimeState, "inactive");
});

test("deleting a live key demands recall first", async () => {
  const h = harness();
  await makeAccount(h);
  const v = await makeReadyCloudCharacter(h, "Keyed");
  const id = v.character.id;
  await h.api.unleash(id, { expectedRevision: v.character.revision });
  const fresh = await h.api.getCharacter(id);
  await assert.rejects(
    () => h.api.deleteMindSecret(id, { expectedRevision: fresh.character.revision }),
    (e: unknown) => e instanceof ConsoleApiError && e.code === "RECALL_REQUIRED",
  );
});

test("ownership isolation: foreign ids are indistinguishable 404; bad token 401", async () => {
  const h1 = harness();
  await makeAccount(h1);
  const mine = await h1.api.createCharacter({ idempotencyKey: `${KEY}-c`, name: "Mine" });

  const h2 = harness();
  await makeAccount(h2);
  await assert.rejects(
    () => h2.api.getCharacter(mine.character.id),
    (e: unknown) => e instanceof ConsoleApiError && e.status === 404,
  );
  await assert.rejects(() => h2.api.status(mine.character.id), ConsoleApiError);

  h2.setToken("mtok-forged");
  await assert.rejects(
    () => h2.api.listCharacters(),
    (e: unknown) => e instanceof ConsoleApiError && e.status === 401,
  );
});

test("sleep/wake appends one marked line each; outage is degraded, not autopilot", async () => {
  const h = harness();
  await makeAccount(h);
  const created = await h.api.createCharacter({ idempotencyKey: `${KEY}-c`, name: "Bram" });
  const id = created.character.id;
  let v = await h.api.patchCharacter(id, { roleId: "ranger", expectedRevision: 1 });
  v = await h.api.patchCharacter(id, { directive: "Chop.", expectedRevision: v.character.revision });
  v = await h.api.patchCharacter(id, {
    mind: { kind: "local", endpointUrl: "https://tunnel.example.com/v1", model: "qwen3:8b" },
    expectedRevision: v.character.revision,
  });
  await h.api.unleash(id, { expectedRevision: v.character.revision });
  h.controls.sleepMind(id);
  let status = await h.api.status(id);
  assert.equal(status.mindState, "asleep");
  assert.equal(status.driver, "reflex");
  const sleepLines = status.journalTail.filter((l) => l.startsWith("(autopilot)"));
  assert.equal(sleepLines.length, 1);

  h.controls.setReflexState(id, "unavailable", "reflex-pool-down");
  status = await h.api.status(id);
  assert.equal(status.runtimeState, "degraded");
  assert.equal(status.driver, "none");
  assert.equal(status.reflexState, "unavailable");

  h.controls.setReflexState(id, "ready");
  h.controls.wakeMind(id);
  status = await h.api.status(id);
  assert.equal(status.mindState, "awake");
  assert.equal(status.driver, "mind");
  assert.equal(status.autopilotSince, null);
});

test("journal pages with cursor; billing never consulted anywhere", async () => {
  const h = harness();
  const { account } = await makeAccount(h);
  const v = await makeReadyCloudCharacter(h, "Pages");
  const id = v.character.id;
  await h.api.unleash(id, { expectedRevision: v.character.revision });
  const page = await h.api.journal(id, { after: 0, limit: 1 });
  assert.equal(page.entries.length, 1);
  assert.equal(account.billing.plan, "beta-free");
});
