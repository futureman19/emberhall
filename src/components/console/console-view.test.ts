/**
 * Pure view-model conformance for the director console screen: flag parsing
 * (default OFF), runtime selection, step copy, field-error lookup, readiness
 * gating of the unleash button, truthful status labels, and source-level
 * secret hygiene of the screen itself (password fields, no billing surface).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { FieldError } from "../../game/agent/account.ts";
import type { CharacterView } from "../../lib/console-api.ts";
import { readinessChecklist } from "./console-controller.ts";
import {
  BETA_NOTE,
  CLOUD_KEY_NOTE,
  CONSOLE_STEPS,
  LOCAL_MIND_NETWORK_NOTE,
  consoleEnabled,
  directiveCounterText,
  driverLabel,
  fieldErrorFor,
  lifecycleLabel,
  mindStateLabel,
  resolveConsoleRuntimeKind,
  runtimeLabel,
  runtimeStateLabel,
  stepHeading,
  stepProgressIndex,
  unleashBlockReason,
} from "./console-view.ts";

/* ── feature flag: default off, explicit "true" only ───────────────── */

test("flag: only the exact string 'true' enables the console", () => {
  assert.equal(consoleEnabled("true"), true);
  for (const off of ["false", "", "1", "yes", undefined, null, true, false, 1]) {
    assert.equal(consoleEnabled(off), false, `flag ${JSON.stringify(off)} must stay off`);
  }
});

test("runtime: real HTTP is default; only explicit mock selects simulation", () => {
  assert.equal(resolveConsoleRuntimeKind(undefined), "http");
  assert.equal(resolveConsoleRuntimeKind("mock"), "mock");
  assert.equal(resolveConsoleRuntimeKind("http"), "http");
  assert.equal(resolveConsoleRuntimeKind("HTTP"), "http"); // closed value, no coercion
  const mockLabel = runtimeLabel("mock");
  assert.ok(mockLabel !== null && mockLabel.length > 0);
  assert.ok(/preview|mock/i.test(mockLabel)); // never imply a live shard
  assert.equal(runtimeLabel("http"), null);
});

/* ── step copy and progress ────────────────────────────────────────── */

test("steps: every console step has a distinct heading and progress slot", () => {
  const headings = CONSOLE_STEPS.map(stepHeading);
  assert.equal(new Set(headings).size, CONSOLE_STEPS.length);
  for (const h of headings) assert.ok(h.length > 0);
  const indexes = CONSOLE_STEPS.map(stepProgressIndex);
  assert.deepEqual(indexes, CONSOLE_STEPS.map((_, i) => i));
  assert.ok(CONSOLE_STEPS.includes("account") && CONSOLE_STEPS.includes("status"));
});

/* ── field errors ──────────────────────────────────────────────────── */

test("fieldErrorFor returns the first matching field error, else null", () => {
  const errs: FieldError[] = [
    { field: "name", code: "REQUIRED", message: "Name your character." },
    { field: "mind.model", code: "MODEL_REQUIRED", message: "Name the model." },
  ];
  assert.equal(fieldErrorFor(errs, "mind.model")?.code, "MODEL_REQUIRED");
  assert.equal(fieldErrorFor(errs, "directive"), null);
  assert.equal(fieldErrorFor([], "name"), null);
});

/* ── locked copy ───────────────────────────────────────────────────── */

test("local-mind note explains the shard is not the owner's laptop", () => {
  assert.ok(/shard/i.test(LOCAL_MIND_NETWORK_NOTE));
  assert.ok(/laptop/i.test(LOCAL_MIND_NETWORK_NOTE));
  assert.ok(/localhost/i.test(LOCAL_MIND_NETWORK_NOTE));
});

test("cloud key note promises write-only handling; beta note is free, no card", () => {
  assert.ok(/never/i.test(CLOUD_KEY_NOTE));
  assert.ok(/free/i.test(BETA_NOTE));
  assert.equal(/card|payment|subscription|price/i.test(BETA_NOTE), false);
});

test("directive counter shows the 2000 cap and flags overflow", () => {
  assert.equal(directiveCounterText(0), "0 / 2000");
  assert.equal(directiveCounterText(2000), "2000 / 2000");
  assert.ok(directiveCounterText(2001).includes("2001"));
  assert.ok(/over|too long|limit/i.test(directiveCounterText(2001)));
});

/* ── unleash gating ────────────────────────────────────────────────── */

function viewWith(overrides: Partial<CharacterView["character"]>, secretHint: "configured" | null): CharacterView {
  return {
    character: {
      id: "c1",
      accountId: "a1",
      name: "Wren",
      roleId: "ranger",
      directive: "Chop, sell, eat, sleep.",
      mind: { kind: "cloud", provider: "openai-compatible", model: "gpt-4o-mini" },
      lifecycle: "ready",
      revision: 4,
      createdAt: 1,
      updatedAt: 1,
      unleashedAt: null,
      recalledAt: null,
      ...overrides,
    },
    publicMind: {
      config: { kind: "cloud", provider: "openai-compatible", model: "gpt-4o-mini" },
      secretHint,
    },
  };
}

test("unleash button: blocked without a view, while busy, and on any missing item", () => {
  assert.ok(unleashBlockReason(null, false) !== null);
  const ready = viewWith({}, "configured");
  assert.ok(readinessChecklist(ready).every((i) => i.ok));
  assert.equal(unleashBlockReason(ready, false), null);
  assert.ok(unleashBlockReason(ready, true) !== null); // in-flight
  const keyless = viewWith({}, null);
  assert.ok(unleashBlockReason(keyless, false) !== null);
  const noDirective = viewWith({ directive: "  " }, "configured");
  assert.ok(unleashBlockReason(noDirective, false) !== null);
});

/* ── truthful status labels ────────────────────────────────────────── */

test("labels: driver, lifecycle, mind and runtime states are distinct and honest", () => {
  assert.equal(driverLabel("mind"), "Mind");
  assert.ok(/autopilot|reflex/i.test(driverLabel("reflex")));
  assert.ok(/none|no driver|stopped/i.test(driverLabel("none")));
  assert.equal(lifecycleLabel("draft"), "Draft");
  assert.equal(lifecycleLabel("ready"), "Ready");
  assert.equal(lifecycleLabel("unleashed"), "Unleashed");
  assert.equal(lifecycleLabel("recalled"), "Recalled");
  assert.equal(mindStateLabel("awake"), "Awake");
  assert.equal(mindStateLabel("asleep"), "Asleep");
  assert.equal(mindStateLabel("unconfigured"), "Unconfigured");
  assert.equal(mindStateLabel("connecting"), "Connecting");
  assert.equal(mindStateLabel("error"), "Error");
  assert.equal(runtimeStateLabel("running"), "Running");
  assert.equal(runtimeStateLabel("degraded"), "Degraded");
  assert.equal(runtimeStateLabel("inactive"), "Inactive");
  assert.equal(runtimeStateLabel("starting"), "Starting");
  assert.equal(runtimeStateLabel("recovering"), "Recovering");
});

/* ── screen source hygiene (same pattern as house-panel.test.ts) ───── */

const screenSource = readFileSync(new URL("./console-screen.tsx", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../../routes/console.tsx", import.meta.url), "utf8");

test("screen: secrets are password fields, never persisted or echoed", () => {
  // The API key and the resume token are the only secret inputs.
  assert.match(screenSource, /data-testid="mind-key"[^>]*type="password"/);
  assert.match(screenSource, /data-testid="resume-token"[^>]*type="password"/);
  assert.match(screenSource, /autocomplete="off"/);
  // No draft/localStorage write of the key anywhere in the screen.
  assert.equal(/localStorage/.test(screenSource), false);
});

test("screen: both connectors, validation, retry, banners and no billing surface", () => {
  assert.match(screenSource, /data-testid="mind-kind-cloud"/);
  assert.match(screenSource, /data-testid="mind-kind-local"/);
  assert.match(screenSource, /data-testid="mind-endpoint"/);
  assert.match(screenSource, /data-testid="unleash"/);
  assert.match(screenSource, /data-testid="retry"/);
  assert.match(screenSource, /role="alert"/);
  assert.match(screenSource, /deriveBanner/);
  assert.match(screenSource, /readinessChecklist/);
  assert.equal(/billing|payment|checkout|subscription|pricing/i.test(screenSource), false);
});

test("screen: mobile-first single column with touch-sized controls", () => {
  assert.match(screenSource, /max-w-2xl/);
  assert.match(screenSource, /min-h-11/); // 44px touch targets
});

test("route: gated by VITE_DIRECTOR_CONSOLE with a not-found fallback", () => {
  assert.match(routeSource, /VITE_DIRECTOR_CONSOLE/);
  assert.match(routeSource, /consoleEnabled/);
  assert.match(routeSource, /notFound/);
  assert.match(routeSource, /createFileRoute\("\/console"\)/);
});
