/**
 * Phase 4 director console — in-memory v1 mock host.
 *
 * Implements `ConsoleApi` with the semantics of `docs/phase-4-contracts-v1.md`
 * so the console is fully exercisable before the live host lands, and so
 * tests can drive every wire path: idempotent creates, revision conflicts,
 * closed-key validation, readiness vs write validation, the unleash state
 * machine, sleep/wake autopilot overlays, and truthful degraded states.
 *
 * Deliberately NOT shared with the host worker's fixtures — v1 §7 makes the
 * host owner of `account.ts`/fixtures alignment; this mock follows v1, not
 * the recovered v0 validators.
 */
import {
  AUTOPILOT_COPY,
  BETA_BILLING,
  CLOUD_PROVIDERS,
  DIRECTIVE_MAX,
  NAME_MAX,
  isRoleId,
  type Account,
  type FieldError,
  type MindConfig,
  type RoleId,
} from "../game/agent/account.ts";
import {
  ConsoleApiError,
  validateMindConfigV1,
  type CharacterRecord,
  type CharacterStatusV1,
  type CharacterView,
  type ConsoleApi,
  type DriverV1,
  type JournalEntry,
  type MindStateV1,
  type ReflexStateV1,
  type RolePackManifestV1,
  type RuntimeStateV1,
} from "./console-api.ts";

const IDEMPOTENCY_KEY_MIN = 16;
const IDEMPOTENCY_KEY_MAX = 128;

function err(field: string, code: string, message: string): FieldError {
  return { field, code, message };
}

/* Re-export so existing consumers of the mock keep working. */
export { validateMindConfigV1 };

/* ── Mock host ─────────────────────────────────────────────────────── */

interface MockRuntime {
  mindState: MindStateV1;
  runtimeState: RuntimeStateV1;
  reflexState: ReflexStateV1;
  driver: DriverV1;
  reasonCode: string | null;
  autopilotSince: number | null;
  lastMindExchangeTick: number | null;
  lastReflexTick: number | null;
  lastAppliedActionTick: number | null;
  agentId: string | null;
  reachable: boolean;
}

interface MockCharacterRow {
  record: CharacterRecord;
  secret: string | null;
  runtime: MockRuntime;
  journal: JournalEntry[];
}

interface MockAccountRow {
  account: Account;
  token: string;
  characters: Map<string, MockCharacterRow>;
}

interface ReplayRecord {
  digest: string;
  result: unknown;
}

export interface MockControls {
  /** Flip the bundled reflex runtime: when not ready, unleash fails 503
   *  RUNTIME_UNAVAILABLE (never because the owner's mind is asleep). */
  setReflexReady(ready: boolean): void;
  /** Force an upcoming API call to fail with the given status/code once —
   *  drives the console's recoverable-failure paths (S8). `skip` lets N
   *  calls succeed first (e.g. skip 1 to fail a secret write after its
   *  config patch). */
  failNext(status: number, code: string, message?: string, skip?: number): void;
  /** Simulate the owner's local mind dropping / returning. */
  sleepMind(characterId: string): void;
  wakeMind(characterId: string): void;
  /** Reflex outage / budget denial — truthful degraded state, not failure. */
  setReflexState(characterId: string, state: ReflexStateV1, reasonCode?: string): void;
  /** Advance the authoritative shard tick. */
  advanceTicks(n: number): void;
  /** Test introspection: how many accounts/characters exist. */
  counts(): { accounts: number; characters: number };
  /** The stored secret for assertions — test-only, never leaves the mock. */
  storedSecret(characterId: string): string | null;
}

export function createMockConsoleApi(opts: {
  /** Per-call bearer supplier — mirrors the HTTP client's getToken so the
   *  controller code path is identical against mock and live host. */
  getToken: () => string | null;
  now?: () => number;
  manifest?: RolePackManifestV1;
}): { api: ConsoleApi; controls: MockControls } {
  const now = opts.now ?? (() => 1_800_000_000_000);
  let tick = 4000;
  let reflexReady = true;
  let failNext: { status: number; code: string; message: string; skip: number } | null = null;
  let idCounter = 0;
  const accountsByToken = new Map<string, MockAccountRow>();
  const replay = new Map<string, ReplayRecord>();

  const manifest: RolePackManifestV1 = opts?.manifest ?? {
    version: 1,
    packs: [
      {
        id: "ranger",
        label: "Ranger",
        summary: "Works the wilds: chops, hunts, tracks, eats what it finds.",
        file: "agent-packs/ranger.md",
        startingSkills: { lumberjack: 30, tracking: 20, cooking: 10 },
      },
      {
        id: "smith",
        label: "Smith",
        summary: "Mines, smelts, and hammers; sells ironwork at the forge.",
        file: "agent-packs/smith.md",
        startingSkills: { mining: 30, smithing: 30 },
      },
      {
        id: "banker",
        label: "Banker",
        summary: "Holds court at the bank; trades, stashes, and keeps books.",
        file: "agent-packs/banker.md",
        startingSkills: { anatomy: 10, healing: 10 },
      },
      {
        id: "mule",
        label: "Mule",
        summary: "Hauls for everyone: pack runs between woods, forge, and bank.",
        file: "agent-packs/mule.md",
        startingSkills: { lumberjack: 10, mining: 10 },
      },
    ],
  };

  function nextId(prefix: string): string {
    idCounter += 1;
    return `${prefix}-${idCounter.toString(36).padStart(4, "0")}`;
  }

  function fail(status: number, code: string, message: string, fields?: FieldError[], field?: string): never {
    throw new ConsoleApiError({
      status,
      code,
      message,
      ...(fields !== undefined ? { fields } : {}),
      ...(field !== undefined ? { field } : {}),
    });
  }

  function maybeFailNext(): void {
    if (failNext) {
      if (failNext.skip > 0) {
        failNext.skip -= 1;
        return;
      }
      const f = failNext;
      failNext = null;
      fail(f.status, f.code, f.message);
    }
  }

  function checkIdempotencyKey(key: unknown): string {
    if (typeof key !== "string" || key.length < IDEMPOTENCY_KEY_MIN || key.length > IDEMPOTENCY_KEY_MAX) {
      fail(422, "IDEMPOTENCY_KEY_INVALID", `Idempotency-Key must be ${IDEMPOTENCY_KEY_MIN}–${IDEMPOTENCY_KEY_MAX} characters.`);
    }
    return key as string;
  }

  function replayOr<T>(scope: string, key: string, payload: unknown, produce: () => T): T {
    const digest = JSON.stringify(payload);
    const mapKey = `${scope}:${key}`;
    const prior = replay.get(mapKey);
    if (prior) {
      if (prior.digest !== digest) {
        fail(409, "IDEMPOTENCY_CONFLICT", "That Idempotency-Key was already used with a different request.");
      }
      return prior.result as T;
    }
    const result = produce();
    replay.set(mapKey, { digest, result });
    return result;
  }

  function auth(): MockAccountRow {
    maybeFailNext();
    const token = opts.getToken();
    if (!token) fail(401, "UNAUTHENTICATED", "An owner token is required.");
    const row = accountsByToken.get(token);
    if (!row) fail(401, "UNAUTHENTICATED", "That owner token was not recognized.");
    return row;
  }

  function ownCharacter(account: MockAccountRow, id: string): MockCharacterRow {
    const row = account.characters.get(id);
    // Foreign and nonexistent ids are indistinguishable (v1 §2).
    if (!row) fail(404, "NOT_FOUND", "Not found.");
    return row;
  }

  function toView(row: MockCharacterRow): CharacterView {
    const { record, secret } = row;
    return {
      character: { ...record },
      publicMind: record.mind
        ? { config: record.mind, secretHint: secret !== null ? ("configured" as const) : null }
        : null,
    };
  }

  function checkRevision(row: MockCharacterRow, expected: unknown): void {
    if (typeof expected !== "number" || !Number.isInteger(expected)) {
      fail(422, "REVISION_REQUIRED", "expectedRevision must be an integer.", undefined, "expectedRevision");
    }
    if (expected !== row.record.revision) {
      fail(409, "REVISION_CONFLICT", "This character changed elsewhere — reload and try again.");
    }
  }

  /** Write validation: validate only supplied values, fail atomically. */
  function validatePatch(account: MockAccountRow, row: MockCharacterRow | null, body: Record<string, unknown>): FieldError[] {
    const errs: FieldError[] = [];
    if ("name" in body) {
      const name = body.name;
      if (typeof name !== "string") errs.push(err("name", "TYPE", "Name must be text."));
      else {
        const trimmed = name.trim();
        if (trimmed.length === 0) errs.push(err("name", "REQUIRED", "Name your character."));
        else if (trimmed.length > NAME_MAX) errs.push(err("name", "TOO_LONG", `Keep the name under ${NAME_MAX} characters.`));
        else {
          const clash = [...account.characters.values()].some(
            (c) => c.record.id !== row?.record.id && c.record.name.toLowerCase() === trimmed.toLowerCase(),
          );
          if (clash) errs.push(err("name", "NAME_TAKEN", "You already have a character by that name."));
        }
      }
    }
    if ("roleId" in body && body.roleId !== null && body.roleId !== undefined) {
      if (!isRoleId(body.roleId)) {
        errs.push(err("roleId", "UNKNOWN_ROLE", "That role does not exist."));
      } else if (!manifest.packs.some((p) => p.id === body.roleId)) {
        fail(503, "CONFIG_UNAVAILABLE", "The role manifest is unavailable — the host is still starting.");
      }
    }
    if ("directive" in body && body.directive !== undefined) {
      if (typeof body.directive !== "string") errs.push(err("directive", "TYPE", "Directive must be text."));
      else if (body.directive.length > DIRECTIVE_MAX) {
        errs.push(err("directive", "TOO_LONG", `Keep the directive under ${DIRECTIVE_MAX} characters.`));
      }
    }
    if ("mind" in body && body.mind !== undefined && body.mind !== null) {
      errs.push(...validateMindConfigV1(body.mind));
    }
    return errs;
  }

  /** Readiness (unleash gate) — distinct from write validation. */
  function readinessFields(row: MockCharacterRow): FieldError[] {
    const c = row.record;
    const errs: FieldError[] = [];
    if (c.name.trim().length === 0) errs.push(err("name", "REQUIRED", "Name your character."));
    if (c.roleId === null) errs.push(err("roleId", "REQUIRED", "Pick a role."));
    if (c.directive.trim().length === 0) {
      errs.push(err("directive", "REQUIRED", "Write a directive — one sentence is enough."));
    }
    if (c.mind === null) {
      errs.push(err("mind", "REQUIRED", "Connect a mind: cloud key or local endpoint."));
    } else {
      errs.push(...validateMindConfigV1(c.mind));
      if (c.mind.model === undefined || c.mind.model.trim().length === 0) {
        errs.push(err("mind.model", "MODEL_REQUIRED", "Name the model your mind should run."));
      }
      if (c.mind.kind === "cloud" && row.secret === null) {
        errs.push(err("mind.key", "KEY_REQUIRED", "Store your API key before unleashing a cloud mind."));
      }
    }
    return errs;
  }

  function recomputeLifecycle(row: MockCharacterRow): void {
    const c = row.record;
    if (c.lifecycle === "unleashed" || c.lifecycle === "recalled") return;
    c.lifecycle = readinessFields(row).length === 0 ? "ready" : "draft";
  }

  function appendJournal(row: MockCharacterRow, source: "mind" | "system", text: string): void {
    const last = row.journal[row.journal.length - 1];
    row.journal.push({ sequence: (last?.sequence ?? 0) + 1, tick, source, text });
  }

  function freshRuntime(): MockRuntime {
    return {
      mindState: "unconfigured",
      runtimeState: "inactive",
      reflexState: "ready",
      driver: "none",
      reasonCode: null,
      autopilotSince: null,
      lastMindExchangeTick: null,
      lastReflexTick: null,
      lastAppliedActionTick: null,
      agentId: null,
      reachable: true,
    };
  }

  function statusOf(row: MockCharacterRow): CharacterStatusV1 {
    const rt = row.runtime;
    return {
      characterId: row.record.id,
      lifecycle: row.record.lifecycle,
      driver: rt.driver,
      mindState: rt.mindState,
      runtimeState: rt.runtimeState,
      reflexState: rt.reflexState,
      reasonCode: rt.reasonCode,
      autopilotSince: rt.autopilotSince,
      lastMindExchangeTick: rt.lastMindExchangeTick,
      lastReflexTick: rt.lastReflexTick,
      lastAppliedActionTick: rt.lastAppliedActionTick,
      configRevision: row.record.revision,
      body:
        row.record.lifecycle === "unleashed"
          ? { hp: 40, maxHp: 40, x: 255, z: 291, task: rt.driver === "reflex" ? "chop" : "think" }
          : null,
      journalTail: row.journal.slice(-5).map((e) => e.text),
    };
  }

  function unleashRow(row: MockCharacterRow): {
    characterId: string;
    lifecycle: "unleashed";
    agentId: string;
    startedTick: number;
    mindState: MindStateV1;
    driver: DriverV1;
  } {
    const rt = row.runtime;
    // Bundled-runtime check: the ONLY infrastructure gate. A sleeping owner
    // mind is never this gate (v1 §3).
    if (!reflexReady) {
      fail(503, "RUNTIME_UNAVAILABLE", "The bundled reflex runtime cannot start right now — retry shortly.");
    }
    const missing = readinessFields(row);
    if (missing.length > 0) {
      fail(422, "CONFIG_INCOMPLETE", "Finish the configuration before unleashing.", missing);
    }
    if (row.record.lifecycle === "unleashed" && rt.agentId !== null) {
      // Idempotent: same agent, same body, even on a stale revision.
      return {
        characterId: row.record.id,
        lifecycle: "unleashed",
        agentId: rt.agentId,
        startedTick: row.record.unleashedAt ?? tick,
        mindState: rt.mindState,
        driver: rt.driver,
      };
    }
    rt.agentId = rt.agentId ?? nextId("agent");
    row.record.lifecycle = "unleashed";
    row.record.unleashedAt = tick;
    row.record.recalledAt = null;
    row.record.revision += 1;
    rt.runtimeState = "running";
    rt.lastReflexTick = tick;
    rt.lastAppliedActionTick = tick;
    if (rt.reachable) {
      rt.mindState = "awake";
      rt.driver = "mind";
      rt.lastMindExchangeTick = tick;
      appendJournal(row, "mind", `${row.record.name} takes its first look around the vale.`);
    } else {
      // Initially offline but valid local mind: reflexes carry it (S11).
      rt.mindState = "asleep";
      rt.driver = "reflex";
      rt.autopilotSince = tick;
      appendJournal(row, "system", AUTOPILOT_COPY.sleepLine(row.record.name));
    }
    return {
      characterId: row.record.id,
      lifecycle: "unleashed",
      agentId: rt.agentId,
      startedTick: tick,
      mindState: rt.mindState,
      driver: rt.driver,
    };
  }

  /* Token plumbing: createAccount is unauthenticated; everything else
   * resolves the caller via the per-call `getToken` supplier. */
  const api: ConsoleApi = {
    async createAccount({ idempotencyKey }) {
      const key = checkIdempotencyKey(idempotencyKey);
      maybeFailNext();
      return Promise.resolve(
        replayOr("account", key, {}, () => {
          const account: Account = { id: nextId("acct"), createdAt: now(), billing: BETA_BILLING };
          const token = `mtok-${nextId("owner")}`;
          accountsByToken.set(token, { account, token, characters: new Map() });
          return { account, ownerToken: token };
        }),
      );
    },

    async listRoles() {
      maybeFailNext();
      return Promise.resolve(manifest);
    },

    async listCharacters() {
      const account = auth();
      return Promise.resolve({ characters: [...account.characters.values()].map(toView) });
    },

    async createCharacter({ idempotencyKey, name, roleId, directive, mind }) {
      const key = checkIdempotencyKey(idempotencyKey);
      const account = auth();
      const body: Record<string, unknown> = { name };
      if (roleId !== undefined) body.roleId = roleId;
      if (directive !== undefined) body.directive = directive;
      if (mind !== undefined) body.mind = mind;
      return Promise.resolve(
        replayOr("character", key, body, () => {
          const errs = validatePatch(account, null, body);
          if (typeof name !== "string" || name.trim().length === 0) {
            if (!errs.some((e) => e.field === "name")) errs.push(err("name", "REQUIRED", "Name your character."));
          }
          if (errs.length > 0) fail(422, "VALIDATION", "Some fields need attention.", errs);
          const row: MockCharacterRow = {
            record: {
              id: nextId("char"),
              accountId: account.account.id,
              name: (name as string).trim(),
              roleId: (roleId as RoleId | undefined) ?? null,
              directive: (directive as string | undefined) ?? "",
              mind: (mind as MindConfig | undefined) ?? null,
              lifecycle: "draft",
              revision: 1,
              createdAt: now(),
              updatedAt: now(),
              unleashedAt: null,
              recalledAt: null,
            },
            secret: null,
            runtime: freshRuntime(),
            journal: [],
          };
          recomputeLifecycle(row);
          account.characters.set(row.record.id, row);
          return toView(row);
        }),
      );
    },

    async getCharacter(id) {
      const account = auth();
      return Promise.resolve(toView(ownCharacter(account, id)));
    },

    async patchCharacter(id, patch) {
      const account = auth();
      const row = ownCharacter(account, id);
      const { expectedRevision, ...rest } = patch;
      checkRevision(row, expectedRevision);
      if (row.record.lifecycle === "unleashed") {
        // v1 §3: clearing required config while live demands a recall first.
        if ("mind" in rest && rest.mind === null) {
          fail(409, "RECALL_REQUIRED", "Recall the character before clearing its mind configuration.");
        }
      }
      const errs = validatePatch(account, row, rest as Record<string, unknown>);
      if (errs.length > 0) fail(422, "VALIDATION", "Some fields need attention.", errs);
      if (typeof rest.name === "string") row.record.name = rest.name.trim();
      if ("roleId" in rest) row.record.roleId = rest.roleId ?? null;
      if (typeof rest.directive === "string") row.record.directive = rest.directive;
      if ("mind" in rest && rest.mind !== undefined) {
        row.record.mind = rest.mind;
        if (rest.mind === null) row.secret = null;
        else if (rest.mind.kind === "local") row.secret = null; // local minds hold no key
      }
      row.record.revision += 1;
      row.record.updatedAt = now();
      recomputeLifecycle(row);
      return Promise.resolve(toView(row));
    },

    async putMindSecret(id, { secret, expectedRevision }) {
      const account = auth();
      const row = ownCharacter(account, id);
      checkRevision(row, expectedRevision);
      if (typeof secret !== "string" || secret.trim().length === 0) {
        fail(422, "SECRET_REQUIRED", "Paste your API key first.", undefined, "secret");
      }
      if (row.record.mind?.kind !== "cloud") {
        fail(422, "NOT_CLOUD", "Only a cloud mind stores an API key.", undefined, "secret");
      }
      if (row.record.lifecycle === "unleashed" && row.secret !== null && row.secret !== secret) {
        // Replacing a live key is a config replacement — allowed, new
        // revision takes effect next exchange (v1 §3).
      }
      row.secret = secret;
      row.record.revision += 1;
      row.record.updatedAt = now();
      recomputeLifecycle(row);
      return Promise.resolve();
    },

    async deleteMindSecret(id, { expectedRevision }) {
      const account = auth();
      const row = ownCharacter(account, id);
      checkRevision(row, expectedRevision);
      if (row.record.lifecycle === "unleashed") {
        fail(409, "RECALL_REQUIRED", "Recall the character before removing its API key.");
      }
      row.secret = null;
      row.record.revision += 1;
      row.record.updatedAt = now();
      recomputeLifecycle(row);
      return Promise.resolve();
    },

    async unleash(id, { expectedRevision }) {
      const account = auth();
      const row = ownCharacter(account, id);
      const already = row.record.lifecycle === "unleashed";
      if (!already) checkRevision(row, expectedRevision);
      else if (typeof expectedRevision !== "number") checkRevision(row, expectedRevision);
      // Already unleashed is a success no-op even with a stale revision (v1 §2).
      return Promise.resolve(unleashRow(row));
    },

    async recall(id, { expectedRevision }) {
      const account = auth();
      const row = ownCharacter(account, id);
      const c = row.record;
      if (c.lifecycle === "recalled") {
        return Promise.resolve({ lifecycle: "recalled" as const, stoppedTick: c.recalledAt ?? tick });
      }
      checkRevision(row, expectedRevision);
      if (c.lifecycle !== "unleashed") {
        fail(409, "NOT_RUNNING", "That character is not running.");
      }
      c.lifecycle = "recalled";
      c.recalledAt = tick;
      c.revision += 1;
      c.updatedAt = now();
      const rt = row.runtime;
      rt.runtimeState = "inactive";
      rt.driver = "none";
      rt.autopilotSince = null;
      appendJournal(row, "system", `${c.name} was recalled. The body rests; nothing is lost.`);
      return Promise.resolve({ lifecycle: "recalled" as const, stoppedTick: tick });
    },

    async status(id) {
      const account = auth();
      return Promise.resolve(statusOf(ownCharacter(account, id)));
    },

    async journal(id, args) {
      const account = auth();
      const row = ownCharacter(account, id);
      const after = args?.after ?? 0;
      const limit = Math.min(args?.limit ?? 50, 100);
      const entries = row.journal.filter((e) => e.sequence > after).slice(0, limit);
      const lastEntry = row.journal[row.journal.length - 1];
      const nextCursor =
        lastEntry && entries.length > 0 && entries[entries.length - 1].sequence < lastEntry.sequence
          ? entries[entries.length - 1].sequence
          : null;
      return Promise.resolve({ entries, nextCursor });
    },
  };

  const controls: MockControls = {
    setReflexReady(ready) {
      reflexReady = ready;
    },
    failNext(status, code, message, skip = 0) {
      failNext = { status, code, message: message ?? `Mock injected ${code}.`, skip };
    },
    sleepMind(characterId) {
      for (const account of accountsByToken.values()) {
        const row = account.characters.get(characterId);
        if (!row) continue;
        const rt = row.runtime;
        rt.reachable = false;
        if (row.record.lifecycle === "unleashed" && rt.mindState !== "asleep") {
          rt.mindState = "asleep";
          rt.autopilotSince = tick;
          if (rt.reflexState === "ready") {
            rt.driver = "reflex";
          } else {
            rt.driver = "none";
            rt.runtimeState = "degraded";
          }
          appendJournal(row, "system", AUTOPILOT_COPY.sleepLine(row.record.name));
        }
      }
    },
    wakeMind(characterId) {
      for (const account of accountsByToken.values()) {
        const row = account.characters.get(characterId);
        if (!row) continue;
        const rt = row.runtime;
        rt.reachable = true;
        if (row.record.lifecycle === "unleashed" && rt.mindState === "asleep") {
          rt.mindState = "awake";
          rt.driver = "mind";
          rt.autopilotSince = null;
          rt.lastMindExchangeTick = tick;
          if (rt.runtimeState === "degraded" && rt.reflexState === "ready") rt.runtimeState = "running";
          appendJournal(row, "system", AUTOPILOT_COPY.wakeLine(row.record.name));
        }
      }
    },
    setReflexState(characterId, state, reasonCode) {
      for (const account of accountsByToken.values()) {
        const row = account.characters.get(characterId);
        if (!row) continue;
        const rt = row.runtime;
        rt.reflexState = state;
        rt.reasonCode = reasonCode ?? null;
        if (state !== "ready" && row.record.lifecycle === "unleashed") {
          rt.runtimeState = "degraded";
          if (rt.driver === "reflex") rt.driver = "none";
        } else if (state === "ready" && row.record.lifecycle === "unleashed") {
          rt.runtimeState = "running";
          if (rt.mindState === "asleep") rt.driver = "reflex";
          rt.reasonCode = null;
        }
      }
    },
    advanceTicks(n) {
      tick += n;
      for (const account of accountsByToken.values()) {
        for (const row of account.characters.values()) {
          if (row.record.lifecycle === "unleashed") {
            row.runtime.lastReflexTick = tick;
            row.runtime.lastAppliedActionTick = tick;
          }
        }
      }
    },
    counts() {
      let characters = 0;
      for (const a of accountsByToken.values()) characters += a.characters.size;
      return { accounts: accountsByToken.size, characters };
    },
    storedSecret(characterId) {
      for (const account of accountsByToken.values()) {
        const row = account.characters.get(characterId);
        if (row) return row.secret;
      }
      return null;
    },
  };

  return { api, controls };
}
