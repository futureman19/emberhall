/**
 * Phase 4 director console — v1 API client and wire types.
 *
 * Source of truth: `docs/phase-4-contracts-v1.md` and the host's shared
 * `src/game/agent/account.ts`. Console view shapes remain stable for the
 * controller and mocks; the HTTP boundary explicitly translates host DTOs
 * (characterId, roles, accountId) into those internal shapes (id, packs,
 * account). These internal interfaces are not the host wire contract.
 *
 * Security rules baked in:
 *  - secrets are write-only (PUT mind-secret) and never appear in any type
 *    this client reads back; `secretHint` is the literal string
 *    "configured" or null — never a key suffix (v0 maskSecret is banned);
 *  - request bodies and the Authorization header are never logged;
 *  - all requests are `cache: "no-store"`.
 */
import { CLOUD_PROVIDERS, DIRECTIVE_MAX, ENDPOINT_URL_MAX, NAME_MAX } from "../game/agent/account.ts";
import type {
  Account,
  CharacterView as HostCharacterView,
  RolePackManifest as HostRolePackManifest,
  FieldError,
  Lifecycle,
  MindConfig,
  RoleId,
} from "../game/agent/account.ts";

/* ── v1 records ────────────────────────────────────────────────────── */

/** v1 Character = v0 fields + optimistic-concurrency revision. */
export interface CharacterRecord {
  id: string;
  accountId: string;
  name: string;
  roleId: RoleId | null;
  directive: string;
  mind: MindConfig | null;
  lifecycle: Lifecycle;
  /** Positive integer; every mutation requires expectedRevision. */
  revision: number;
  createdAt: number;
  updatedAt: number;
  unleashedAt: number | null;
  recalledAt: number | null;
}

/** Secret-free mind view. `secretHint` is "configured" or null — full stop. */
export interface PublicMindV1 {
  config: MindConfig;
  secretHint: "configured" | null;
}

export interface CharacterView {
  character: CharacterRecord;
  publicMind: PublicMindV1 | null;
}

export interface RolePackManifestEntryV1 {
  id: RoleId;
  label: string;
  summary: string;
  file: string;
  startingSkills: Partial<Record<string, number>>;
}

export interface RolePackManifestV1 {
  version: 1;
  packs: RolePackManifestEntryV1[];
}

/* ── v1 runtime status overlay ─────────────────────────────────────── */

export type DriverV1 = "mind" | "reflex" | "none";
export type MindStateV1 = "unconfigured" | "connecting" | "awake" | "asleep" | "error";
export type RuntimeStateV1 = "inactive" | "starting" | "running" | "degraded" | "recovering";
export type ReflexStateV1 = "ready" | "unavailable" | "budget-exhausted";

export interface CharacterStatusV1 {
  characterId: string;
  lifecycle: Lifecycle;
  driver: DriverV1;
  mindState: MindStateV1;
  runtimeState: RuntimeStateV1;
  reflexState: ReflexStateV1;
  reasonCode: string | null;
  /** Shard tick at which the sleeping mind handed over to reflexes. */
  autopilotSince: number | null;
  lastMindExchangeTick: number | null;
  /** Last completed, logged reflex decision — not every tick. */
  lastReflexTick: number | null;
  /** Last authoritative world effect — not mere queue admission. */
  lastAppliedActionTick: number | null;
  configRevision: number;
  body: { hp: number; maxHp: number; x: number; z: number; task: string } | null;
  journalTail: string[];
}

/* ── v1 request/response DTOs ──────────────────────────────────────── */

export interface CreateAccountResponse {
  account: Account;
  /** Shown exactly once; the host stores only a digest. */
  ownerToken: string;
}

export interface ListCharactersResponse {
  characters: CharacterView[];
}

export interface UnleashResponse {
  characterId: string;
  lifecycle: "unleashed";
  agentId: string;
  startedTick: number;
  mindState: MindStateV1;
  driver: DriverV1;
}

export interface RecallResponse {
  lifecycle: "recalled";
  stoppedTick: number;
}

export interface JournalEntry {
  sequence: number;
  tick: number;
  source: "mind" | "system";
  text: string;
}

export interface JournalPage {
  entries: JournalEntry[];
  nextCursor: number | null;
}

export interface CharacterPatch {
  name?: string;
  roleId?: RoleId | null;
  directive?: string;
  mind?: MindConfig | null;
  expectedRevision: number;
}

/* ── Error envelope ────────────────────────────────────────────────── */

/** `{error:{code,message,field?},fields?}` exactly as v1 §2 specifies. */
export class ConsoleApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field: string | undefined;
  readonly fields: FieldError[] | undefined;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    field?: string;
    fields?: FieldError[];
  }) {
    super(args.message);
    this.name = "ConsoleApiError";
    this.status = args.status;
    this.code = args.code;
    this.field = args.field;
    this.fields = args.fields;
  }

  /** True for transient host/network failures where the form must survive. */
  get recoverable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export function isConsoleApiError(x: unknown): x is ConsoleApiError {
  return x instanceof ConsoleApiError;
}

/* ── API surface ───────────────────────────────────────────────────── */

export interface ConsoleApi {
  /** Unauthenticated. Requires an Idempotency-Key; replay returns the same
   *  account and token, never a second account. */
  createAccount(args: { idempotencyKey: string }): Promise<CreateAccountResponse>;
  listRoles(): Promise<RolePackManifestV1>;
  listCharacters(): Promise<ListCharactersResponse>;
  createCharacter(args: {
    idempotencyKey: string;
    name: string;
    roleId?: RoleId;
    directive?: string;
    mind?: MindConfig;
  }): Promise<CharacterView>;
  getCharacter(id: string): Promise<CharacterView>;
  patchCharacter(id: string, patch: CharacterPatch): Promise<CharacterView>;
  /** 204 — the secret is stored host-side; refetch for the new revision. */
  putMindSecret(id: string, args: { secret: string; expectedRevision: number }): Promise<void>;
  deleteMindSecret(id: string, args: { expectedRevision: number }): Promise<void>;
  unleash(id: string, args: { expectedRevision: number }): Promise<UnleashResponse>;
  recall(id: string, args: { expectedRevision: number }): Promise<RecallResponse>;
  status(id: string): Promise<CharacterStatusV1>;
  journal(id: string, args?: { after?: number; limit?: number }): Promise<JournalPage>;
}

/* ── v1 client-side validation ─────────────────────────────────────── */
/* Mirrors the host's write validation so the form fails fast; the host
 * remains the authority and can still 422. Closed-key: unknown keys,
 * arrays, and wrong types are rejected, and secrets inside config are an
 * error, never persisted. */

export const MODEL_MAX = 128;

function fieldError(field: string, code: string, message: string): FieldError {
  return { field, code, message };
}

export function validateEndpointUrl(raw: string, field: string): FieldError | null {
  if (raw.length > ENDPOINT_URL_MAX) return fieldError(field, "TOO_LONG", "That URL is too long.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fieldError(field, "BAD_URL", "That is not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return fieldError(field, "BAD_SCHEME", "Only http(s) endpoints are supported.");
  }
  if (url.username !== "" || url.password !== "") {
    return fieldError(field, "USERINFO", "Do not embed credentials in the URL — use the key field instead.");
  }
  if (url.search !== "" || url.hash !== "") {
    return fieldError(field, "URL_PARTS", "Query strings and fragments are not allowed in endpoint URLs.");
  }
  return null;
}

export function validateModelValue(model: unknown, field: string): FieldError | null {
  if (model === undefined) return null;
  if (typeof model !== "string") return fieldError(field, "TYPE", "Model must be text.");
  const trimmed = model.trim();
  if (trimmed.length === 0 || trimmed.length > MODEL_MAX) {
    return fieldError(field, "MODEL_LENGTH", `Model must be 1–${MODEL_MAX} characters.`);
  }
  return null;
}

/** Closed-key mind validation (v1 §1). Empty array = valid. */
export function validateMindConfigV1(mind: unknown): FieldError[] {
  if (mind === null || typeof mind !== "object" || Array.isArray(mind)) {
    return [fieldError("mind", "TYPE", "Mind configuration must be an object.")];
  }
  const m = mind as Record<string, unknown>;
  const errs: FieldError[] = [];
  const allow =
    m.kind === "cloud"
      ? new Set(["kind", "provider", "baseUrl", "model"])
      : m.kind === "local"
        ? new Set(["kind", "endpointUrl", "model"])
        : new Set(["kind"]);
  for (const key of Object.keys(m)) {
    if (!allow.has(key)) {
      errs.push(
        fieldError(
          `mind.${key}`,
          "UNKNOWN_KEY",
          key === "apiKey" || key === "secret"
            ? "Keys go in the dedicated secret field, never inside the mind configuration."
            : `Unknown mind configuration key "${key}".`,
        ),
      );
    }
  }
  if (m.kind === "cloud") {
    if (!CLOUD_PROVIDERS.includes(m.provider as (typeof CLOUD_PROVIDERS)[number])) {
      errs.push(fieldError("mind.provider", "UNKNOWN_PROVIDER", `Provider must be one of: ${CLOUD_PROVIDERS.join(", ")}.`));
    }
    if (m.baseUrl !== undefined) {
      if (typeof m.baseUrl !== "string") errs.push(fieldError("mind.baseUrl", "TYPE", "Base URL must be text."));
      else {
        const e = validateEndpointUrl(m.baseUrl, "mind.baseUrl");
        if (e) errs.push(e);
      }
    }
    const me = validateModelValue(m.model, "mind.model");
    if (me) errs.push(me);
    return errs;
  }
  if (m.kind === "local") {
    if (typeof m.endpointUrl !== "string" || m.endpointUrl.length === 0) {
      errs.push(fieldError("mind.endpointUrl", "REQUIRED", "Enter your local endpoint URL."));
    } else {
      const e = validateEndpointUrl(m.endpointUrl, "mind.endpointUrl");
      if (e) errs.push(e);
    }
    const me = validateModelValue(m.model, "mind.model");
    if (me) errs.push(me);
    return errs;
  }
  errs.push(fieldError("mind.kind", "UNKNOWN_KIND", 'Mind kind must be "cloud" or "local".'));
  return errs;
}

/** A name-only draft must save; unleash-time readiness is a separate bar. */
export function validateNameValue(name: string): FieldError | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return fieldError("name", "REQUIRED", "Name your character.");
  if (trimmed.length > NAME_MAX) return fieldError("name", "TOO_LONG", `Keep the name under ${NAME_MAX} characters.`);
  return null;
}

export function validateDirectiveValue(directive: string): FieldError | null {
  if (directive.length > DIRECTIVE_MAX) {
    return fieldError("directive", "TOO_LONG", `Keep the directive under ${DIRECTIVE_MAX} characters.`);
  }
  return null;
}

/* ── HTTP implementation ───────────────────────────────────────────── */

export interface ConsoleHttpOptions {
  /** Same-origin by default; override for a split host. */
  baseUrl?: string;
  /** Bearer supplier — called per request, never stored by the client. */
  getToken: () => string | null;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

// The account-create route intentionally omits the durable creation time.
// Preserve the internal Account shape with 0 meaning unknown, never Date.now()
// (which would invent a timestamp and change on idempotent replay).
interface HostCreateAccountResponse {
  accountId: string;
  ownerToken: string;
  billing: Account["billing"];
}

function characterFromHost(view: HostCharacterView): CharacterView {
  const c = view.character;
  return {
    character: {
      id: c.characterId, accountId: c.accountId, name: c.name,
      roleId: c.roleId, directive: c.directive, mind: c.mind,
      lifecycle: c.lifecycle, revision: c.revision,
      createdAt: c.createdAt, updatedAt: c.updatedAt,
      unleashedAt: c.unleashedAt, recalledAt: c.recalledAt,
    },
    publicMind: view.publicMind,
  };
}

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export function createConsoleHttpApi(opts: ConsoleHttpOptions): ConsoleApi {
  const base = (opts.baseUrl ?? "").replace(/\/+$/, "");
  const doFetch = opts.fetchImpl ?? fetch;

  async function call<T>(
    method: string,
    path: string,
    body: unknown,
    extra?: { idempotencyKey?: string },
  ): Promise<T> {
    const headers: Record<string, string> = { ...JSON_HEADERS };
    const token = opts.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (extra?.idempotencyKey) headers["Idempotency-Key"] = extra.idempotencyKey;
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
    } catch {
      throw new ConsoleApiError({
        status: 0,
        code: "NETWORK",
        message: "Could not reach the Emberhall host. Check your connection and retry.",
      });
    }
    if (res.status === 204) return undefined as T;
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      /* non-JSON error page — fall through to generic mapping */
    }
    if (!res.ok) {
      const env = (parsed ?? {}) as {
        error?: { code?: string; message?: string; field?: string };
        fields?: FieldError[];
      };
      throw new ConsoleApiError({
        status: res.status,
        code: env.error?.code ?? `HTTP_${res.status}`,
        message:
          env.error?.message ??
          (res.status === 401
            ? "That owner token was not recognized."
            : res.status === 404
              ? "Not found."
              : `The host answered ${res.status}.`),
        ...(env.error?.field !== undefined ? { field: env.error.field } : {}),
        ...(env.fields !== undefined ? { fields: env.fields } : {}),
      });
    }
    return parsed as T;
  }

  return {
    createAccount: async ({ idempotencyKey }) => {
      const wire = await call<HostCreateAccountResponse>("POST", "/api/v1/accounts", {}, { idempotencyKey });
      return { account: { id: wire.accountId, createdAt: 0, billing: wire.billing }, ownerToken: wire.ownerToken };
    },
    listRoles: async () => {
      // The host serves the v1 manifest entries but omits its version field.
      const wire = await call<Pick<HostRolePackManifest, "roles">>("GET", "/api/v1/roles", undefined);
      return { version: 1, packs: wire.roles };
    },
    listCharacters: async () => {
      const wire = await call<{ characters: HostCharacterView[] }>("GET", "/api/v1/characters", undefined);
      return { characters: wire.characters.map(characterFromHost) };
    },
    createCharacter: async ({ idempotencyKey, ...body }) =>
      characterFromHost(await call<HostCharacterView>("POST", "/api/v1/characters", body, { idempotencyKey })),
    getCharacter: async (id) => characterFromHost(await call<HostCharacterView>("GET", `/api/v1/characters/${id}`, undefined)),
    patchCharacter: async (id, patch) => characterFromHost(await call<HostCharacterView>("PATCH", `/api/v1/characters/${id}`, patch)),
    putMindSecret: (id, args) => call("PUT", `/api/v1/characters/${id}/mind-secret`, args),
    deleteMindSecret: (id, args) => call("DELETE", `/api/v1/characters/${id}/mind-secret`, args),
    unleash: (id, args) => call("POST", `/api/v1/characters/${id}/unleash`, args),
    recall: (id, args) => call("POST", `/api/v1/characters/${id}/recall`, args),
    status: (id) => call("GET", `/api/v1/characters/${id}/status`, undefined),
    journal: (id, args) => {
      const q = new URLSearchParams();
      if (args?.after !== undefined) q.set("after", String(args.after));
      if (args?.limit !== undefined) q.set("limit", String(args.limit));
      const qs = q.toString();
      return call("GET", `/api/v1/characters/${id}/journal${qs ? `?${qs}` : ""}`, undefined);
    },
  };
}
