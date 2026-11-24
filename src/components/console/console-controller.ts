/**
 * Phase 4 director console — flow controller.
 *
 * Framework-free state machine behind `console-screen.tsx`; every behavior
 * the task requires is exercised here under node:test against the v1 mock:
 *
 *   account → character → role → directive → mind (cloud key | local URL)
 *   → review → unleash → status
 *
 * Contract anchors (docs/phase-4-contracts-v1.md):
 *  - non-secret form survives every recoverable failure; the API key is
 *    held in memory only, never autosaved, and is CLEARED on a failed
 *    secret write (S8) — after a 503 the character is refetched so a key
 *    that actually persisted shows as "configured" instead of silently
 *    demanding re-entry;
 *  - creates reuse one Idempotency-Key across retries; mutations send
 *    expectedRevision and reload on REVISION_CONFLICT;
 *  - status polling: 2s while visible, exponential backoff on errors,
 *    stops on leave; polling never triggers model calls (status GET only);
 *  - banners are truthful: the autopilot banner appears only when the
 *    bundled reflex layer is actually driving (asleep + reflex ready);
 *    a reflex outage shows a degraded state, never the cheerful banner.
 */
import { AUTOPILOT_COPY, type Account, type CloudProvider, type FieldError, type MindConfig, type RoleId } from "../../game/agent/account.ts";
import {
  isConsoleApiError,
  validateDirectiveValue,
  validateMindConfigV1,
  validateNameValue,
  type CharacterStatusV1,
  type CharacterView,
  type ConsoleApi,
  type RolePackManifestV1,
} from "../../lib/console-api.ts";

/* ── State ─────────────────────────────────────────────────────────── */

export type ConsoleStep = "account" | "character" | "role" | "directive" | "mind" | "review" | "status";

export interface MindFormState {
  kind: "cloud" | "local";
  cloud: { provider: CloudProvider; baseUrl: string; model: string; key: string };
  local: { endpointUrl: string; model: string };
}

export interface ConsoleFormState {
  name: string;
  roleId: RoleId | null;
  directive: string;
  mind: MindFormState;
}

export interface ConsoleErrorState {
  message: string;
  /** True when the failure is transient and the form survives (S8). */
  recoverable: boolean;
}

export interface ConsoleState {
  step: ConsoleStep;
  busy: boolean;
  account: Account | null;
  /** True while the freshly created owner token is shown exactly once. */
  tokenRevealed: boolean;
  characters: CharacterView[];
  /** The selected character as the host sees it (drives the review bar). */
  view: CharacterView | null;
  form: ConsoleFormState;
  manifest: RolePackManifestV1 | null;
  status: CharacterStatusV1 | null;
  error: ConsoleErrorState | null;
  fieldErrors: FieldError[];
  notice: string | null;
  polling: boolean;
  pollError: string | null;
}

const CLOUD_BASE_DEFAULT = "https://api.openai.com/v1";
export const CONSOLE_TOKEN_STORAGE_KEY = "emberhall.console.ownerToken";
export const CONSOLE_DRAFT_STORAGE_KEY = "emberhall.console.draft";

function emptyForm(): ConsoleFormState {
  return {
    name: "",
    roleId: null,
    directive: "",
    mind: {
      kind: "cloud",
      cloud: { provider: "openai-compatible", baseUrl: CLOUD_BASE_DEFAULT, model: "", key: "" },
      local: { endpointUrl: "", model: "" },
    },
  };
}

/** The non-secret draft — the ONLY shape ever autosaved. No key, ever. */
interface ConsoleDraft {
  name: string;
  roleId: RoleId | null;
  directive: string;
  mind: { kind: "cloud" | "local"; cloud: { provider: CloudProvider; baseUrl: string; model: string }; local: { endpointUrl: string; model: string } };
}

export interface ConsoleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ConsoleDeps {
  api: ConsoleApi;
  getToken: () => string | null;
  setToken: (token: string | null) => void;
  /** sessionStorage in the app, a Map-backed stub in tests. */
  storage?: ConsoleStorage | null;
  delay?: (ms: number) => Promise<void>;
  isVisible?: () => boolean;
  pollIntervalMs?: number;
  maxBackoffMs?: number;
  newIdempotencyKey?: () => string;
}

/* ── Derived view helpers (exported for tests + UI) ────────────────── */

export interface ReadinessItem {
  key: string;
  label: string;
  ok: boolean;
  hint: string | undefined;
}

/** Client mirror of the host's readiness bar; the host stays authoritative. */
export function readinessChecklist(view: CharacterView | null): ReadinessItem[] {
  const c = view?.character ?? null;
  const mind = c?.mind ?? null;
  const mindErrors = mind ? validateMindConfigV1(mind) : [];
  return [
    { key: "name", label: "Name", ok: c !== null && c.name.trim().length > 0, hint: c && c.name.trim().length > 0 ? undefined : "Name your character." },
    { key: "role", label: "Role", ok: c?.roleId != null, hint: c?.roleId != null ? undefined : "Pick a role." },
    {
      key: "directive",
      label: "Directive",
      ok: c !== null && c.directive.trim().length > 0,
      hint: c && c.directive.trim().length > 0 ? undefined : "Write a directive — one sentence is enough.",
    },
    {
      key: "mind",
      label: "Mind connection",
      ok: mind !== null && mindErrors.length === 0,
      hint: mind === null ? "Connect a mind: cloud key or local endpoint." : mindErrors[0]?.message,
    },
    {
      key: "model",
      label: "Model",
      ok: mind !== null && typeof mind.model === "string" && mind.model.trim().length > 0,
      hint: mind && typeof mind.model === "string" && mind.model.trim().length > 0 ? undefined : "Name the model your mind should run.",
    },
    {
      key: "key",
      label: "API key",
      ok: mind?.kind !== "cloud" || view?.publicMind?.secretHint === "configured",
      hint:
        mind?.kind === "cloud" && view?.publicMind?.secretHint !== "configured"
          ? "Store your API key before unleashing a cloud mind."
          : undefined,
    },
  ];
}

export type ConsoleBanner = { kind: "autopilot" | "degraded"; text: string } | null;

/** Truthful state surfacing: autopilot only when reflexes truly drive. */
export function deriveBanner(status: CharacterStatusV1 | null, name: string): ConsoleBanner {
  if (!status || status.lifecycle !== "unleashed") return null;
  if (status.reflexState !== "ready") {
    const reason =
      status.reflexState === "budget-exhausted"
        ? "the daily reflex budget is exhausted"
        : status.reasonCode !== null && /^[a-z0-9-]{1,64}$/.test(status.reasonCode)
          ? `the reflex service reported “${status.reasonCode}”`
          : "the reflex service is unavailable";
    return {
      kind: "degraded",
      text: `Autopilot unavailable — ${reason}. ${name} is holding position; no instincts are driving it right now.`,
    };
  }
  if (status.mindState === "error") {
    const remedy = status.reasonCode === "MIND_AUTH"
      ? "Replace the cloud key or check its provider permissions."
      : status.reasonCode === "MIND_INVALID_RESPONSE"
        ? "Choose a compatible JSON-capable model and check the endpoint response format."
        : "Check the mind configuration, model and endpoint.";
    return { kind: "degraded", text: `Mind connection needs attention. ${remedy} Reflexes remain active; edit the character from the mind step, or recall it to stop autonomous actions.` };
  }
  if (status.mindState === "asleep" && status.driver === "reflex") {
    return { kind: "autopilot", text: AUTOPILOT_COPY.banner(name) };
  }
  return null;
}

/** The mind config the form currently describes, or null when invalid. */
export function mindConfigFromForm(form: ConsoleFormState): MindConfig | null {
  if (form.mind.kind === "cloud") {
    const cfg: MindConfig = {
      kind: "cloud",
      provider: form.mind.cloud.provider,
      ...(form.mind.cloud.baseUrl.trim() !== "" && form.mind.cloud.baseUrl.trim() !== CLOUD_BASE_DEFAULT
        ? { baseUrl: form.mind.cloud.baseUrl.trim() }
        : {}),
      ...(form.mind.cloud.model.trim() !== "" ? { model: form.mind.cloud.model.trim() } : {}),
    };
    return validateMindConfigV1(cfg).length === 0 ? cfg : null;
  }
  const cfg: MindConfig = {
    kind: "local",
    endpointUrl: form.mind.local.endpointUrl.trim(),
    ...(form.mind.local.model.trim() !== "" ? { model: form.mind.local.model.trim() } : {}),
  };
  return validateMindConfigV1(cfg).length === 0 ? cfg : null;
}

/* ── Controller ────────────────────────────────────────────────────── */

export class ConsoleController {
  private state: ConsoleState;
  private readonly listeners = new Set<() => void>();
  private readonly deps: Required<Omit<ConsoleDeps, "storage" | "newIdempotencyKey">> & Pick<ConsoleDeps, "newIdempotencyKey">;
  private readonly storage: ConsoleStorage | null;
  private pollGen = 0;
  private accountIdemKey: string | null = null;
  private characterIdemKey: string | null = null;
  private lastAction: (() => Promise<void>) | null = null;

  constructor(deps: ConsoleDeps) {
    this.deps = {
      api: deps.api,
      getToken: deps.getToken,
      setToken: deps.setToken,
      delay: deps.delay ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      isVisible: deps.isVisible ?? (() => true),
      pollIntervalMs: deps.pollIntervalMs ?? 2000,
      maxBackoffMs: deps.maxBackoffMs ?? 30_000,
      ...(deps.newIdempotencyKey !== undefined ? { newIdempotencyKey: deps.newIdempotencyKey } : {}),
    };
    this.storage = deps.storage ?? null;
    this.state = {
      step: "account",
      busy: false,
      account: null,
      tokenRevealed: false,
      characters: [],
      view: null,
      form: this.restoreDraft() ?? emptyForm(),
      manifest: null,
      status: null,
      error: null,
      fieldErrors: [],
      notice: null,
      polling: false,
      pollError: null,
    };
  }

  // Arrow member, not a prototype method: useSyncExternalStore calls the
  // snapshot bare (no receiver), so an unbound `this` blank-screens SSR.
  getState = (): ConsoleState => {
    return this.state;
  };

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(patch: Partial<ConsoleState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  private idemKey(): string {
    if (this.deps.newIdempotencyKey) return this.deps.newIdempotencyKey();
    return `idem-${crypto.randomUUID()}`;
  }

  /* ── draft autosave (non-secret only) ─────────────────────────── */

  private persistDraft(): void {
    if (!this.storage) return;
    const f = this.state.form;
    const draft: ConsoleDraft = {
      name: f.name,
      roleId: f.roleId,
      directive: f.directive,
      mind: {
        kind: f.mind.kind,
        cloud: { provider: f.mind.cloud.provider, baseUrl: f.mind.cloud.baseUrl, model: f.mind.cloud.model },
        local: { endpointUrl: f.mind.local.endpointUrl, model: f.mind.local.model },
      },
      // The API key is deliberately absent. It never touches storage.
    };
    try {
      this.storage.setItem(CONSOLE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* storage full/blocked — autosave is best-effort */
    }
  }

  private restoreDraft(): ConsoleFormState | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(CONSOLE_DRAFT_STORAGE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw) as Partial<ConsoleDraft>;
      const base = emptyForm();
      return {
        name: typeof d.name === "string" ? d.name : base.name,
        roleId: d.roleId ?? null,
        directive: typeof d.directive === "string" ? d.directive : base.directive,
        mind: {
          kind: d.mind?.kind === "local" ? "local" : "cloud",
          cloud: { ...base.mind.cloud, ...(d.mind?.cloud ?? {}) },
          local: { ...base.mind.local, ...(d.mind?.local ?? {}) },
        },
      };
    } catch {
      return null;
    }
  }

  /* ── error handling ───────────────────────────────────────────── */

  private captureError(e: unknown, retry: (() => Promise<void>) | null): void {
    if (isConsoleApiError(e)) {
      this.set({
        busy: false,
        error: { message: e.message, recoverable: e.recoverable },
        fieldErrors: e.fields ?? [],
      });
    } else {
      this.set({
        busy: false,
        error: { message: "Something went wrong on this device.", recoverable: true },
        fieldErrors: [],
      });
    }
    this.lastAction = retry;
  }

  /** Retry the last failed recoverable action — the form is intact. The
   *  view is refreshed first so a stale revision can't fail the retry. */
  async retry(): Promise<void> {
    const action = this.lastAction;
    if (!action) return;
    this.set({ error: null });
    if (this.state.view) {
      try {
        const fresh = await this.deps.api.getCharacter(this.state.view.character.id);
        this.set({ view: fresh, characters: this.withCharacter(fresh) });
      } catch {
        /* proceed with the last known revision */
      }
    }
    await action();
  }

  dismissError(): void {
    this.set({ error: null, fieldErrors: [] });
  }

  /* ── account ──────────────────────────────────────────────────── */

  async createAccount(): Promise<void> {
    const run = async () => {
      this.set({ busy: true, error: null, fieldErrors: [] });
      this.accountIdemKey ??= this.idemKey();
      try {
        const { account, ownerToken } = await this.deps.api.createAccount({ idempotencyKey: this.accountIdemKey });
        this.deps.setToken(ownerToken);
        try {
          this.storage?.setItem(CONSOLE_TOKEN_STORAGE_KEY, ownerToken);
        } catch {
          /* session persistence is best-effort */
        }
        this.accountIdemKey = null;
        const manifest = await this.deps.api.listRoles().catch(() => null);
        const { characters } = await this.deps.api.listCharacters();
        // Stay on the account step: the one-time token reveal renders only
        // there. confirmTokenSaved() advances to the character step.
        this.set({ busy: false, account, tokenRevealed: true, manifest, characters, step: "account" });
      } catch (e) {
        this.captureError(e, run);
      }
    };
    await run();
  }

  /** Returning owner pastes their token back. */
  async resumeWithToken(token: string): Promise<void> {
    const run = async () => {
      this.set({ busy: true, error: null, fieldErrors: [] });
      this.deps.setToken(token.trim());
      try {
        const manifest = await this.deps.api.listRoles().catch(() => null);
        const { characters } = await this.deps.api.listCharacters();
        try {
          this.storage?.setItem(CONSOLE_TOKEN_STORAGE_KEY, token.trim());
        } catch {
          /* best-effort */
        }
        this.set({ busy: false, manifest, characters, step: "character", notice: null });
      } catch (e) {
        this.deps.setToken(null);
        this.captureError(e, run);
      }
    };
    await run();
  }

  /**
   * Reload recovery: restore a persisted session on a fresh mount. The
   * beta token lives in sessionStorage; without this the owner lands back
   * on the account step and could create a duplicate character. No-op
   * when nothing is persisted, an account is already open, or the one-time
   * token reveal is showing. An auth-rejected token is cleared; a
   * reachable-host failure keeps it so Retry can try again.
   */
  async resumeSession(): Promise<boolean> {
    if (this.state.account !== null || this.state.busy || this.state.tokenRevealed) return false;
    const token = this.deps.getToken();
    if (token === null || token.trim() === "") return false;
    this.set({ busy: true, error: null, fieldErrors: [] });
    try {
      const manifest = await this.deps.api.listRoles().catch(() => null);
      const { characters } = await this.deps.api.listCharacters();
      this.set({ busy: false, manifest, characters, step: "character", notice: null });
      return true;
    } catch (e) {
      if (isConsoleApiError(e) && !e.recoverable) {
        this.deps.setToken(null);
        try {
          this.storage?.removeItem(CONSOLE_TOKEN_STORAGE_KEY);
        } catch {
          /* best-effort */
        }
      }
      this.captureError(e, async () => {
        await this.resumeSession();
      });
      return false;
    }
  }

  confirmTokenSaved(): void {
    this.set({ tokenRevealed: false, step: "character" });
  }

  /** Upsert the resume list so it stays current without a host round-trip. */
  private withCharacter(view: CharacterView): CharacterView[] {
    const list = this.state.characters;
    const i = list.findIndex((entry) => entry.character.id === view.character.id);
    if (i === -1) return [...list, view];
    const next = list.slice();
    next[i] = view;
    return next;
  }

  logout(): void {
    this.deps.setToken(null);
    try {
      this.storage?.removeItem(CONSOLE_TOKEN_STORAGE_KEY);
      this.storage?.removeItem(CONSOLE_DRAFT_STORAGE_KEY);
    } catch {
      /* best-effort */
    }
    this.stopPolling();
    this.set({
      step: "account",
      busy: false,
      account: null,
      tokenRevealed: false,
      characters: [],
      view: null,
      form: emptyForm(),
      manifest: null,
      status: null,
      error: null,
      fieldErrors: [],
      notice: null,
      polling: false,
      pollError: null,
    });
  }

  /* ── character selection / creation ───────────────────────────── */

  startNewCharacter(): void {
    this.set({ view: null, form: this.restoreDraft() ?? emptyForm(), step: "character", error: null, fieldErrors: [], notice: null });
  }

  async selectCharacter(id: string): Promise<void> {
    const run = async () => {
      this.set({ busy: true, error: null, fieldErrors: [] });
      try {
        const view = await this.deps.api.getCharacter(id);
        const form = formFromView(view, this.state.form);
        if (view.character.lifecycle === "unleashed") {
          const status = await this.deps.api.status(id).catch(() => null);
          this.set({ busy: false, view, characters: this.withCharacter(view), form, status, step: "status" });
          this.startPolling();
        } else {
          this.set({ busy: false, view, characters: this.withCharacter(view), form, step: "review" });
        }
      } catch (e) {
        this.captureError(e, run);
      }
    };
    await run();
  }

  /* ── form edits (autosaving, non-secret only) ─────────────────── */

  updateForm(patch: Partial<ConsoleFormState>): void {
    this.set({ form: { ...this.state.form, ...patch } });
    this.persistDraft();
  }

  updateMindForm(patch: {
    kind?: "cloud" | "local";
    cloud?: Partial<MindFormState["cloud"]>;
    local?: Partial<MindFormState["local"]>;
  }): void {
    const m = this.state.form.mind;
    const next: MindFormState = {
      kind: patch.kind ?? m.kind,
      cloud: { ...m.cloud, ...(patch.cloud ?? {}) },
      local: { ...m.local, ...(patch.local ?? {}) },
    };
    this.set({ form: { ...this.state.form, mind: next } });
    // Never persist a key: strip it before autosave by construction —
    // persistDraft reads only non-secret fields.
    this.persistDraft();
  }

  /* ── step submissions ─────────────────────────────────────────── */

  /** Name step: creates the character on first save (name-only draft is
   *  allowed), patches afterwards. */
  async submitName(): Promise<void> {
    const nameErr = validateNameValue(this.state.form.name);
    if (nameErr) {
      this.set({ fieldErrors: [nameErr] });
      return;
    }
    const run = async () => {
      this.set({ busy: true, error: null, fieldErrors: [] });
      try {
        const view = this.state.view;
        if (view === null) {
          this.characterIdemKey ??= this.idemKey();
          const created = await this.deps.api.createCharacter({
            idempotencyKey: this.characterIdemKey,
            name: this.state.form.name.trim(),
          });
          this.characterIdemKey = null;
          this.set({ busy: false, view: created, characters: this.withCharacter(created), step: "role" });
        } else {
          const updated = await this.deps.api.patchCharacter(view.character.id, {
            name: this.state.form.name.trim(),
            expectedRevision: view.character.revision,
          });
          this.set({ busy: false, view: updated, characters: this.withCharacter(updated), step: "role" });
        }
        this.persistDraft();
      } catch (e) {
        await this.handleMutationError(e, run);
      }
    };
    await run();
  }

  async submitRole(roleId: RoleId): Promise<void> {
    this.updateForm({ roleId });
    const run = async () => {
      const view = this.state.view;
      if (view === null) return;
      this.set({ busy: true, error: null, fieldErrors: [] });
      try {
        const updated = await this.deps.api.patchCharacter(view.character.id, {
          roleId,
          expectedRevision: view.character.revision,
        });
        this.set({ busy: false, view: updated, characters: this.withCharacter(updated), step: "directive" });
      } catch (e) {
        await this.handleMutationError(e, run);
      }
    };
    await run();
  }

  async submitDirective(): Promise<void> {
    const dirErr = validateDirectiveValue(this.state.form.directive);
    if (dirErr) {
      this.set({ fieldErrors: [dirErr] });
      return;
    }
    const run = async () => {
      const view = this.state.view;
      if (view === null) return;
      this.set({ busy: true, error: null, fieldErrors: [] });
      try {
        const updated = await this.deps.api.patchCharacter(view.character.id, {
          directive: this.state.form.directive,
          expectedRevision: view.character.revision,
        });
        this.set({ busy: false, view: updated, characters: this.withCharacter(updated), step: "mind" });
        this.persistDraft();
      } catch (e) {
        await this.handleMutationError(e, run);
      }
    };
    await run();
  }

  /** Mind step: saves the config; a cloud key goes through the write-only
   *  secret channel and is wiped from memory immediately after the attempt. */
  async submitMind(): Promise<void> {
    const cfg = mindConfigFromForm(this.state.form);
    if (cfg === null) {
      const fields = validateMindConfigV1(
        this.state.form.mind.kind === "cloud"
          ? {
              kind: "cloud",
              provider: this.state.form.mind.cloud.provider,
              baseUrl: this.state.form.mind.cloud.baseUrl,
              model: this.state.form.mind.cloud.model,
            }
          : { kind: "local", endpointUrl: this.state.form.mind.local.endpointUrl, model: this.state.form.mind.local.model },
      );
      this.set({ fieldErrors: fields });
      return;
    }
    const run = async () => {
      const view = this.state.view;
      if (view === null) return;
      this.set({ busy: true, error: null, fieldErrors: [] });
      try {
        let current = await this.deps.api.patchCharacter(view.character.id, {
          mind: cfg,
          expectedRevision: view.character.revision,
        });
        const key = this.state.form.mind.cloud.key;
        if (cfg.kind === "cloud" && key.trim() !== "") {
          try {
            await this.deps.api.putMindSecret(view.character.id, {
              secret: key.trim(),
              expectedRevision: current.character.revision,
            });
          } catch (e) {
            // S8: wipe the key from memory; if it actually persisted, the
            // refetched view says "configured" and no re-entry is demanded.
            this.updateMindForm({ cloud: { key: "" } });
            if (isConsoleApiError(e) && e.recoverable) {
              try {
                current = await this.deps.api.getCharacter(view.character.id);
              } catch {
                /* fall through to the recoverable error below */
              }
              if (current.publicMind?.secretHint === "configured") {
                this.set({ busy: false, view: current, characters: this.withCharacter(current), step: "review", notice: "Key stored." });
                return;
              }
            }
            throw e;
          }
          this.updateMindForm({ cloud: { key: "" } });
          current = await this.deps.api.getCharacter(view.character.id);
        }
        this.set({ busy: false, view: current, characters: this.withCharacter(current), step: "review" });
        this.persistDraft();
      } catch (e) {
        // S8: a recoverable failure keeps the non-secret form but the key
        // is wiped from memory — honest re-entry over silent retention.
        if (isConsoleApiError(e) && e.recoverable) this.updateMindForm({ cloud: { key: "" } });
        await this.handleMutationError(e, run);
      }
    };
    await run();
  }

  /* ── unleash / recall ─────────────────────────────────────────── */

  async unleashNow(): Promise<void> {
    const run = async () => {
      const view = this.state.view;
      if (view === null) return;
      this.set({ busy: true, error: null, fieldErrors: [] });
      try {
        await this.deps.api.unleash(view.character.id, { expectedRevision: view.character.revision });
        const [fresh, status] = await Promise.all([
          this.deps.api.getCharacter(view.character.id),
          this.deps.api.status(view.character.id),
        ]);
        this.set({ busy: false, view: fresh, characters: this.withCharacter(fresh), status, step: "status" });
        this.startPolling();
      } catch (e) {
        await this.handleMutationError(e, run);
      }
    };
    await run();
  }

  async recallNow(): Promise<void> {
    const run = async () => {
      const view = this.state.view;
      if (view === null) return;
      this.set({ busy: true, error: null, fieldErrors: [] });
      try {
        await this.deps.api.recall(view.character.id, { expectedRevision: view.character.revision });
        const [fresh, status] = await Promise.all([
          this.deps.api.getCharacter(view.character.id),
          this.deps.api.status(view.character.id),
        ]);
        this.set({ busy: false, view: fresh, characters: this.withCharacter(fresh), status, notice: `${fresh.character.name} was recalled. Nothing is lost — unleash resumes it.` });
      } catch (e) {
        await this.handleMutationError(e, run);
      }
    };
    await run();
  }

  /* ── status polling ───────────────────────────────────────────── */

  startPolling(): void {
    const gen = ++this.pollGen;
    const id = this.state.view?.character.id;
    if (!id) return;
    this.set({ polling: true, pollError: null });
    void this.pollLoop(gen, id);
  }

  stopPolling(): void {
    this.pollGen += 1;
    if (this.state.polling) this.set({ polling: false });
  }

  private async pollLoop(gen: number, id: string): Promise<void> {
    const base = this.deps.pollIntervalMs;
    let interval = base;
    while (gen === this.pollGen) {
      if (this.deps.isVisible()) {
        try {
          const status = await this.deps.api.status(id);
          if (gen !== this.pollGen) break;
          this.set({ status, pollError: null });
          interval = base;
        } catch (e) {
          if (gen !== this.pollGen) break;
          interval = Math.min(interval * 2, this.deps.maxBackoffMs);
          this.set({ pollError: isConsoleApiError(e) ? e.message : "Status check failed — retrying quietly." });
        }
      }
      await this.deps.delay(interval);
    }
    if (gen === this.pollGen) this.set({ polling: false });
  }

  /* ── shared mutation error path ───────────────────────────────── */

  private async handleMutationError(e: unknown, retry: () => Promise<void>): Promise<void> {
    if (isConsoleApiError(e) && e.code === "REVISION_CONFLICT" && this.state.view) {
      try {
        const fresh = await this.deps.api.getCharacter(this.state.view.character.id);
        this.set({ view: fresh, characters: this.withCharacter(fresh), notice: "This character changed elsewhere — the latest version is loaded." });
      } catch {
        /* the original error stands */
      }
    }
    this.captureError(e, retry);
  }

  /* ── navigation ───────────────────────────────────────────────── */

  goTo(step: ConsoleStep): void {
    if (step !== "status") this.stopPolling();
    this.set({ step, error: null, fieldErrors: [], notice: null });
  }
}

function formFromView(view: CharacterView, prior: ConsoleFormState): ConsoleFormState {
  const c = view.character;
  const base = emptyForm();
  const mind: MindFormState =
    c.mind?.kind === "local"
      ? {
          kind: "local",
          cloud: base.mind.cloud,
          local: { endpointUrl: c.mind.endpointUrl, model: c.mind.model ?? "" },
        }
      : c.mind?.kind === "cloud"
        ? {
            kind: "cloud",
            cloud: {
              provider: c.mind.provider,
              baseUrl: c.mind.baseUrl ?? CLOUD_BASE_DEFAULT,
              model: c.mind.model ?? "",
              key: "", // secrets never round-trip
            },
            local: base.mind.local,
          }
        : { ...base.mind, cloud: { ...base.mind.cloud, model: prior.mind.cloud.model } };
  return { name: c.name, roleId: c.roleId, directive: c.directive, mind };
}
