/**
 * Console flow conformance against the v1 mock: the full onboarding journey
 * for BOTH connector choices, role selection, directive entry, client/host
 * validation, recoverable-failure form preservation (S8), the unleash
 * request, truthful autopilot/degraded banners, and poll lifecycle.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createMockConsoleApi } from "../../lib/console-mock.ts";
import {
  CONSOLE_DRAFT_STORAGE_KEY,
  ConsoleController,
  deriveBanner,
  readinessChecklist,
  type ConsoleStorage,
} from "./console-controller.ts";

const IDEM = "flow-idem-key-0001";

test("mind failures offer sanitized recovery guidance while reflexes continue", () => {
  const status = { characterId: "fixture", lifecycle: "unleashed" as const, driver: "reflex" as const,
    mindState: "error" as const, runtimeState: "degraded" as const, reflexState: "ready" as const,
    reasonCode: "MIND_AUTH", autopilotSince: 1, lastMindExchangeTick: null, lastReflexTick: 2,
    lastAppliedActionTick: 2, configRevision: 1, body: null, journalTail: [] };
  assert.match(deriveBanner(status, "Runner")?.text ?? "", /replace.*key/i);
  assert.match(deriveBanner({ ...status, reasonCode: "MIND_INVALID_RESPONSE" }, "Runner")?.text ?? "", /compatible.*model/i);
  assert.match(deriveBanner({ ...status, reasonCode: "private-upstream-detail" }, "Runner")?.text ?? "", /check.*configuration/i);
  assert.doesNotMatch(deriveBanner({ ...status, reasonCode: "private-upstream-detail" }, "Runner")?.text ?? "", /private-upstream/);
});

function memStorage(): ConsoleStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function harness(opts?: {
  delay?: (ms: number) => Promise<void>;
  isVisible?: () => boolean;
  storage?: ConsoleStorage & { map?: Map<string, string> };
}) {
  let token: string | null = null;
  const { api, controls } = createMockConsoleApi({ getToken: () => token });
  let idemCounter = 0;
  const controller = new ConsoleController({
    api,
    getToken: () => token,
    setToken: (t) => {
      token = t;
    },
    storage: opts?.storage ?? memStorage(),
    // Default: polls park after the first fetch so tests can't spin a
    // resolved-promise loop forever; the cadence test drives its own delay.
    delay: opts?.delay ?? (() => new Promise<void>(() => {})),
    isVisible: opts?.isVisible ?? (() => true),
    pollIntervalMs: 2000,
    maxBackoffMs: 8000,
    newIdempotencyKey: () => `${IDEM}-${(idemCounter += 1)}`,
  });
  return { controller: controller, controls, api, getToken: () => token };
}

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

test("getState survives bare-reference calls (useSyncExternalStore contract)", () => {
  const { controller } = harness();
  // React's useSyncExternalStore invokes the snapshot without a receiver.
  // An unbound prototype method throws `this === undefined` during SSR and
  // blank-screens /console; the snapshot must be a bound/arrow member.
  const { getState, subscribe } = controller;
  const snap = getState();
  assert.equal(snap.step, "account");
  assert.equal(getState(), snap);
  const unsubscribe = subscribe(() => {});
  assert.equal(typeof unsubscribe, "function");
  unsubscribe();
});

/** Drives a fresh controller through account → character → role → directive. */
async function toMindStep(c: ConsoleController, name = "Wren") {
  await c.createAccount();
  if (c.getState().tokenRevealed) c.confirmTokenSaved();
  c.startNewCharacter();
  c.updateForm({ name });
  await c.submitName();
  await c.submitRole("ranger");
  c.updateForm({ directive: "Chop, sell, eat, sleep. Stay out of trouble." });
  await c.submitDirective();
  assert.equal(c.getState().step, "mind");
}

/* ── account ───────────────────────────────────────────────────────── */

test("account: free creation, token shown once, no billing anywhere", async () => {
  const { controller: c } = harness();
  assert.equal(c.getState().step, "account");
  await c.createAccount();
  const s = c.getState();
  // The one-time reveal renders only on the account step, so creation must
  // STAY there until the owner confirms the token is saved.
  assert.equal(s.step, "account");
  assert.equal(s.tokenRevealed, true);
  assert.ok(s.account !== null);
  assert.equal(s.account.billing.plan, "beta-free");
  assert.equal(s.manifest?.version, 1);
  assert.equal(s.manifest?.packs.length, 4);
  c.confirmTokenSaved();
  assert.equal(c.getState().tokenRevealed, false);
  assert.equal(c.getState().step, "character");
  const screenText = JSON.stringify(c.getState());
  assert.equal(screenText.includes("billing") && screenText.includes("card"), false);
});

test("character list stays current: creation appends, lifecycle syncs, rename upserts", async () => {
  const { controller: c } = harness();
  await c.createAccount();
  c.confirmTokenSaved();
  c.startNewCharacter();
  c.updateForm({ name: "Listy" });
  await c.submitName();
  // The character step lists prior characters for resume; a freshly created
  // character must appear without a round-trip back through account resume.
  assert.equal(c.getState().characters.length, 1);
  assert.equal(c.getState().characters[0].character.name, "Listy");
  await c.submitRole("ranger");
  c.updateForm({ directive: "Stay listed." });
  await c.submitDirective();
  c.updateMindForm({ kind: "local", local: { endpointUrl: "http://127.0.0.1:11434/v1", model: "llama3" } });
  await c.submitMind();
  await c.unleashNow();
  assert.equal(c.getState().characters[0].character.lifecycle, "unleashed");
  await c.recallNow();
  assert.equal(c.getState().characters[0].character.lifecycle, "recalled");
  const id = c.getState().characters[0].character.id;
  await c.selectCharacter(id);
  c.updateForm({ name: "Listy II" });
  await c.submitName();
  assert.equal(c.getState().characters.length, 1); // upsert, not duplicate
  assert.equal(c.getState().characters[0].character.name, "Listy II");
});

test("account: bad resume token is rejected with a clear error", async () => {
  const { controller: c } = harness();
  await c.resumeWithToken("mtok-wrong");
  const s = c.getState();
  assert.equal(s.step, "account");
  assert.ok(s.error !== null);
  assert.equal(s.error.recoverable, false); // 401 — fix the token, not a retry
});

/* ── role selection ────────────────────────────────────────────────── */

test("role: manifest lists the four roles with skill packs", async () => {
  const { controller: c } = harness();
  await c.createAccount();
  const packs = c.getState().manifest?.packs ?? [];
  assert.deepEqual(packs.map((p) => p.id).sort(), ["banker", "mule", "ranger", "smith"]);
  for (const p of packs) {
    assert.ok(p.label.length > 0 && p.summary.length > 0);
    assert.ok(Object.keys(p.startingSkills).length > 0);
  }
});

test("role: host rejection of an unknown role surfaces as a field error", async () => {
  const { controller: c } = harness();
  await c.createAccount();
  c.startNewCharacter();
  c.updateForm({ name: "Roley" });
  await c.submitName();
  await c.submitRole("wizard" as never);
  const s = c.getState();
  assert.equal(s.step, "role"); // stayed
  assert.ok(s.fieldErrors.some((f) => f.code === "UNKNOWN_ROLE"));
});

/* ── directive entry ───────────────────────────────────────────────── */

test("directive: over-limit is stopped client-side; draft survives", async () => {
  const { controller: c } = harness();
  await c.createAccount();
  c.startNewCharacter();
  c.updateForm({ name: "Dirk" });
  await c.submitName();
  await c.submitRole("smith");
  c.updateForm({ directive: "d".repeat(2001) });
  await c.submitDirective();
  const s = c.getState();
  assert.equal(s.step, "directive");
  assert.ok(s.fieldErrors.some((f) => f.code === "TOO_LONG"));
  assert.equal(s.form.directive.length, 2001); // preserved for editing
});

/* ── validation ────────────────────────────────────────────────────── */

test("validation: blank and overlong names are stopped client-side", async () => {
  const { controller: c } = harness();
  await c.createAccount();
  c.startNewCharacter();
  c.updateForm({ name: "   " });
  await c.submitName();
  assert.ok(c.getState().fieldErrors.some((f) => f.code === "REQUIRED"));
  c.updateForm({ name: "x".repeat(33) });
  await c.submitName();
  assert.ok(c.getState().fieldErrors.some((f) => f.code === "TOO_LONG"));
  assert.equal(c.getState().view, null); // nothing was persisted
});

test("validation: local endpoint URL rules run before any request", async () => {
  const { controller: c } = harness();
  await toMindStep(c, "Urlsy");
  c.updateMindForm({ kind: "local", local: { endpointUrl: "https://user:pw@host/v1", model: "m" } });
  await c.submitMind();
  assert.ok(c.getState().fieldErrors.some((f) => f.code === "USERINFO"));
  assert.equal(c.getState().step, "mind");
});

/* ── cloud connector journey ───────────────────────────────────────── */

test("cloud journey: key → configured hint → unleash → mind driving", async () => {
  const { controller: c } = harness();
  await toMindStep(c);
  c.updateMindForm({ cloud: { model: "gpt-4o-mini", key: "sk-journey-123" } });
  await c.submitMind();
  let s = c.getState();
  assert.equal(s.step, "review");
  assert.equal(s.form.mind.cloud.key, ""); // wiped from memory after the write
  assert.equal(s.view?.publicMind?.secretHint, "configured");
  assert.equal(JSON.stringify(s.view).includes("sk-journey-123"), false);

  const checklist = readinessChecklist(s.view);
  assert.ok(checklist.every((item) => item.ok), checklist.filter((i) => !i.ok).map((i) => i.key).join(","));

  await c.unleashNow();
  s = c.getState();
  assert.equal(s.step, "status");
  assert.equal(s.polling, true);
  assert.equal(s.status?.lifecycle, "unleashed");
  assert.equal(s.status?.driver, "mind");
  assert.equal(s.status?.mindState, "awake");
  assert.equal(deriveBanner(s.status, "Wren"), null); // healthy: no banner
  c.stopPolling();
  assert.equal(c.getState().polling, false);
});

/* ── local connector journey ───────────────────────────────────────── */

test("local journey: endpoint URL, no key, unleash, sleep = autopilot", async () => {
  const { controller: c, controls, api } = harness();
  await toMindStep(c, "Bram");
  c.updateMindForm({ kind: "local", local: { endpointUrl: "https://bram.example.com/v1", model: "qwen3:8b" } });
  await c.submitMind();
  let s = c.getState();
  assert.equal(s.step, "review");
  assert.equal(s.view?.publicMind?.secretHint, null);
  assert.ok(readinessChecklist(s.view).every((i) => i.ok)); // key item passes keyless

  await c.unleashNow();
  s = c.getState();
  assert.equal(s.status?.driver, "mind");
  const id = s.view?.character.id;
  assert.ok(id !== undefined);

  // The owner's laptop sleeps — autopilot carries the character. This is
  // the feature, not a failure state.
  controls.sleepMind(id);
  const status = await api.status(id);
  const banner = deriveBanner(status, "Bram");
  assert.equal(status.mindState, "asleep");
  assert.equal(status.driver, "reflex");
  assert.equal(banner?.kind, "autopilot");
  assert.ok(banner.text.includes("Autopilot"));
  assert.ok(status.journalTail.some((l) => l.startsWith("(autopilot)")));
  c.stopPolling();
});

test("local journey: reflex outage shows degraded truth, never the autopilot banner", async () => {
  const { controller: c, controls, api } = harness();
  await toMindStep(c, "Rust");
  c.updateMindForm({ kind: "local", local: { endpointUrl: "https://rust.example.com/v1", model: "qwen3:8b" } });
  await c.submitMind();
  await c.unleashNow();
  const id = c.getState().view?.character.id;
  assert.ok(id !== undefined);
  controls.sleepMind(id);
  controls.setReflexState(id, "unavailable", "reflex-pool-down");
  const status = await api.status(id);
  const banner = deriveBanner(status, "Rust");
  assert.equal(banner?.kind, "degraded");
  assert.ok(banner.text.startsWith("Autopilot unavailable"));
  assert.equal(banner.text.includes("instincts keep it going"), false); // banned lie
  c.stopPolling();
});

/* ── validation of readiness gating ────────────────────────────────── */

test("unleash: whitespace directive and missing model/key block with fields", async () => {
  const { controller: c } = harness();
  await toMindStep(c, "Gappy");
  // whitespace directive via a fresh patch through the controller form
  c.updateForm({ directive: "   " });
  await c.submitDirective();
  c.updateMindForm({ cloud: { model: "", key: "" } });
  await c.submitMind();
  const s = c.getState();
  assert.equal(s.step, "review"); // draft saves — readiness is the gate
  const missing = readinessChecklist(s.view).filter((i) => !i.ok).map((i) => i.key);
  assert.deepEqual(missing.sort(), ["directive", "key", "model"]);
  await c.unleashNow();
  const after = c.getState();
  assert.equal(after.step, "review"); // host refused
  assert.ok(after.fieldErrors.length > 0);
});

/* ── S8: recoverable failure preserves form, clears secret ─────────── */

test("S8: 503 during secret write keeps non-secret form, wipes key, honest re-entry", async () => {
  const { controller: c, controls } = harness();
  await toMindStep(c, "Nimbus");
  c.updateMindForm({ cloud: { model: "gpt-4o-mini", key: "sk-maybe-lost" } });
  const id = c.getState().view?.character.id;
  assert.ok(id !== undefined);
  // The config PATCH succeeds; the secret write hits a host restart.
  controls.failNext(503, "CONFIG_UNAVAILABLE", "The host is restarting — retry in a moment.", 1);
  await c.submitMind();
  let s = c.getState();
  assert.equal(s.step, "mind"); // did not advance
  assert.ok(s.error !== null && s.error.recoverable);
  assert.equal(s.form.mind.cloud.key, ""); // secret cleared from memory
  assert.equal(s.form.mind.cloud.model, "gpt-4o-mini"); // non-secret preserved
  assert.equal(s.form.name, "Nimbus");
  assert.equal(s.form.directive.includes("Chop"), true);
  assert.equal(controls.storedSecret(id), null); // honestly NOT stored

  // Retry without re-entering the key: config persists, review flags the key.
  await c.retry();
  s = c.getState();
  assert.equal(s.step, "review");
  assert.equal(s.view?.publicMind?.secretHint, null);
  assert.ok(readinessChecklist(s.view).some((i) => i.key === "key" && !i.ok));

  // Honest re-entry completes the flow.
  c.goTo("mind");
  c.updateMindForm({ cloud: { key: "sk-reentered" } });
  await c.submitMind();
  s = c.getState();
  assert.equal(s.view?.publicMind?.secretHint, "configured");
  assert.equal(controls.storedSecret(id), "sk-reentered");
});

test("S8: 503 on unleash keeps the whole review intact and retry succeeds", async () => {
  const { controller: c, controls } = harness();
  await toMindStep(c, "Retry");
  c.updateMindForm({ cloud: { model: "gpt-4o-mini", key: "sk-fine" } });
  await c.submitMind();
  controls.failNext(503, "RUNTIME_UNAVAILABLE", "reflex pool restarting");
  await c.unleashNow();
  let s = c.getState();
  assert.equal(s.step, "review");
  assert.ok(s.error?.recoverable === true);
  assert.equal(s.form.directive.includes("Chop"), true);
  await c.retry();
  s = c.getState();
  assert.equal(s.step, "status");
  assert.equal(s.status?.lifecycle, "unleashed");
  c.stopPolling();
});

/* ── revision conflict reloads ─────────────────────────────────────── */

test("revision conflict reloads the character and keeps editing possible", async () => {
  const { controller: c, api } = harness();
  await toMindStep(c, "Conflux");
  const id = c.getState().view?.character.id;
  assert.ok(id !== undefined);
  // A second session edits the same character, bumping the revision.
  await api.patchCharacter(id, { directive: "Changed elsewhere.", expectedRevision: c.getState().view!.character.revision });
  c.updateMindForm({ kind: "local", local: { endpointUrl: "https://x.example.com/v1", model: "m" } });
  await c.submitMind();
  const s = c.getState();
  assert.equal(s.error?.recoverable, false);
  assert.ok(s.notice?.includes("changed elsewhere") ?? false);
  assert.equal(s.view?.character.directive, "Changed elsewhere."); // reloaded
});

/* ── draft autosave excludes credentials ───────────────────────────── */

test("draft autosave persists non-secret fields and never the key", async () => {
  const storage = memStorage();
  const { controller: c } = harness({ storage });
  await c.createAccount();
  c.startNewCharacter();
  c.updateForm({ name: "Drafty", directive: "Bank often." });
  c.updateMindForm({ kind: "local", local: { endpointUrl: "http://127.0.0.1:11434/v1", model: "qwen3:8b" } });
  c.updateMindForm({ cloud: { key: "sk-never-persist" } });
  const raw = storage.map.get(CONSOLE_DRAFT_STORAGE_KEY);
  assert.ok(raw !== undefined);
  assert.equal(raw.includes("sk-never-persist"), false);
  assert.equal(raw.includes("never-persist"), false);
  const draft = JSON.parse(raw);
  assert.equal(draft.name, "Drafty");
  assert.equal(draft.mind.local.endpointUrl, "http://127.0.0.1:11434/v1");
  assert.equal("key" in (draft.mind.cloud ?? {}), false);

  // A fresh controller (e.g. after a reload) restores the non-secret draft.
  const { controller: c2 } = harness({ storage });
  assert.equal(c2.getState().form.name, "Drafty");
  assert.equal(c2.getState().form.directive, "Bank often.");
  assert.equal(c2.getState().form.mind.cloud.key, "");
});

/* ── polling lifecycle ─────────────────────────────────────────────── */

test("polling: 2s cadence, error backoff, hidden skips, stop on demand", async () => {
  const delays: number[] = [];
  let resume: (() => void) | null = null;
  let visible = true;
  const delay = (ms: number) => {
    delays.push(ms);
    return new Promise<void>((r) => {
      resume = r;
    });
  };
  const { controller: c, controls } = harness({ delay, isVisible: () => visible });
  // Closure indirection: TS narrows the outer `resume` to null at the call
  // sites (its assignment happens inside `delay`); a closure reads the
  // declared type. Behavior is identical to calling resume directly.
  const fire = () => {
    resume?.();
  };
  await toMindStep(c, "Polly");
  c.updateMindForm({ kind: "local", local: { endpointUrl: "https://p.example.com/v1", model: "m" } });
  await c.submitMind();
  await c.unleashNow();
  await flush();
  assert.equal(c.getState().polling, true);
  assert.equal(c.getState().status?.mindState, "awake");
  assert.deepEqual(delays, [2000]);

  // Hidden tab: the interval passes with no fetch and no error.
  visible = false;
  fire();
  await flush();
  assert.equal(c.getState().pollError, null);
  visible = true;

  // Transient error: quiet backoff 2000 → 4000, then recovery to 2000.
  const id = c.getState().view?.character.id;
  assert.ok(id !== undefined);
  controls.failNext(503, "CONFIG_UNAVAILABLE", "restarting");
  fire();
  await flush();
  assert.ok(c.getState().pollError !== null);
  assert.deepEqual(delays, [2000, 2000, 4000]);
  fire();
  await flush();
  assert.equal(c.getState().pollError, null);
  assert.deepEqual(delays, [2000, 2000, 4000, 2000]);

  c.stopPolling();
  assert.equal(c.getState().polling, false);
});

test("polling: only status GETs — no mutation, no model-triggering call", async () => {
  const calls: string[] = [];
  let token: string | null = null;
  const { api } = createMockConsoleApi({ getToken: () => token });
  const wrapped = new Proxy(api, {
    get(target, prop, recv) {
      const value = Reflect.get(target, prop, recv) as (...a: unknown[]) => unknown;
      if (typeof value !== "function") return value;
      return (...a: unknown[]) => {
        calls.push(String(prop));
        return value.apply(target, a);
      };
    },
  });
  const c2 = new ConsoleController({
    api: wrapped,
    getToken: () => token,
    setToken: (t) => {
      token = t;
    },
    delay: () => new Promise<void>(() => {}),
    newIdempotencyKey: () => `${IDEM}-spy`,
  });
  await c2.createAccount();
  c2.startNewCharacter();
  c2.updateForm({ name: "Spy" });
  await c2.submitName();
  await c2.submitRole("mule");
  c2.updateForm({ directive: "Haul." });
  await c2.submitDirective();
  c2.updateMindForm({ kind: "local", local: { endpointUrl: "https://s.example.com/v1", model: "m" } });
  await c2.submitMind();
  await c2.unleashNow();
  await flush();
  const pollCalls = calls.filter((n) => n !== "status");
  const statusCalls = calls.filter((n) => n === "status").length;
  assert.ok(statusCalls >= 2); // unleash refresh + poll ticks
  assert.ok(pollCalls.every((n) => ["createAccount", "listRoles", "listCharacters", "createCharacter", "patchCharacter", "getCharacter", "unleash"].includes(n)));
  c2.stopPolling();
});

/* ── idempotent unleash from the console ───────────────────────────── */

test("double unleash returns the same agent without duplicating", async () => {
  const { controller: c, controls } = harness();
  await toMindStep(c, "Twice");
  c.updateMindForm({ kind: "local", local: { endpointUrl: "https://t.example.com/v1", model: "m" } });
  await c.submitMind();
  await c.unleashNow();
  const first = c.getState().status;
  await c.unleashNow(); // user double-clicks / retries
  const s = c.getState();
  assert.equal(s.error, null);
  assert.equal(controls.counts().characters, 1);
  assert.equal(s.status?.characterId, first?.characterId);
  c.stopPolling();
});

/* ── recall from the status screen ─────────────────────────────────── */

test("recall: stops the runtime truthfully and offers re-unleash", async () => {
  const { controller: c } = harness();
  await toMindStep(c, "Resty");
  c.updateMindForm({ kind: "local", local: { endpointUrl: "https://r.example.com/v1", model: "m" } });
  await c.submitMind();
  await c.unleashNow();
  await c.recallNow();
  const s = c.getState();
  assert.equal(s.status?.lifecycle, "recalled");
  assert.equal(s.status?.driver, "none");
  assert.equal(s.status?.runtimeState, "inactive");
  assert.ok(s.notice?.includes("recalled") ?? false);
  await c.unleashNow(); // resume is one click
  assert.equal(c.getState().status?.lifecycle, "unleashed");
  c.stopPolling();
});
