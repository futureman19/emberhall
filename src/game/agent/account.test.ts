/**
 * Phase 4 contract vectors — validators, lifecycle machine, copy locks.
 * Pure and fast: no world, no live state, no network.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activationAllowed,
  AUTOPILOT_COPY,
  BETA_BILLING,
  CLOUD_PROVIDERS,
  DIRECTIVE_MAX,
  isCloudProvider,
  isRoleId,
  maskSecret,
  NAME_MAX,
  nextLifecycle,
  readinessErrors,
  ROLE_IDS,
  validateDirective,
  validateMindConfig,
  validateName,
  type Character,
} from "./account.ts";

function draftCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: "char-1",
    accountId: "acct-1",
    name: "Wren",
    roleId: "ranger",
    directive: "Chop, sell, eat, sleep. Stay out of trouble.",
    mind: { kind: "local", endpointUrl: "http://127.0.0.1:11434/v1" },
    lifecycle: "ready",
    createdAt: 1,
    updatedAt: 1,
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

test("directive: optional in draft, required for ready, capped", () => {
  assert.equal(validateDirective("", { required: false }), null);
  assert.equal(validateDirective("", { required: true })?.code, "REQUIRED");
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

test("local mind: http(s) only, no userinfo, loopback and LAN allowed", () => {
  assert.deepEqual(validateMindConfig({ kind: "local", endpointUrl: "http://127.0.0.1:11434/v1" }), []);
  assert.deepEqual(validateMindConfig({ kind: "local", endpointUrl: "http://192.168.1.20:8080/v1" }), []);
  assert.equal(validateMindConfig({ kind: "local", endpointUrl: "" })[0]?.code, "REQUIRED");
  assert.equal(
    validateMindConfig({ kind: "local", endpointUrl: "ws://127.0.0.1:11434" })[0]?.code,
    "BAD_SCHEME",
  );
  assert.equal(
    validateMindConfig({ kind: "local", endpointUrl: "http://user:pass@127.0.0.1:11434" })[0]?.code,
    "USERINFO",
  );
  assert.equal(validateMindConfig({ kind: "local", endpointUrl: "not a url" })[0]?.code, "BAD_URL");
  assert.equal(validateMindConfig(null)[0]?.code, "REQUIRED");
  assert.equal(validateMindConfig({ kind: "other" })[0]?.code, "UNKNOWN_KIND");
});

test("readiness: draft blocks are actionable, ready passes clean", () => {
  assert.deepEqual(readinessErrors(draftCharacter()), []);
  const codes = readinessErrors(
    draftCharacter({ name: "", roleId: null, directive: "", mind: null, lifecycle: "draft" }),
  ).map((e) => e.field);
  assert.deepEqual(codes.sort(), ["directive", "mind", "name", "roleId"]);
  assert.equal(readinessErrors(draftCharacter({ roleId: "warrior" as never }))[0]?.code, "UNKNOWN_ROLE");
});

test("billing stub: activation is never gated in beta", () => {
  assert.equal(BETA_BILLING.entitled, true);
  assert.equal(BETA_BILLING.plan, "beta-free");
  assert.equal(activationAllowed({ id: "a", createdAt: 0, billing: BETA_BILLING }), true);
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

test("secrets mask to the last four only", () => {
  assert.equal(maskSecret("sk-live-abcdef1234w9x2"), "…w9x2");
  assert.equal(maskSecret("abcd"), "…abcd");
  assert.equal(maskSecret("sk-live-abcdef1234w9x2").includes("sk-live"), false);
});
