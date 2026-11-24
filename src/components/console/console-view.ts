/**
 * Director console — pure view model.
 *
 * Display decisions that must be identical on every render path live here so
 * they are testable without a DOM (repo pattern: house-panel.ts). The screen
 * (`console-screen.tsx`) is a thin binding over the controller + these helpers.
 *
 * Flag contract (v1 §7.3): the console ships behind `VITE_DIRECTOR_CONSOLE`
 * and is OFF by default — only the exact string "true" opens the route.
 */
import type { FieldError, Lifecycle } from "../../game/agent/account.ts";
import type {
  CharacterView,
  DriverV1,
  MindStateV1,
  RuntimeStateV1,
} from "../../lib/console-api.ts";
import { readinessChecklist, type ConsoleStep } from "./console-controller.ts";

/* ── Feature flag & runtime selection ──────────────────────────────── */

/** Only the exact string "true" enables the console; everything else is off. */
export function consoleEnabled(flag: unknown): boolean {
  return flag === "true";
}

export type ConsoleRuntimeKind = "mock" | "http";

/**
 * Which host the console talks to. Default is the in-memory v1 contract mock
 * so the whole flow is exercisable before the live host lands; `VITE_CONSOLE_API=http`
 * switches the identical controller to the real HTTP client once the host
 * endpoints exist. Closed value — no case coercion.
 */
export function resolveConsoleRuntimeKind(flag: unknown): ConsoleRuntimeKind {
  return flag === "http" ? "http" : "mock";
}

/** Honest label for the active runtime; null when talking to the live host. */
export function runtimeLabel(kind: ConsoleRuntimeKind): string | null {
  return kind === "mock"
    ? "Preview host (contract mock) — live shard wiring lands with the host lane."
    : null;
}

/* ── Steps ─────────────────────────────────────────────────────────── */

export const CONSOLE_STEPS: readonly ConsoleStep[] = [
  "account",
  "character",
  "role",
  "directive",
  "mind",
  "review",
  "status",
];

const STEP_HEADINGS: Record<ConsoleStep, string> = {
  account: "Open your account",
  character: "Create your character",
  role: "Choose a role",
  directive: "Write the directive",
  mind: "Connect a mind",
  review: "Review & unleash",
  status: "In the vale",
};

export function stepHeading(step: ConsoleStep): string {
  return STEP_HEADINGS[step];
}

export function stepProgressIndex(step: ConsoleStep): number {
  return CONSOLE_STEPS.indexOf(step);
}

/* ── Field errors ──────────────────────────────────────────────────── */

export function fieldErrorFor(
  errors: readonly FieldError[],
  field: string,
): FieldError | null {
  return errors.find((e) => e.field === field) ?? null;
}

/* ── Locked copy ───────────────────────────────────────────────────── */

/**
 * The vale shard runs in the cloud (Fly), so a loopback URL configured here
 * resolves against the SHARD's machine — never the owner's laptop. Owners
 * running a local mind must expose it where the shard can reach it.
 */
export const LOCAL_MIND_NETWORK_NOTE =
  "The vale shard runs in the cloud, so localhost / 127.0.0.1 here means the " +
  "shard's own machine — not your laptop. To use a mind on your laptop, expose " +
  "it through a tunnel or a URL the shard can reach, then paste that URL.";

export const CLOUD_KEY_NOTE =
  "Your key is sent once over HTTPS and stored write-only: it is never shown " +
  "again, never logged, and never leaves the host.";

export const BETA_NOTE = "Free during beta — no account fees, no activation gate.";

export function directiveCounterText(length: number): string {
  const base = `${length} / 2000`;
  return length > 2000 ? `${base} — over the limit` : base;
}

/* ── Unleash gating ────────────────────────────────────────────────── */

/** Why the unleash button is disabled, or null when it may fire. */
export function unleashBlockReason(view: CharacterView | null, busy: boolean): string | null {
  if (busy) return "Working…";
  if (!view) return "Save the character first.";
  const missing = readinessChecklist(view).filter((i) => !i.ok);
  if (missing.length > 0) return `Finish the checklist: ${missing.map((i) => i.key).join(", ")}.`;
  return null;
}

/* ── Truthful status labels ────────────────────────────────────────── */

export function driverLabel(driver: DriverV1): string {
  switch (driver) {
    case "mind":
      return "Mind";
    case "reflex":
      return "Reflexes (autopilot)";
    case "none":
      return "No driver";
  }
}

export function lifecycleLabel(lifecycle: Lifecycle): string {
  switch (lifecycle) {
    case "draft":
      return "Draft";
    case "ready":
      return "Ready";
    case "unleashed":
      return "Unleashed";
    case "recalled":
      return "Recalled";
  }
}

export function mindStateLabel(state: MindStateV1): string {
  switch (state) {
    case "awake":
      return "Awake";
    case "asleep":
      return "Asleep";
    case "connecting":
      return "Connecting";
    case "error":
      return "Error";
    case "unconfigured":
      return "Unconfigured";
  }
}

export function runtimeStateLabel(state: RuntimeStateV1): string {
  switch (state) {
    case "running":
      return "Running";
    case "degraded":
      return "Degraded";
    case "starting":
      return "Starting";
    case "recovering":
      return "Recovering";
    case "inactive":
      return "Inactive";
  }
}
