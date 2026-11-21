/**
 * Phase 4 shared contracts — account, character, role, directive, mind
 * configuration, and the unleash lifecycle.
 *
 * One shared type surface, same pattern as the Phase 0 harness `types.ts`:
 * the host (`src/server/`) persists and serves these shapes; the director
 * console (client) renders and edits them. Zero runtime dependencies —
 * pure types, constants, and validators so both sides validate identically.
 *
 * The full protocol doc is `docs/phase-4-contracts.md`. Decisions are made
 * there once; this file is the executable half.
 */
import type { SkillId } from "../types.ts";

/* ── Roles ─────────────────────────────────────────────────────────── */

/**
 * Closed role set for beta. Each id maps to one skill pack markdown at
 * `agent-packs/<id>.md` (delivered by the content lane) and one row in the
 * machine-readable manifest `agent-packs/packs.json`. Adding a role is a
 * closed-set change: this union, the manifest, and the pack file together.
 */
export const ROLE_IDS = ["ranger", "smith", "banker", "mule"] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export function isRoleId(x: unknown): x is RoleId {
  return typeof x === "string" && (ROLE_IDS as readonly string[]).includes(x);
}

/** Machine-readable pack registry. The console lists roles from this via
 *  `GET /api/v1/roles`; the host reads starting skills from it at spawn. */
export interface RolePackManifestEntry {
  id: RoleId;
  /** Short display label ("Ranger"). */
  label: string;
  /** One-line fantasy for the picker. */
  summary: string;
  /** Pack markdown path relative to repo root: `agent-packs/<id>.md`. */
  file: string;
  /** Applied exactly once at first spawn; never re-applied on recovery. */
  startingSkills: Partial<Record<SkillId, number>>;
}

export interface RolePackManifest {
  packs: RolePackManifestEntry[];
}

/* ── Billing (stub — beta is free; pricing is a launch decision) ───── */

export interface BillingStub {
  plan: "beta-free";
  entitled: true;
}

/** The only billing state that exists in beta. `entitled` is always true;
 *  no payment or subscription is ever an activation prerequisite. */
export const BETA_BILLING: BillingStub = { plan: "beta-free", entitled: true };

/* ── Account ───────────────────────────────────────────────────────── */

/**
 * Owner stub. An account is created with one call, needs no email, no
 * password, no payment — beta low-friction. The `ownerToken` returned at
 * creation is the only credential; the host stores it hashed.
 */
export interface Account {
  id: string;
  createdAt: number;
  billing: BillingStub;
}

/* ── Mind configuration ────────────────────────────────────────────── */

/**
 * Day-one provider allowlist. The OpenAI-compatible HTTP adapter covers
 * most subscription APIs; ids here are what the host will actually accept.
 */
export const CLOUD_PROVIDERS = ["openai-compatible"] as const;
export type CloudProvider = (typeof CLOUD_PROVIDERS)[number];

export function isCloudProvider(x: unknown): x is CloudProvider {
  return typeof x === "string" && (CLOUD_PROVIDERS as readonly string[]).includes(x);
}

/** Cloud mind: the owner's subscription LLM. The API key itself is a
 *  secret — it NEVER lives in this shape; see the secret contract below. */
export interface CloudMindConfig {
  kind: "cloud";
  provider: CloudProvider;
  /** Optional override for compatible gateways. http(s) only when set. */
  baseUrl?: string;
  model?: string;
}

/** Local mind: an endpoint the owner hosts (Ollama, llama.cpp, vLLM, …).
 *  Loopback and LAN addresses are explicitly allowed — that is the point. */
export interface LocalMindConfig {
  kind: "local";
  endpointUrl: string;
  model?: string;
}

export type MindConfig = CloudMindConfig | LocalMindConfig;

/** What the API returns about a configured mind: the non-secret config
 *  plus a masked hint that a secret exists. The secret value is write-only
 *  and is never serialized into any API response or log line. */
export interface PublicMind {
  config: MindConfig;
  /** e.g. "…w9x2" — last four of the stored key, or null when keyless. */
  secretHint: string | null;
}

/* ── Character ─────────────────────────────────────────────────────── */

export type Lifecycle = "draft" | "ready" | "unleashed" | "recalled";

/** Which brain is currently driving executed intents. */
export type Driver = "mind" | "reflex";

/** Observed connectivity of the owner's mind. `asleep` is a supported,
 *  normal state — never an error. */
export type MindState = "unconfigured" | "awake" | "asleep";

export interface Character {
  id: string;
  accountId: string;
  /** 1..NAME_MAX, unique per account. */
  name: string;
  /** null while the owner has not picked a role yet (draft only). */
  roleId: RoleId | null;
  /** The owner's standing instruction. "" only while draft. */
  directive: string;
  /** null until the owner connects a mind. */
  mind: MindConfig | null;
  lifecycle: Lifecycle;
  createdAt: number;
  updatedAt: number;
  unleashedAt: number | null;
  recalledAt: number | null;
}

/* ── Limits ────────────────────────────────────────────────────────── */

export const NAME_MAX = 32;
export const DIRECTIVE_MAX = 2000;
export const ENDPOINT_URL_MAX = 2048;

/* ── Validation ────────────────────────────────────────────────────── */

export interface FieldError {
  field: string;
  code: string;
  /** Actionable, human-readable — the console shows these verbatim. */
  message: string;
}

export function validateName(name: unknown): FieldError | null {
  if (typeof name !== "string" || name.trim().length === 0) {
    return { field: "name", code: "REQUIRED", message: "Name your character." };
  }
  if (name.trim().length > NAME_MAX) {
    return {
      field: "name",
      code: "TOO_LONG",
      message: `Keep the name under ${NAME_MAX} characters.`,
    };
  }
  return null;
}

export function validateDirective(
  directive: unknown,
  opts: { required: boolean },
): FieldError | null {
  if (directive === undefined || directive === null || directive === "") {
    return opts.required
      ? { field: "directive", code: "REQUIRED", message: "Write a directive — one sentence is enough." }
      : null;
  }
  if (typeof directive !== "string") {
    return { field: "directive", code: "TYPE", message: "Directive must be text." };
  }
  if (directive.length > DIRECTIVE_MAX) {
    return {
      field: "directive",
      code: "TOO_LONG",
      message: `Keep the directive under ${DIRECTIVE_MAX} characters.`,
    };
  }
  return null;
}

function validateHttpUrl(
  raw: string,
  field: string,
): FieldError | null {
  if (raw.length > ENDPOINT_URL_MAX) {
    return { field, code: "TOO_LONG", message: "That URL is too long." };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { field, code: "BAD_URL", message: "That is not a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { field, code: "BAD_SCHEME", message: "Only http(s) endpoints are supported." };
  }
  if (url.username !== "" || url.password !== "") {
    return {
      field,
      code: "USERINFO",
      message: "Do not embed credentials in the URL — use the key field instead.",
    };
  }
  return null;
}

export function validateMindConfig(mind: unknown): FieldError[] {
  if (mind === null || typeof mind !== "object") {
    return [{ field: "mind", code: "REQUIRED", message: "Connect a mind: cloud key or local endpoint." }];
  }
  const m = mind as Record<string, unknown>;
  if (m.kind === "cloud") {
    const errs: FieldError[] = [];
    if (!isCloudProvider(m.provider)) {
      errs.push({
        field: "mind.provider",
        code: "UNKNOWN_PROVIDER",
        message: `Provider must be one of: ${CLOUD_PROVIDERS.join(", ")}.`,
      });
    }
    if (m.baseUrl !== undefined) {
      if (typeof m.baseUrl !== "string") {
        errs.push({ field: "mind.baseUrl", code: "TYPE", message: "Base URL must be text." });
      } else {
        const e = validateHttpUrl(m.baseUrl, "mind.baseUrl");
        if (e) errs.push(e);
      }
    }
    return errs;
  }
  if (m.kind === "local") {
    if (typeof m.endpointUrl !== "string" || m.endpointUrl.length === 0) {
      return [{ field: "mind.endpointUrl", code: "REQUIRED", message: "Enter your local endpoint URL." }];
    }
    const e = validateHttpUrl(m.endpointUrl, "mind.endpointUrl");
    return e ? [e] : [];
  }
  return [{ field: "mind.kind", code: "UNKNOWN_KIND", message: 'Mind kind must be "cloud" or "local".' }];
}

/** Everything standing between this character and `unleash`. Empty array
 *  means the character is `ready`. */
export function readinessErrors(c: Character): FieldError[] {
  const errs: FieldError[] = [];
  const nameErr = validateName(c.name);
  if (nameErr) errs.push(nameErr);
  if (c.roleId === null) {
    errs.push({ field: "roleId", code: "REQUIRED", message: "Pick a role." });
  } else if (!isRoleId(c.roleId)) {
    errs.push({ field: "roleId", code: "UNKNOWN_ROLE", message: "That role does not exist." });
  }
  const dirErr = validateDirective(c.directive, { required: true });
  if (dirErr) errs.push(dirErr);
  errs.push(...validateMindConfig(c.mind));
  return errs;
}

/** Billing gate — intentionally a constant pass in beta. Pricing and
 *  subscription tiers are launch decisions and must never block activation. */
export function activationAllowed(_account: Account): true {
  return true;
}

/* ── Lifecycle state machine ───────────────────────────────────────── */

export type LifecycleEvent = "unleash" | "recall";

/**
 * Legal transitions. `unleash` is idempotent: repeating it on an unleashed
 * character returns the same live agent, never a duplicate. `recall` is
 * likewise idempotent. `null` = refused (respond CONFIG_INCOMPLETE).
 *
 *   draft     --unleash--> ✕ (blocked: finish configuration first)
 *   ready     --unleash--> unleashed
 *   unleashed --unleash--> unleashed   (idempotent no-op)
 *   recalled  --unleash--> unleashed   (re-unleash; durable state resumes)
 *   unleashed --recall---> recalled
 *   recalled  --recall---> recalled    (idempotent no-op)
 *   ready     --recall---> ✕           (nothing running)
 *   draft     --recall---> ✕
 */
export function nextLifecycle(current: Lifecycle, event: LifecycleEvent): Lifecycle | null {
  switch (event) {
    case "unleash":
      if (current === "ready" || current === "unleashed" || current === "recalled") {
        return "unleashed";
      }
      return null;
    case "recall":
      if (current === "unleashed" || current === "recalled") return "recalled";
      return null;
  }
}

/* ── Runtime status (host → console overlay) ───────────────────────── */

/**
 * The observable state of a live character. `lifecycle` is durable; the
 * rest is the runtime overlay. While `mindState === "asleep"`, `driver`
 * is `"reflex"` and `autopilotSince` marks when the mind went quiet — the
 * character keeps acting; that is the feature, not a failure.
 */
export interface CharacterStatus {
  characterId: string;
  lifecycle: Lifecycle;
  driver: Driver;
  mindState: MindState;
  /** Tick at which the sleeping mind took over, null while awake. */
  autopilotSince: number | null;
  lastMindExchangeTick: number | null;
  lastReflexTick: number | null;
  body: { hp: number; maxHp: number; x: number; z: number; task: string } | null;
  journalTail: string[];
}

/* ── Locked console copy ───────────────────────────────────────────── */

/**
 * The exact strings the console and journal use for autopilot. System
 * lines are prefixed `(autopilot)` so a machine-written line is never
 * dressed up as the character's own voice — no faking, per product
 * philosophy.
 */
export const AUTOPILOT_COPY = {
  banner: (name: string) =>
    `Autopilot — ${name}'s mind is asleep. Its instincts keep it going; ` +
    `it will think again when the mind wakes.`,
  sleepLine: (name: string) => `(autopilot) ${name}'s mind is asleep; instincts take over.`,
  wakeLine: (name: string) => `(autopilot) ${name}'s mind woke; thinking resumed.`,
} as const;

/* ── Secrets ───────────────────────────────────────────────────────── */

/** Mask a stored secret for display: last four characters only. */
export function maskSecret(secret: string): string {
  const tail = secret.slice(-4);
  return `…${tail}`;
}
