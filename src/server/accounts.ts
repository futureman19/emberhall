/**
 * Phase 4 director — the host-side account/character service (v1 §1–§4, §7.2).
 *
 * The server owns all state; the browser is never authoritative. This module
 * persists accounts, characters, selected roles, directives, mind configuration
 * and lifecycle state using the shard's existing host conventions (atomic
 * rename, restricted permissions, schemaVersion:1 envelopes). It extends the
 * shared-world shard additively: the dev-key WebSocket path and the soak
 * harness keep working unchanged.
 *
 * Secrets are encrypted at rest with an operator key held OUTSIDE the data
 * directory; when that key is unavailable, secret writes are rejected
 * (PROTECTION_UNAVAILABLE) rather than stored in plaintext. Credentials never
 * appear in logs or ordinary API responses — only a presence `secretHint`.
 *
 * The live mind/reflex runtime is owned by the integration lane. This service
 * consumes an injectable RuntimePort; the default passive port keeps
 * lifecycle/persistence honest without driving a provider, so no reflex tokens
 * are spent here.
 *
 * Normative spec: docs/phase-4-contracts-v1.md. Error envelope, routes and
 * response shapes follow §2 exactly; the shared validators in
 * src/game/agent/account.ts are the single validation surface.
 */
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  BETA_BILLING,
  SECRET_MAX,
  activationAllowed,
  isRoleId,
  nextLifecycle,
  readinessErrors,
  validateDirective,
  validateMindConfig,
  validateName,
  type Account,
  type Character,
  type CharacterStatus,
  type CharacterView,
  type Driver,
  type EndpointPolicy,
  type FieldError,
  type JournalEntry,
  type JournalPage,
  type MindConfig,
  type MindState,
  type PublicMind,
  type ReflexState,
  type RoleId,
  type RolePackManifest,
  type RolePackManifestEntry,
  type RuntimeState,
} from "../game/agent/account.ts";
import { SKILL_META } from "../game/catalog.ts";

/* ── Closed error envelope (v1 §2) ─────────────────────────────────────── */

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "VALIDATION"
  | "UNKNOWN_ROLE"
  | "MODEL_REQUIRED"
  | "REVISION_CONFLICT"
  | "CONFIG_INCOMPLETE"
  | "NOT_RUNNING"
  | "RECALL_REQUIRED"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "CONFIG_UNAVAILABLE"
  | "PROTECTION_UNAVAILABLE"
  | "RUNTIME_UNAVAILABLE"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  VALIDATION: 422,
  UNKNOWN_ROLE: 422,
  MODEL_REQUIRED: 422,
  REVISION_CONFLICT: 409,
  CONFIG_INCOMPLETE: 409,
  NOT_RUNNING: 409,
  RECALL_REQUIRED: 409,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  CONFIG_UNAVAILABLE: 503,
  PROTECTION_UNAVAILABLE: 503,
  RUNTIME_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class DirectorError extends Error {
  readonly code: ErrorCode;
  readonly field?: string;
  readonly fields?: FieldError[];
  constructor(code: ErrorCode, message: string, field?: string, fields?: FieldError[]) {
    super(message);
    this.name = "DirectorError";
    this.code = code;
    this.field = field;
    this.fields = fields;
  }
}

const fail = (code: ErrorCode, message: string, field?: string): DirectorError =>
  new DirectorError(code, message, field);

/* ── Shard seam (additive methods on createShard) ──────────────────────── */

export interface AgentBodySeed {
  id: string;
  name: string;
  key: string;
  skills: Partial<Record<string, number>>;
}

export interface DirectorShard {
  /** Register a durable body. Injection happens ONLY when the body's state is
   *  first created AND inject is true; an existing body is never re-granted
   *  skills (restart, recovery and re-unleash are all idempotent). */
  registerAgent(body: AgentBodySeed, inject: boolean): { created: boolean };
  hasAgent(id: string): boolean;
  agentBody(id: string): { hp: number; maxHp: number; x: number; z: number; task: string } | null;
  /** Clear queued intents/work for a recalled body; the body itself persists. */
  recallAgent(id: string): void;
  currentTick(): number;
  save(): void;
}

/* ── Runtime port (integration lane owns the live implementation) ──────── */

export interface RuntimeStatus {
  driver: Driver;
  mindState: MindState;
  runtimeState: RuntimeState;
  reflexState: ReflexState;
  reasonCode: string | null;
  autopilotSince: number | null;
  lastMindExchangeTick: number | null;
  lastReflexTick: number | null;
  lastAppliedActionTick: number | null;
  configRevision?: number;
}

export interface RuntimeServices {
  character(id: string): Character;
  readSecret(id: string): string | null;
  journalTail(id: string): string[];
  appendJournal(id: string, source: "mind" | "system", text: string): unknown;
  recordDecision(row: import("../game/agent/types.ts").DecisionLogRow): void;
}

export interface RuntimePort {
  ensureAgent(character: Character, operationId: string): { ok: boolean; reason?: string };
  stopAgent(characterId: string): void;
  status(character: Character): RuntimeStatus;
}

/** Honest passive port: lifecycle and persistence are real; no provider is
 *  driven and no runtime is attached until the integration lane swaps this. */
export const passiveRuntimePort: RuntimePort = {
  ensureAgent: () => ({ ok: true }),
  stopAgent: () => {},
  status: character => ({
    driver: "none",
    mindState: character.mind ? "asleep" : "unconfigured",
    runtimeState: "inactive",
    reflexState: "ready",
    reasonCode: null,
    autopilotSince: null,
    lastMindExchangeTick: null,
    lastReflexTick: null,
    lastAppliedActionTick: null,
    configRevision: character.revision,
  }),
};

/* ── Storage helpers (shard conventions: atomic rename, 0600/0700) ─────── */

function atomicWrite(path: string, content: string): void {
  writeFileSync(`${path}.tmp`, content, { encoding: "utf8", mode: 0o600 });
  renameSync(`${path}.tmp`, path);
}

function ensurePrivateDir(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  try { chmodSync(path, 0o700); } catch { /* best effort on Windows */ }
}

function readEnvelope<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!raw || typeof raw !== "object" || (raw as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new Error(`Invalid director envelope: ${path}`);
  }
  return raw as T;
}

/* ── Private durable rows ──────────────────────────────────────────────── */

interface AccountRow extends Account {
  displayName: string | null;
  tokenHash: string;
  /** Encrypted owner token so idempotent create can replay the ONLY copy. */
  tokenCipher: string | null;
}

interface CharacterPrivate {
  bodyId: string;
  bodyKey: string;
  spawnInitialized: boolean;
  recoveryOperation: string | null;
}

interface IdempotencyRecord {
  kind: "account" | "character";
  accountId: string;
  resultId: string;
  fingerprint: string;
  tokenCipher?: string;
  createdAt: number;
}

interface AccountsFile { schemaVersion: 1; accounts: AccountRow[] }
interface CharactersFile { schemaVersion: 1; characters: Character[] }
interface PrivateFile { schemaVersion: 1; rows: Record<string, CharacterPrivate> }
interface IdempotencyFile { schemaVersion: 1; records: Record<string, IdempotencyRecord> }

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const BODY_LIMIT_BYTES = 16 * 1024;
const JOURNAL_READ_CAP = 500;
const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

export interface DirectorOptions {
  dataDir: string;
  shard: DirectorShard;
  /** 32-byte operator key, held outside the data directory (env/config). */
  secretKey?: Buffer | null;
  runtime?: RuntimePort;
  runtimeFactory?: (services: RuntimeServices) => RuntimePort;
  policy?: EndpointPolicy;
  defaultModel?: string | null;
  allowedOrigins?: string[];
  rateLimits?: { accountCreatePerHour?: number; mutationsPerMinute?: number };
  manifestFile?: string;
  now?: () => number;
  log?: (line: string) => void;
}

export function createDirector(opts: DirectorOptions) {
  const { dataDir, shard } = opts;
  const secretKey = opts.secretKey ?? null;
  if (secretKey && secretKey.length !== 32) throw new Error("Director secretKey must be 32 bytes");
  let runtime = opts.runtime ?? passiveRuntimePort;
  const policy: EndpointPolicy = opts.policy ?? { allowPrivateEndpoints: false };
  const defaultModel = opts.defaultModel ?? null;
  const allowedOrigins = opts.allowedOrigins ?? DEFAULT_DEV_ORIGINS;
  const createPerHour = opts.rateLimits?.accountCreatePerHour ?? 10;
  const mutationsPerMinute = opts.rateLimits?.mutationsPerMinute ?? 240;
  const manifestFile = opts.manifestFile ?? fileURLToPath(new URL("../../agent-packs/packs.json", import.meta.url));
  const now = opts.now ?? Date.now;
  const log = opts.log ?? console.log;

  ensurePrivateDir(dataDir);
  const accountsPath = join(dataDir, "accounts.json");
  const charactersPath = join(dataDir, "director-characters.json");
  const privatePath = join(dataDir, "director-private.json");
  const idempotencyPath = join(dataDir, "director-idempotency.json");
  const secretsDir = join(dataDir, "secrets");
  const journalDir = join(dataDir, "journal");
  ensurePrivateDir(secretsDir);
  ensurePrivateDir(journalDir);

  const accounts = readEnvelope<AccountsFile>(accountsPath, { schemaVersion: 1, accounts: [] }).accounts;
  const characters = readEnvelope<CharactersFile>(charactersPath, { schemaVersion: 1, characters: [] }).characters;
  const privateRows = readEnvelope<PrivateFile>(privatePath, { schemaVersion: 1, rows: {} }).rows;
  const idempotency = readEnvelope<IdempotencyFile>(idempotencyPath, { schemaVersion: 1, records: {} }).records;
  const tokenIndex = new Map<string, string>(accounts.map(a => [a.tokenHash, a.id]));
  const secretPresence = new Set<string>(
    readdirSync(secretsDir).filter(f => f.endsWith(".enc")).map(f => f.slice(0, -4)),
  );
  const journalCache = new Map<string, JournalEntry[]>();
  const rateWindows = new Map<string, number[]>();
  let manifest: RolePackManifest | null = null;

  const persistAccounts = () => atomicWrite(accountsPath, JSON.stringify({ schemaVersion: 1, accounts } satisfies AccountsFile));
  const persistCharacters = () => atomicWrite(charactersPath, JSON.stringify({ schemaVersion: 1, characters } satisfies CharactersFile));
  const persistPrivate = () => atomicWrite(privatePath, JSON.stringify({ schemaVersion: 1, rows: privateRows } satisfies PrivateFile));
  const persistIdempotency = () => atomicWrite(idempotencyPath, JSON.stringify({ schemaVersion: 1, records: idempotency } satisfies IdempotencyFile));

  /* ── Secrets: AES-256-GCM, operator key outside the data dir ─────────── */

  function encrypt(plain: string): string {
    if (!secretKey) throw fail("PROTECTION_UNAVAILABLE", "This host cannot store secrets: no operator protection key is configured.");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", secretKey, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
  }

  function decrypt(blob: string): string {
    if (!secretKey) throw fail("PROTECTION_UNAVAILABLE", "This host cannot read secrets: no operator protection key is configured.");
    const raw = Buffer.from(blob, "base64");
    const decipher = createDecipheriv("aes-256-gcm", secretKey, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  }

  const secretPath = (id: string) => join(secretsDir, `${id}.enc`);
  const hasSecret = (id: string) => secretPresence.has(id);
  function readSecret(id: string): string | null {
    if (!secretPresence.has(id)) return null;
    return decrypt(readFileSync(secretPath(id), "utf8"));
  }
  function writeSecret(id: string, value: string): void {
    const blob = encrypt(value); // throws PROTECTION_UNAVAILABLE before any write
    atomicWrite(secretPath(id), blob);
    secretPresence.add(id);
  }
  function deleteSecret(id: string): void {
    if (!secretPresence.has(id)) return;
    unlinkSync(secretPath(id));
    secretPresence.delete(id);
  }

  /* ── Manifest ────────────────────────────────────────────────────────── */

  function loadManifest(): RolePackManifest {
    if (manifest) return manifest;
    let raw: unknown;
    try { raw = JSON.parse(readFileSync(manifestFile, "utf8")); }
    catch { throw fail("CONFIG_UNAVAILABLE", "The role pack manifest is unavailable on this host."); }
    const m = raw as RolePackManifest;
    if (!m || m.version !== 1 || !Array.isArray(m.roles) || m.roles.length === 0) {
      throw fail("CONFIG_UNAVAILABLE", "The role pack manifest is invalid.");
    }
    for (const entry of m.roles) {
      if (!isRoleId(entry.id) || typeof entry.label !== "string" || typeof entry.summary !== "string" ||
        typeof entry.file !== "string" || !entry.startingSkills || typeof entry.startingSkills !== "object") {
        throw fail("CONFIG_UNAVAILABLE", "The role pack manifest is invalid.");
      }
      for (const skill of Object.keys(entry.startingSkills)) {
        if (!Object.hasOwn(SKILL_META, skill)) throw fail("CONFIG_UNAVAILABLE", `Manifest names unknown skill ${skill}.`);
      }
    }
    manifest = m;
    return m;
  }

  function roleEntry(roleId: string): RolePackManifestEntry {
    const entry = loadManifest().roles.find(r => r.id === roleId);
    if (!entry) throw fail("UNKNOWN_ROLE", "That role does not exist.", "roleId");
    return entry;
  }

  /* ── Rate limiting (sliding window, bounded memory) ──────────────────── */

  function rateLimit(key: string, limit: number, windowMs: number): void {
    const t = now();
    const hits = (rateWindows.get(key) ?? []).filter(at => t - at < windowMs);
    if (hits.length >= limit) {
      rateWindows.set(key, hits);
      throw fail("RATE_LIMITED", "Too many requests — wait a moment and try again.");
    }
    hits.push(t);
    rateWindows.set(key, hits);
    if (rateWindows.size > 4096) {
      for (const [k, v] of rateWindows) if (v.every(at => t - at >= windowMs)) rateWindows.delete(k);
    }
  }

  /* ── Idempotency (24h, fingerprinted, account-scoped) ────────────────── */

  function validateIdempotencyKey(key: unknown): string | null {
    if (key === undefined || key === null) return null;
    if (typeof key !== "string" || key.length < 16 || key.length > 128) {
      throw fail("VALIDATION", "Idempotency-Key must be an opaque string of 16–128 characters.", "Idempotency-Key");
    }
    return key;
  }

  function findIdempotent(key: string | null, kind: "account" | "character", accountId: string, body: unknown): IdempotencyRecord | null {
    if (!key) return null;
    const t = now();
    for (const [k, rec] of Object.entries(idempotency)) {
      if (t - rec.createdAt > IDEMPOTENCY_TTL_MS) delete idempotency[k];
    }
    const existing = idempotency[key];
    if (!existing) return null;
    const fingerprint = createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
    if (existing.kind !== kind || existing.accountId !== accountId || existing.fingerprint !== fingerprint) {
      throw fail("CONFLICT", "This Idempotency-Key was already used with a different request.");
    }
    return existing;
  }

  function storeIdempotent(key: string | null, rec: IdempotencyRecord): void {
    if (!key) return;
    idempotency[key] = rec;
    persistIdempotency();
  }

  /* ── Journal (append-only jsonl, secret-free) ────────────────────────── */

  function journalEntries(id: string): JournalEntry[] {
    let entries = journalCache.get(id);
    if (!entries) {
      entries = [];
      const path = join(journalDir, `${id}.jsonl`);
      if (existsSync(path)) {
        for (const line of readFileSync(path, "utf8").split("\n")) {
          if (!line.trim()) continue;
          try {
            const e = JSON.parse(line) as JournalEntry;
            if (typeof e.sequence === "number" && typeof e.tick === "number" &&
              (e.source === "mind" || e.source === "system") && typeof e.text === "string") entries.push(e);
          } catch { /* skip torn trailing line */ }
        }
      }
      journalCache.set(id, entries);
    }
    return entries;
  }

  function appendJournal(id: string, source: "mind" | "system", text: string): JournalEntry {
    const entries = journalEntries(id);
    const entry: JournalEntry = {
      sequence: (entries[entries.length - 1]?.sequence ?? 0) + 1,
      tick: shard.currentTick(),
      source,
      text,
    };
    appendFileSync(join(journalDir, `${id}.jsonl`), `${JSON.stringify(entry)}\n`, { encoding: "utf8", mode: 0o600 });
    entries.push(entry);
    return entry;
  }

  /* ── Views ───────────────────────────────────────────────────────────── */

  function publicMind(character: Character): PublicMind | null {
    if (!character.mind) return null;
    return { config: character.mind, secretHint: hasSecret(character.characterId) ? "configured" : null };
  }

  function view(character: Character): CharacterView {
    return { character, publicMind: publicMind(character) };
  }

  function findCharacter(id: string): Character {
    const character = characters.find(c => c.characterId === id);
    if (!character) throw fail("NOT_FOUND", "No such character.");
    return character;
  }

  function ownedCharacter(accountId: string, id: string): Character {
    const character = findCharacter(id);
    // Ownership isolation: another account's character is indistinguishable
    // from a missing one.
    if (character.accountId !== accountId) throw fail("NOT_FOUND", "No such character.");
    return character;
  }

  function privateRow(id: string): CharacterPrivate {
    const row = privateRows[id];
    if (!row) throw fail("INTERNAL", "Character is missing its private host row.");
    return row;
  }

  function bump(character: Character): void {
    character.revision += 1;
    character.updatedAt = now();
    persistCharacters();
  }

  function readinessCtx(id: string) {
    return { hasMindSecret: hasSecret(id), defaultModel, allowPrivateEndpoints: policy.allowPrivateEndpoints };
  }

  function refreshReadiness(character: Character): void {
    if (character.lifecycle !== "draft" && character.lifecycle !== "ready") return;
    character.lifecycle = readinessErrors(character, readinessCtx(character.characterId)).length === 0 ? "ready" : "draft";
  }

  /* ── Field parsing on the shared validation surface ──────────────────── */

  function closedKeys(body: Record<string, unknown>, allowed: string[]): void {
    const fields: FieldError[] = [];
    for (const key of Object.keys(body)) {
      if (!allowed.includes(key)) fields.push({ field: key, code: "UNKNOWN_FIELD", message: `Unknown field "${key}".` });
    }
    if (fields.length) throw new DirectorError("VALIDATION", "The request has unknown fields.", undefined, fields);
  }

  function parseRoleId(value: unknown): RoleId | null {
    if (value === undefined || value === null) return null;
    if (!isRoleId(value)) throw fail("UNKNOWN_ROLE", "That role does not exist.", "roleId");
    roleEntry(value); // manifest must actually carry the role
    return value;
  }

  function parseDirectiveField(value: unknown): string {
    const err = validateDirective(value, { required: false });
    if (err) throw new DirectorError("VALIDATION", err.message, err.field, [err]);
    return typeof value === "string" ? value : "";
  }

  function parseMindField(value: unknown): MindConfig | null {
    if (value === undefined || value === null) return null;
    const errs = validateMindConfig(value, policy);
    if (errs.length) throw new DirectorError("VALIDATION", "The mind configuration is invalid.", errs[0].field, errs);
    const m = value as Record<string, unknown>;
    if (m.kind === "cloud") {
      const baseUrl = typeof m.baseUrl === "string" ? m.baseUrl.trim() : "";
      const model = typeof m.model === "string" ? m.model.trim() : "";
      return { kind: "cloud", provider: "openai-compatible", ...(baseUrl ? { baseUrl } : {}), ...(model ? { model } : {}) };
    }
    const model = typeof m.model === "string" ? m.model.trim() : "";
    return { kind: "local", endpointUrl: (m.endpointUrl as string).trim(), ...(model ? { model } : {}) };
  }

  function parseApiKey(value: unknown, mind: MindConfig | null): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string" || value.trim().length === 0 || value.length > SECRET_MAX) {
      throw fail("VALIDATION", `The API key must be 1–${SECRET_MAX} characters.`, "apiKey");
    }
    if (mind?.kind !== "cloud") {
      throw fail("VALIDATION", "API keys only apply to cloud minds — local endpoints take no key.", "apiKey");
    }
    return value;
  }

  function parseExpectedRevision(body: Record<string, unknown>, character: Character): void {
    const expected = body.expectedRevision;
    if (typeof expected !== "number" || !Number.isInteger(expected) || expected !== character.revision) {
      throw fail("REVISION_CONFLICT", "This character changed since you loaded it — reload and retry.", "expectedRevision");
    }
  }

  /* ── Accounts ────────────────────────────────────────────────────────── */

  function createAccount(body: unknown, idemKey: unknown, ip: string): { accountId: string; ownerToken: string; billing: typeof BETA_BILLING } {
    rateLimit(`create:${ip}`, createPerHour, 60 * 60 * 1000);
    const key = validateIdempotencyKey(idemKey);
    const b = (body ?? {}) as Record<string, unknown>;
    closedKeys(b, ["displayName"]);
    let displayName: string | null = null;
    if (b.displayName !== undefined && b.displayName !== null) {
      if (typeof b.displayName !== "string" || b.displayName.trim().length === 0 || b.displayName.length > 64) {
        throw fail("VALIDATION", "Display name must be 1–64 characters.", "displayName");
      }
      displayName = b.displayName.trim();
    }
    const replay = findIdempotent(key, "account", "anon", b);
    if (replay) {
      if (!replay.tokenCipher) throw fail("CONFIG_UNAVAILABLE", "Account replay needs the operator protection key.");
      return { accountId: replay.resultId, ownerToken: decrypt(replay.tokenCipher), billing: BETA_BILLING };
    }
    const ownerToken = `ehk_${randomBytes(24).toString("base64url")}`;
    const account: AccountRow = {
      id: `acc-${randomUUID()}`,
      createdAt: now(),
      billing: BETA_BILLING,
      displayName,
      tokenHash: createHash("sha256").update(ownerToken).digest("hex"),
      tokenCipher: secretKey ? encrypt(ownerToken) : null,
    };
    accounts.push(account);
    tokenIndex.set(account.tokenHash, account.id);
    persistAccounts();
    storeIdempotent(key, {
      // Account creation is scoped to the anonymous creator: the replay
      // lookup (findIdempotent ... "anon") runs before any account id exists,
      // so the stored scope must match it or every retry mismatches ⇒ 409.
      kind: "account", accountId: "anon", resultId: account.id,
      fingerprint: createHash("sha256").update(JSON.stringify(b)).digest("hex"),
      tokenCipher: account.tokenCipher ?? undefined, createdAt: now(),
    });
    log(`director account created ${account.id}`);
    return { accountId: account.id, ownerToken, billing: BETA_BILLING };
  }

  function authenticate(req: IncomingMessage): string {
    const header = req.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) throw fail("UNAUTHORIZED", "Sign in with your owner token.");
    const hash = createHash("sha256").update(header.slice(7).trim()).digest("hex");
    const accountId = tokenIndex.get(hash);
    if (!accountId) throw fail("UNAUTHORIZED", "Sign in with your owner token.");
    return accountId;
  }

  /* ── Characters ──────────────────────────────────────────────────────── */

  function createCharacter(accountId: string, body: unknown, idemKey: unknown): CharacterView {
    rateLimit(`mut:${accountId}`, mutationsPerMinute, 60 * 1000);
    const key = validateIdempotencyKey(idemKey);
    const b = (body ?? {}) as Record<string, unknown>;
    closedKeys(b, ["name", "roleId", "directive", "mind", "apiKey"]);
    const nameErr = validateName(b.name);
    if (nameErr) throw new DirectorError("VALIDATION", nameErr.message, nameErr.field, [nameErr]);
    const name = (b.name as string).trim();
    const roleId = parseRoleId(b.roleId);
    const directive = parseDirectiveField(b.directive);
    const mind = parseMindField(b.mind);
    const apiKey = parseApiKey(b.apiKey, mind);
    if (apiKey && !secretKey) {
      throw fail("PROTECTION_UNAVAILABLE", "This host cannot store secrets: no operator protection key is configured.");
    }
    const replay = findIdempotent(key, "character", accountId, b);
    if (replay) return view(ownedCharacter(accountId, replay.resultId));
    if (characters.some(c => c.accountId === accountId && c.name === name)) {
      throw fail("CONFLICT", "You already have a character with that name.", "name");
    }

    const characterId = `char-${randomUUID()}`;
    const character: Character = {
      characterId, accountId, name, roleId, directive, mind,
      lifecycle: "draft", revision: 1, billing: BETA_BILLING,
      createdAt: now(), updatedAt: now(), unleashedAt: null, recalledAt: null,
    };
    if (apiKey) writeSecret(characterId, apiKey);
    refreshReadiness(character);
    characters.push(character);
    privateRows[characterId] = {
      bodyId: characterId,
      bodyKey: `dir-${randomBytes(16).toString("hex")}`,
      spawnInitialized: false,
      recoveryOperation: null,
    };
    persistCharacters();
    persistPrivate();
    storeIdempotent(key, {
      kind: "character", accountId, resultId: characterId,
      fingerprint: createHash("sha256").update(JSON.stringify(b)).digest("hex"),
      createdAt: now(),
    });
    appendJournal(characterId, "system", `${name} was created.`);
    log(`director character created ${characterId}`);
    return view(character);
  }

  function listCharacters(accountId: string): { characters: CharacterView[] } {
    return { characters: characters.filter(c => c.accountId === accountId).map(view) };
  }

  function getCharacter(accountId: string, id: string): CharacterView {
    return view(ownedCharacter(accountId, id));
  }

  function updateCharacter(accountId: string, id: string, body: unknown): CharacterView {
    rateLimit(`mut:${accountId}`, mutationsPerMinute, 60 * 1000);
    const stored = ownedCharacter(accountId, id);
    const character = structuredClone(stored);
    const b = (body ?? {}) as Record<string, unknown>;
    closedKeys(b, ["expectedRevision", "name", "roleId", "directive", "mind"]);
    parseExpectedRevision(b, character);
    if (b.name !== undefined) {
      const nameErr = validateName(b.name);
      if (nameErr) throw new DirectorError("VALIDATION", nameErr.message, nameErr.field, [nameErr]);
      const name = (b.name as string).trim();
      if (name !== character.name && characters.some(c => c.accountId === accountId && c.name === name && c.characterId !== id)) {
        throw fail("CONFLICT", "You already have a character with that name.", "name");
      }
      character.name = name;
    }
    if (b.roleId !== undefined) character.roleId = parseRoleId(b.roleId);
    if (b.directive !== undefined) {
      const directive = parseDirectiveField(b.directive);
      if (character.lifecycle === "unleashed" && directive.trim().length === 0) {
        throw fail("RECALL_REQUIRED", "Recall the character before clearing its directive.", "directive");
      }
      character.directive = directive;
    }
    if (b.mind !== undefined) {
      if (character.lifecycle === "unleashed" && b.mind === null) {
        throw fail("RECALL_REQUIRED", "Recall the character before disconnecting its mind.", "mind");
      }
      character.mind = parseMindField(b.mind);
    }
    if (character.lifecycle === "unleashed" && readinessErrors(character, readinessCtx(id)).length) {
      throw fail("RECALL_REQUIRED", "Recall the character before making its configuration incomplete.");
    }
    refreshReadiness(character);
    Object.assign(stored, character);
    bump(stored);
    return view(stored);
  }

  function putMindSecret(accountId: string, id: string, body: unknown): void {
    rateLimit(`mut:${accountId}`, mutationsPerMinute, 60 * 1000);
    const character = ownedCharacter(accountId, id);
    const b = (body ?? {}) as Record<string, unknown>;
    closedKeys(b, ["secret", "expectedRevision"]);
    parseExpectedRevision(b, character);
    if (character.mind?.kind !== "cloud") {
      throw fail("VALIDATION", "Only cloud minds take an API key.", "secret");
    }
    if (typeof b.secret !== "string" || b.secret.trim().length === 0 || b.secret.length > SECRET_MAX) {
      throw fail("VALIDATION", `The API key must be 1–${SECRET_MAX} characters.`, "secret");
    }
    writeSecret(id, b.secret);
    refreshReadiness(character);
    bump(character);
    log(`director secret updated ${id}`);
  }

  function deleteMindSecret(accountId: string, id: string, body: unknown): void {
    rateLimit(`mut:${accountId}`, mutationsPerMinute, 60 * 1000);
    const character = ownedCharacter(accountId, id);
    const b = (body ?? {}) as Record<string, unknown>;
    closedKeys(b, ["expectedRevision"]);
    parseExpectedRevision(b, character);
    if (character.lifecycle === "unleashed") {
      throw fail("RECALL_REQUIRED", "Recall the character before deleting its API key.");
    }
    deleteSecret(id);
    refreshReadiness(character);
    bump(character);
    log(`director secret deleted ${id}`);
  }

  /* ── Lifecycle ───────────────────────────────────────────────────────── */

  function bodySeed(character: Character): AgentBodySeed {
    const row = privateRow(character.characterId);
    const skills = character.roleId ? roleEntry(character.roleId).startingSkills : {};
    return { id: row.bodyId, name: character.name, key: row.bodyKey, skills };
  }

  function unleashResponse(character: Character) {
    const status = runtime.status(character);
    return {
      characterId: character.characterId,
      lifecycle: "unleashed" as const,
      agentId: privateRow(character.characterId).bodyId,
      startedTick: shard.currentTick(),
      mindState: status.mindState,
      driver: status.driver,
    };
  }

  function unleash(accountId: string, id: string, body: unknown) {
    rateLimit(`mut:${accountId}`, mutationsPerMinute, 60 * 1000);
    const character = ownedCharacter(accountId, id);
    const account = accounts.find(a => a.id === accountId);
    if (!account || !activationAllowed(account)) throw fail("INTERNAL", "Account is unavailable.");
    // Already-achieved unleash is idempotent success even with a stale revision.
    if (character.lifecycle === "unleashed") return unleashResponse(character);
    const b = (body ?? {}) as Record<string, unknown>;
    closedKeys(b, ["expectedRevision"]);
    if (character.lifecycle === "draft") {
      const fields = readinessErrors(character, readinessCtx(id));
      throw new DirectorError("CONFIG_INCOMPLETE", "Finish the configuration before unleashing.", undefined, fields);
    }
    parseExpectedRevision(b, character);
    if (character.mind?.kind === "cloud" && hasSecret(id) && !secretKey) {
      throw fail("PROTECTION_UNAVAILABLE", "This host cannot read the stored API key: no operator protection key is configured.");
    }
    const fields = readinessErrors(character, readinessCtx(id));
    if (fields.length) throw new DirectorError("CONFIG_INCOMPLETE", "Finish the configuration before unleashing.", undefined, fields);
    if (nextLifecycle(character.lifecycle, "unleash") === null) throw fail("CONFIG_INCOMPLETE", "This character cannot be unleashed.");

    // Crash-safe activation (v1 §4): persist desired state + operation id
    // BEFORE side effects; recovery reconciles body existence and checkpoint.
    const operationId = randomUUID();
    const row = privateRow(id);
    character.lifecycle = "unleashed";
    character.unleashedAt = now();
    row.recoveryOperation = operationId;
    bump(character);
    persistPrivate();

    shard.registerAgent(bodySeed(character), !row.spawnInitialized);
    row.spawnInitialized = true;
    persistPrivate();
    shard.save(); // checkpoint actor + spawn marker together

    const started = runtime.ensureAgent(character, operationId);
    if (!started.ok) {
      // Roll the durable lifecycle back; the spawned body persists (one grant).
      character.lifecycle = "recalled";
      character.recalledAt = now();
      row.recoveryOperation = null;
      bump(character);
      persistPrivate();
      throw fail("RUNTIME_UNAVAILABLE", "The agent runtime could not start on this host.");
    }
    appendJournal(id, "system", `${character.name} was unleashed.`);
    log(`director unleashed ${id}`);
    return unleashResponse(character);
  }

  function recall(accountId: string, id: string, body: unknown): { lifecycle: "recalled"; stoppedTick: number } {
    rateLimit(`mut:${accountId}`, mutationsPerMinute, 60 * 1000);
    const character = ownedCharacter(accountId, id);
    if (character.lifecycle === "recalled") return { lifecycle: "recalled", stoppedTick: shard.currentTick() };
    if (character.lifecycle !== "unleashed") throw fail("NOT_RUNNING", "Nothing is running for this character.");
    const b = (body ?? {}) as Record<string, unknown>;
    closedKeys(b, ["expectedRevision"]);
    parseExpectedRevision(b, character);
    runtime.stopAgent(id);
    shard.recallAgent(privateRow(id).bodyId);
    character.lifecycle = "recalled";
    character.recalledAt = now();
    privateRow(id).recoveryOperation = null;
    bump(character);
    persistPrivate();
    appendJournal(id, "system", `${character.name} was recalled.`);
    log(`director recalled ${id}`);
    return { lifecycle: "recalled", stoppedTick: shard.currentTick() };
  }

  /* ── Status / journal ────────────────────────────────────────────────── */

  function status(accountId: string, id: string): CharacterStatus {
    const character = ownedCharacter(accountId, id);
    const overlay = runtime.status(character);
    const entries = journalEntries(id);
    return {
      characterId: id,
      lifecycle: character.lifecycle,
      driver: overlay.driver,
      mindState: overlay.mindState,
      runtimeState: overlay.runtimeState,
      reflexState: overlay.reflexState,
      reasonCode: overlay.reasonCode,
      autopilotSince: overlay.autopilotSince,
      lastMindExchangeTick: overlay.lastMindExchangeTick,
      lastReflexTick: overlay.lastReflexTick,
      lastAppliedActionTick: overlay.lastAppliedActionTick,
      configRevision: overlay.configRevision ?? character.revision,
      body: shard.agentBody(privateRow(id).bodyId),
      journalTail: entries.slice(-5).map(e => e.text),
    };
  }

  function journal(accountId: string, id: string, after: number, limit: number): JournalPage {
    ownedCharacter(accountId, id);
    const entries = journalEntries(id).filter(e => e.sequence > after);
    const cap = Math.max(1, Math.min(JOURNAL_READ_CAP, limit));
    const page = entries.slice(0, cap);
    return { entries: page, nextCursor: entries.length > cap ? page[page.length - 1].sequence : null };
  }

  /* ── Restart recovery (v1 §4) ────────────────────────────────────────── */

  function recover(): void {
    let reconciled = 0;
    for (const character of characters) {
      const row = privateRows[character.characterId];
      if (!row) continue;
      if (row.spawnInitialized || character.lifecycle === "unleashed") {
        // Existing bodies are never re-injected; a crash before the first
        // checkpoint still grants exactly once because registerAgent only
        // injects when the body state is first created.
        shard.registerAgent(bodySeed(character), !row.spawnInitialized);
        row.spawnInitialized = true;
        reconciled += 1;
      }
      if (character.lifecycle === "unleashed") {
        if (!row.recoveryOperation) {
          row.recoveryOperation = randomUUID();
          persistPrivate();
        }
        runtime.ensureAgent(character, row.recoveryOperation);
      }
    }
    if (reconciled > 0) {
      persistPrivate();
      shard.save();
      log(`director recovered ${reconciled} agent bodies`);
    }
  }

  /* ── HTTP routing (v1 §2) ────────────────────────────────────────────── */

  function send(res: ServerResponse, statusCode: number, payload: unknown): void {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(body);
  }

  function sendNoContent(res: ServerResponse): void {
    res.writeHead(204, { "cache-control": "no-store" });
    res.end();
  }

  function sendError(res: ServerResponse, err: unknown): void {
    if (err instanceof DirectorError) {
      const error: { code: ErrorCode; message: string; field?: string } = { code: err.code, message: err.message };
      if (err.field) error.field = err.field;
      const payload: { error: typeof error; fields?: FieldError[] } = { error };
      if (err.fields && err.fields.length) payload.fields = err.fields;
      send(res, STATUS[err.code], payload);
      return;
    }
    // Never log bodies, tokens or provider text — only the error class.
    log(`director internal error: ${err instanceof Error ? err.name : "unknown"}`);
    send(res, 500, { error: { code: "INTERNAL", message: "The host hit an unexpected error." } });
  }

  function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > BODY_LIMIT_BYTES) {
          // Stop buffering but keep the socket open so the 413 JSON envelope
          // can flush to the client. req.destroy() here would RST the
          // connection before the response is written (fetch: "socket hang
          // up"); drain the remainder instead and let the route reply 413.
          req.resume();
          reject(fail("PAYLOAD_TOO_LARGE", `The request body exceeds the ${BODY_LIMIT_BYTES / 1024} KiB limit.`));
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (!text.trim()) return resolve({});
        let parsed: unknown;
        try { parsed = JSON.parse(text); }
        catch { return reject(fail("BAD_REQUEST", "The request body is not valid JSON.")); }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return reject(fail("BAD_REQUEST", "The request body must be a JSON object."));
        }
        resolve(parsed as Record<string, unknown>);
      });
      req.on("error", () => reject(fail("BAD_REQUEST", "The request body could not be read.")));
    });
  }

  function checkOrigin(req: IncomingMessage): void {
    const origin = req.headers.origin;
    if (typeof origin === "string" && origin.length > 0 && !allowedOrigins.includes(origin)) {
      throw fail("FORBIDDEN", "This origin is not allowed to call the director API.");
    }
  }

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://director.local");
    const parts = url.pathname.split("/").filter(Boolean); // ["api","v1",...]
    const method = req.method ?? "GET";
    if (parts[0] !== "api" || parts[1] !== "v1") throw fail("NOT_FOUND", "No such route.");
    const mutating = method !== "GET" && method !== "HEAD";
    if (mutating) checkOrigin(req);

    if (method === "POST" && parts.length === 3 && parts[2] === "accounts") {
      const body = await readBody(req);
      const ip = req.socket.remoteAddress ?? "unknown";
      send(res, 201, createAccount(body, req.headers["idempotency-key"], ip));
      return;
    }
    if (method === "GET" && parts.length === 3 && parts[2] === "roles") {
      send(res, 200, { roles: loadManifest().roles });
      return;
    }
    if (parts[2] !== "characters") throw fail("NOT_FOUND", "No such route.");
    const accountId = authenticate(req);

    if (method === "POST" && parts.length === 3) {
      const body = await readBody(req);
      send(res, 201, createCharacter(accountId, body, req.headers["idempotency-key"]));
      return;
    }
    if (method === "GET" && parts.length === 3) {
      send(res, 200, listCharacters(accountId));
      return;
    }
    const id = parts[3];
    if (!id) throw fail("NOT_FOUND", "No such route.");
    const sub = parts[4];

    if (!sub && method === "GET") return send(res, 200, getCharacter(accountId, id));
    if (!sub && method === "PATCH") return send(res, 200, updateCharacter(accountId, id, await readBody(req)));
    if (sub === "mind-secret" && method === "PUT") {
      putMindSecret(accountId, id, await readBody(req));
      return sendNoContent(res);
    }
    if (sub === "mind-secret" && method === "DELETE") {
      deleteMindSecret(accountId, id, await readBody(req));
      return sendNoContent(res);
    }
    if (sub === "directive" && method === "POST") {
      const body = await readBody(req);
      closedKeys(body, ["expectedRevision", "directive"]);
      if (body.directive === undefined) throw fail("VALIDATION", "Write a directive — one sentence is enough.", "directive");
      return send(res, 200, updateCharacter(accountId, id, body));
    }
    if (sub === "unleash" && method === "POST") return send(res, 200, unleash(accountId, id, await readBody(req)));
    if ((sub === "recall" || sub === "stop" || sub === "pause") && method === "POST") {
      return send(res, 200, recall(accountId, id, await readBody(req)));
    }
    if (sub === "status" && method === "GET") return send(res, 200, status(accountId, id));
    if ((sub === "journal" || sub === "decisions") && method === "GET") {
      const afterRaw = url.searchParams.get("after");
      const limitRaw = url.searchParams.get("limit");
      const after = afterRaw === null ? 0 : Number(afterRaw);
      const limit = limitRaw === null ? 100 : Number(limitRaw);
      if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1) {
        throw fail("VALIDATION", "after and limit must be non-negative integers.");
      }
      return send(res, 200, journal(accountId, id, after, limit));
    }
    throw fail("NOT_FOUND", "No such route.");
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      await route(req, res);
    } catch (err) {
      sendError(res, err);
    }
  }

  if (opts.runtimeFactory) runtime = opts.runtimeFactory({
    character: id => structuredClone(findCharacter(id)),
    readSecret,
    journalTail: id => journalEntries(id).slice(-10).map(e => e.text),
    appendJournal,
    recordDecision: row => appendFileSync(join(dataDir, "director-decisions.jsonl"), `${JSON.stringify(row)}\n`, { encoding: "utf8", mode: 0o600 }),
  });

  return {
    handle, recover, createAccount, createCharacter, listCharacters, getCharacter,
    updateCharacter, putMindSecret, deleteMindSecret, unleash, recall, status, journal,
    roles: () => ({ roles: loadManifest().roles }),
  };
}

export type Director = ReturnType<typeof createDirector>;