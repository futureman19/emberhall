/**
 * Phase 4 contract vectors — validators, lifecycle machine, copy locks.
 * Pure and fast: no world, no live state, no network.
 * Normative spec: docs/phase-4-contracts-v1.md.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activationAllowed,
  AUTOPILOT_COPY,
  BETA_BILLING,
  CLOUD_PROVIDERS,
  DEFAULT_CLOUD_BASE_URL,
  DIRECTIVE_MAX,
  effectiveModel,
  isCloudProvider,
  isPrivateHostLiteral,
  isRoleId,
  mindBaseUrl,
  MODEL_MAX,
  NAME_MAX,
  nextLifecycle,
  readinessErrors,
  ROLE_IDS,
  validateDirective,
  validateEndpointUrl,
  validateMindConfig,
  validateName,
  type Character,
  type PublicMind,
  type ReadinessContext,
} from "./account.ts";

const DEV: ReadinessContext = {
  hasMindSecret: false,
  defaultModel: null,
  allowPrivateEndpoints: true,
};
const HOSTED: ReadinessContext = {
  hasMindSecret: false,
  defaultModel: null,
  allowPrivateEndpoints: false,
};

function draftCharacter(overrides: Partial<Character> = {}): Character {
  return {
    characterId: "char-1",
    accountId: "acct-1",
    name: "Wren",
    roleId: "ranger",
    directive: "Chop, sell, eat, sleep. Stay out of trouble.",
    mind: { kind: "local", endpointUrl: "http://127.0.0.1:11434/v1", model: "qwen3:8b" },
    lifecycle: "ready",
    revision: 1,
    billing: BETA_BILLING,
    createdAt: 1_800_000_000_000,
    updatedAt: 1_800_000_000_000,
    unleashedAt: null,
    recalledAt: null,
    ...overrides,
  };
}

test("role ids are the closed beta set", () => {
  assert.deepEqual(ROLE_IDS, ["ranger", "smith", "banker", "mule"]);
  assert.equal(isRoleId("ranger"), true);
  assert.equal(isRoleId("warrior"), false);
  assert.equal(isRoleId(42), false);
});

test("names: required, trimmed, capped", () => {
  assert.equal(validateName("Wren"), null);
  assert.equal(validateName("")?.code, "REQUIRED");
  assert.equal(validateName("   ")?.code, "REQUIRED");
  assert.equal(validateName("x".repeat(NAME_MAX + 1))?.code, "TOO_LONG");
  assert.equal(validateName("x".repeat(NAME_MAX)), null);
});

test("directive: whitespace is a valid draft but never ready, capped", () => {
  assert.equal(validateDirective("", { required: false }), null);
  assert.equal(validateDirective("   \n ", { required: false }), null);
  assert.equal(validateDirective("", { required: true })?.code, "REQUIRED");
  assert.equal(validateDirective("   ", { required: true })?.code, "REQUIRED");
  assert.equal(validateDirective(42, { required: true })?.code, "TYPE");
  assert.equal(validateDirective("x".repeat(DIRECTIVE_MAX + 1), { required: true })?.code, "TOO_LONG");
  assert.equal(validateDirective("Chop wood.", { required: true }), null);
});

test("cloud mind: provider allowlist and optional baseUrl rules", () => {
  assert.deepEqual(validateMindConfig({ kind: "cloud", provider: "openai-compatible" }), []);
  assert.equal(
    validateMindConfig({ kind: "cloud", provider: "acme-llm" })[0]?.code,
    "UNKNOWN_PROVIDER",
  );
  assert.equal(
    validateMindConfig({ kind: "cloud", provider: "openai-compatible", baseUrl: "ftp://x" })[0]
      ?.code,
    "BAD_SCHEME",
  );
  assert.deepEqual(
    validateMindConfig({
      kind: "cloud",
      provider: "openai-compatible",
      baseUrl: "https://gateway.example.com/v1",
    }),
    [],
  );
  assert.equal(CLOUD_PROVIDERS.includes("openai-compatible"), true);
  assert.equal(isCloudProvider("openai-compatible"), true);
});

test("mind config is closed-key: unknown fields and embedded secrets rejected", () => {
  assert.equal(
    validateMindConfig({ kind: "cloud", provider: "openai-compatible", apiKey: "sk-x" })[0]?.code,
    "SECRET_IN_CONFIG",
  );
  assert.equal(
    validateMindConfig({
      kind: "local",
      endpointUrl: "https://m.example.com/v1",
      secret: "s",
    })[0]?.code,
    "SECRET_IN_CONFIG",
  );
  assert.equal(
    validateMindConfig({ kind: "cloud", provider: "openai-compatible", region: "eu" })[0]?.code,
    "UNKNOWN_FIELD",
  );
  assert.equal(validateMindConfig([{ kind: "cloud" }])[0]?.code, "TYPE");
  assert.equal(validateMindConfig("cloud")[0]?.code, "TYPE");
});

test("mind model: optional, trimmed, bounded; blank normalizes to absent", () => {
  assert.deepEqual(
    validateMindConfig({ kind: "cloud", provider: "openai-compatible", model: " gpt-4o-mini " }),
    [],
  );
  assert.deepEqual(
    validateMindConfig({ kind: "cloud", provider: "openai-compatible", model: "   " }),
    [],
  );
  assert.equal(
    validateMindConfig({ kind: "cloud", provider: "openai-compatible", model: 7 })[0]?.code,
    "TYPE",
  );
  assert.equal(
    validateMindConfig({
      kind: "cloud",
      provider: "openai-compatible",
      model: "m".repeat(MODEL_MAX + 1),
    })[0]?.code,
    "TOO_LONG",
  );
});

test("endpoint urls: no query, no fragment, metadata host always refused", () => {
  assert.equal(
    validateEndpointUrl("https://m.example.com/v1?key=1", "mind.baseUrl", HOSTED)?.code,
    "QUERY_FRAGMENT",
  );
  assert.equal(
    validateEndpointUrl("https://m.example.com/v1#x", "mind.baseUrl", HOSTED)?.code,
    "QUERY_FRAGMENT",
  );
  assert.equal(
    validateEndpointUrl("http://169.254.169.254/latest", "mind.endpointUrl", DEV)?.code,
    "METADATA_HOST",
  );
  assert.equal(isPrivateHostLiteral("169.254.169.254"), true);
  assert.equal(isPrivateHostLiteral("127.0.0.1"), true);
  assert.equal(isPrivateHostLiteral("203.0.113.10"), false);
});

test("local mind: hosted policy refuses loopback/LAN, dev policy allows", () => {
  const local = { kind: "local", endpointUrl: "http://127.0.0.1:11434/v1" };
  assert.deepEqual(validateMindConfig(local, DEV), []);
  assert.equal(validateMindConfig(local, HOSTED)[0]?.code, "PRIVATE_HOST");
  assert.equal(
    validateMindConfig({ kind: "local", endpointUrl: "http://192.168.1.20:8080/v1" })[0]?.code,
    "PRIVATE_HOST",
  );
  assert.equal(validateMindConfig({ kind: "local", endpointUrl: "" })[0]?.code, "REQUIRED");
  assert.equal(
    validateMindConfig({ kind: "local", endpointUrl: "ws://127.0.0.1:11434" }, DEV)[0]?.code,
    "BAD_SCHEME",
  );
  assert.equal(
    validateMindConfig({ kind: "local", endpointUrl: "http://user:pass@127.0.0.1:11434" }, DEV)[0]
      ?.code,
    "USERINFO",
  );
  assert.equal(validateMindConfig({ kind: "local", endpointUrl: "not a url" })[0]?.code, "BAD_URL");
  assert.equal(validateMindConfig(null)[0]?.code, "REQUIRED");
  assert.equal(validateMindConfig({ kind: "other" })[0]?.code, "UNKNOWN_KIND");
});

test("public endpoints require https outside the dev allowlist", () => {
  assert.equal(
    validateEndpointUrl("http://mind.example.com/v1", "mind.endpointUrl", HOSTED)?.code,
    "HTTPS_REQUIRED",
  );
  assert.equal(
    validateEndpointUrl("http://mind.example.com/v1", "mind.endpointUrl", DEV)?.code,
    "HTTPS_REQUIRED",
  );
  assert.equal(
    validateEndpointUrl("https://tunnel.example.com/v1", "mind.endpointUrl", HOSTED),
    null,
  );
});

test("model resolution: config value, then explicit operator default, never invented", () => {
  const cloud = { kind: "cloud", provider: "openai-compatible" } as const;
  assert.equal(effectiveModel({ ...cloud, model: " gpt-4o " }, null), "gpt-4o");
  assert.equal(effectiveModel(cloud, "host-default"), "host-default");
  assert.equal(effectiveModel(cloud, null), null);
  assert.equal(mindBaseUrl(cloud), DEFAULT_CLOUD_BASE_URL);
  assert.equal(
    mindBaseUrl({ ...cloud, baseUrl: "https://gateway.example.com/v1" }),
    "https://gateway.example.com/v1",
  );
  assert.equal(
    mindBaseUrl({ kind: "local", endpointUrl: "http://127.0.0.1:11434/v1" }),
    "http://127.0.0.1:11434/v1",
  );
});

test("readiness: draft blocks are actionable, ready passes clean", () => {
  assert.deepEqual(readinessErrors(draftCharacter(), DEV), []);
  const fields = readinessErrors(
    draftCharacter({ name: "", roleId: null, directive: "", mind: null, lifecycle: "draft" }),
    DEV,
  ).map((e) => e.field);
  assert.deepEqual(fields.sort(), ["directive", "mind", "name", "roleId"]);
  assert.equal(
    readinessErrors(draftCharacter({ roleId: "warrior" as never }), DEV)[0]?.code,
    "UNKNOWN_ROLE",
  );
});

test("readiness: cloud key and resolved model gate unleash, billing never consulted", () => {
  const cloud = draftCharacter({
    mind: { kind: "cloud", provider: "openai-compatible", model: "gpt-4o-mini" },
  });
  const codes = readinessErrors(cloud, HOSTED).map((e) => `${e.field}:${e.code}`);
  assert.deepEqual(codes, ["mind.secret:REQUIRED"]);
  assert.deepEqual(readinessErrors(cloud, { ...HOSTED, hasMindSecret: true }), []);
  const noModel = draftCharacter({ mind: { kind: "cloud", provider: "openai-compatible" } });
  const modelCodes = readinessErrors(noModel, { ...HOSTED, hasMindSecret: true }).map(
    (e) => `${e.field}:${e.code}`,
  );
  assert.deepEqual(modelCodes, ["mind.model:MODEL_REQUIRED"]);
  assert.deepEqual(
    readinessErrors(noModel, { ...HOSTED, hasMindSecret: true, defaultModel: "host-default" }),
    [],
  );
});

test("billing stub: activation is never gated in beta", () => {
  assert.equal(BETA_BILLING.entitled, true);
  assert.equal(BETA_BILLING.plan, "beta-free");
  assert.equal(
    activationAllowed({ id: "a", createdAt: 1_800_000_000_000, billing: BETA_BILLING }),
    true,
  );
});

test("lifecycle machine: unleash and recall, idempotent and refused", () => {
  assert.equal(nextLifecycle("ready", "unleash"), "unleashed");
  assert.equal(nextLifecycle("unleashed", "unleash"), "unleashed"); // idempotent
  assert.equal(nextLifecycle("recalled", "unleash"), "unleashed"); // re-unleash
  assert.equal(nextLifecycle("unleashed", "recall"), "recalled");
  assert.equal(nextLifecycle("recalled", "recall"), "recalled"); // idempotent
  assert.equal(nextLifecycle("draft", "unleash"), null); // blocked
  assert.equal(nextLifecycle("ready", "recall"), null); // nothing running
  assert.equal(nextLifecycle("draft", "recall"), null);
});

test("autopilot copy is locked and system lines are marked", () => {
  const banner = AUTOPILOT_COPY.banner("Wren");
  assert.match(banner, /Autopilot — Wren's mind is asleep/);
  assert.match(banner, /instincts keep it going/);
  assert.match(AUTOPILOT_COPY.sleepLine("Wren"), /^\(autopilot\) /);
  assert.match(AUTOPILOT_COPY.wakeLine("Wren"), /^\(autopilot\) /);
});

test("secret hint is a presence flag, never a key fragment", () => {
  // v1 forbids suffix masks: a short key must be indistinguishable from a long one.
  const configured: PublicMind["secretHint"] = "configured";
  const keyless: PublicMind["secretHint"] = null;
  assert.equal(configured, "configured");
  assert.equal(keyless, null);
});
