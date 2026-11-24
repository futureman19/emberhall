/**
 * Phase 4 director console — the screen (mobile-first, single column).
 *
 * Renders the framework-free ConsoleController state machine. All policy
 * (validation, retry, polling, token custody) lives in the controller; this
 * file only draws state and forwards intents.
 *
 * Secrets: the owner resume token and the cloud key are password inputs that
 * render autocomplete="off" in the DOM, held in memory for the session only.
 * The owner token is shown exactly once after account creation. Nothing secret
 * is persisted to durable browser storage and nothing secret is ever logged.
 */
import { useEffect, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  CONSOLE_TOKEN_STORAGE_KEY,
  ConsoleController,
  deriveBanner,
  readinessChecklist,
} from "@/components/console/console-controller";
import {
  BETA_NOTE,
  CLOUD_KEY_NOTE,
  CONSOLE_STEPS,
  LOCAL_MIND_NETWORK_NOTE,
  directiveCounterText,
  driverLabel,
  fieldErrorFor,
  lifecycleLabel,
  mindStateLabel,
  runtimeLabel,
  runtimeStateLabel,
  stepHeading,
  stepProgressIndex,
  unleashBlockReason,
  type ConsoleRuntimeKind,
} from "@/components/console/console-view";
import { createConsoleHttpApi, type CharacterView, type ConsoleApi } from "@/lib/console-api";
import { createMockConsoleApi } from "@/lib/console-mock";
import {
  CLOUD_PROVIDERS,
  DIRECTIVE_MAX,
  type CloudProvider,
  type FieldError,
} from "@/game/agent/account";

/**
 * Session token custody: a module-level memory slot backed by sessionStorage
 * (tab-scoped, gone when the tab closes). The controller persists through the
 * storage dep below; this slot lets fresh mounts resume without a re-paste.
 */
let memoryToken: string | null = null;

function readSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(CONSOLE_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

const readToken = (): string | null => memoryToken ?? readSessionToken();

const sessionStore =
  typeof window === "undefined"
    ? null
    : {
        getItem: (key: string) => {
          try {
            return window.sessionStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key: string, value: string) => {
          try {
            window.sessionStorage.setItem(key, value);
          } catch {
            /* storage unavailable — memory slot still works */
          }
        },
        removeItem: (key: string) => {
          try {
            window.sessionStorage.removeItem(key);
          } catch {
            /* storage unavailable */
          }
        },
      };

const BTN =
  "min-h-11 rounded border border-border-strong bg-surface-2 px-4 text-base text-fg " +
  "hover:border-gold disabled:cursor-not-allowed disabled:opacity-50";
const BTN_PRIMARY =
  "min-h-11 rounded border border-gold bg-stone px-4 text-base font-semibold text-fg " +
  "hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";
const INPUT =
  "min-h-11 w-full rounded border border-border-strong bg-surface px-3 text-base text-fg " +
  "placeholder:text-muted focus:border-gold focus:outline-2 focus:outline-offset-2 focus:outline-gold";
const LABEL = "mb-1 block text-sm font-semibold text-muted";

function FieldHint({ errors, field }: { errors: FieldError[]; field: string }) {
  const err = fieldErrorFor(errors, field);
  if (!err) return null;
  return (
    <p
      id={`field-error-${field}`}
      role="alert"
      className="mt-1 break-words text-sm text-health"
      data-testid={`field-error-${field}`}
    >
      {err.message}
    </p>
  );
}

function BusyNote({ busy }: { busy: boolean }) {
  if (!busy) return null;
  return (
    <p role="status" data-testid="busy" className="text-sm text-muted">
      Working…
    </p>
  );
}

export interface ConsoleScreenProps {
  /** "http" (default) targets the live host; explicit "mock" is a contract preview. */
  runtime?: ConsoleRuntimeKind;
  /** Optional injected client (tests / host integration). */
  api?: ConsoleApi;
}

export function ConsoleScreen({ runtime = "http", api }: ConsoleScreenProps) {
  const [controller] = useState(() => {
    const getToken = readToken;
    const client =
      api ??
      (runtime === "http"
        ? createConsoleHttpApi({ getToken })
        : createMockConsoleApi({ getToken }).api);
    return new ConsoleController({
      api: client,
      getToken,
      setToken: (token) => {
        memoryToken = token;
      },
      storage: sessionStore,
      isVisible: () => typeof document === "undefined" || document.visibilityState === "visible",
    });
  });
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  useEffect(() => () => controller.stopPolling(), [controller]);
  // Reload recovery: a persisted session token resumes the owner silently
  // instead of stranding them on the account step (duplicate-character trap).
  useEffect(() => {
    void controller.resumeSession();
  }, [controller]);

  const [resumeToken, setResumeToken] = useState("");
  const [copied, setCopied] = useState(false);
  // First client render must match SSR; only after mount may render-time
  // logic consult sessionStorage (see canGoTo).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const busy = state.busy;
  const errors = state.fieldErrors;
  /** ARIA wiring: mark the invalid field and point it at its visible error. */
  const errorProps = (field: string): { "aria-invalid"?: true; "aria-describedby"?: string } =>
    fieldErrorFor(errors, field) ? { "aria-invalid": true, "aria-describedby": `field-error-${field}` } : {};
  /** Enter submits single-line fields (textarea keeps its newline). */
  const enterSubmit = (submit: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || busy) return;
    e.preventDefault();
    submit();
  };
  const stepIndex = stepProgressIndex(state.step);
  const banner = deriveBanner(state.status, state.view?.character.name ?? "Your character");
  const previewLabel = runtimeLabel(runtime);
  const blockReason = unleashBlockReason(state.view, busy);

  const canGoTo = (step: (typeof CONSOLE_STEPS)[number]): boolean => {
    if (step === "account") return true;
    // Hydration-safe: the first client render must match SSR (no token).
    // After mount, a persisted token enables the nav; resumeSession()
    // restores the session itself.
    if (!state.account && (!mounted || readToken() === null)) return false;
    if (step === "status") return state.view !== null;
    if (step !== "character" && state.view === null) return false;
    return true;
  };

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(readToken() ?? "");
      setCopied(true);
    } catch {
      /* clipboard unavailable — the token stays visible for manual copy */
    }
  };

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
        <header className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-widest text-muted">Emberhall · Director console</p>
          <h1 className="font-display text-2xl text-gold">Raise a character, connect a mind</h1>
          {previewLabel && (
            <p
              data-testid="runtime-label"
              className="rounded border border-border bg-surface px-3 py-2 text-sm text-muted"
            >
              {previewLabel}
            </p>
          )}
          <p className="text-sm text-muted" data-testid="beta-note">{BETA_NOTE}</p>
          <Link to="/" className="inline-block py-1 text-sm text-accent underline underline-offset-2">
            Back to the vale
          </Link>
        </header>

        <nav aria-label="Console steps" className="flex flex-wrap gap-1">
          {CONSOLE_STEPS.map((step, i) => {
            const current = step === state.step;
            const enabled = canGoTo(step);
            return (
              <button
                key={step}
                type="button"
                data-testid={`step-${step}`}
                aria-current={current ? "step" : undefined}
                disabled={!enabled}
                onClick={() => controller.goTo(step)}
                className={
                  "min-h-11 rounded px-2 text-sm " +
                  (current
                    ? "border border-gold bg-stone text-fg"
                    : i < stepIndex
                      ? "border border-border text-muted hover:text-fg"
                      : "border border-border text-muted opacity-60")
                }
              >
                {i + 1}. {step}
              </button>
            );
          })}
        </nav>

        <BusyNote busy={busy} />

        {state.notice && (
          <p role="status" data-testid="notice" className="break-words rounded border border-border bg-surface px-3 py-2 text-sm">
            {state.notice}
          </p>
        )}

        {state.error && (
          <div role="alert" data-testid="error" className="rounded border border-health bg-surface px-3 py-2">
            <p className="break-words text-base">{state.error.message}</p>
            {errors.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-sm text-health">
                {errors.map((err) => (
                  <li key={`${err.field}-${err.code}`} className="break-words">{err.message}</li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {state.error.recoverable && (
                <button
                  type="button"
                  data-testid="retry"
                  disabled={busy}
                  onClick={() => void controller.retry()}
                  className={BTN_PRIMARY}
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                data-testid="dismiss-error"
                onClick={() => controller.dismissError()}
                className={BTN}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {state.step === "account" && (
          <section className="flex flex-col gap-3 rounded border border-border bg-surface p-4">
            <h2 className="font-display text-xl text-gold">{stepHeading("account")}</h2>
            {state.tokenRevealed ? (
              <div className="flex flex-col gap-2" data-testid="token-reveal">
                <p className="text-sm">
                  Save your owner token now — it is shown only once. It is the key to this console;
                  keep it private.
                </p>
                <code
                  data-testid="owner-token"
                  className="break-all rounded border border-border-strong bg-bg px-3 py-2 text-sm"
                >
                  {readToken()}
                </code>
                <div className="flex flex-wrap gap-2">
                  <button type="button" data-testid="copy-token" onClick={() => void copyToken()} className={BTN}>
                    {copied ? "Copied" : "Copy token"}
                  </button>
                  <button
                    type="button"
                    data-testid="token-saved"
                    onClick={() => controller.confirmTokenSaved()}
                    className={BTN_PRIMARY}
                  >
                    I have saved it — continue
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted">New here? One tap, no cost, no setup.</p>
                  <button
                    type="button"
                    data-testid="create-account"
                    disabled={busy}
                    onClick={() => void controller.createAccount()}
                    className={BTN_PRIMARY}
                  >
                    Create a free account
                  </button>
                </div>
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <label htmlFor="resume-token" className={LABEL}>
                    Returning? Paste your owner token
                  </label>
                  <input
                    id="resume-token"
                    data-testid="resume-token"
                    type="password"
                    autoComplete="off"
                    value={resumeToken}
                    onChange={(e) => setResumeToken(e.target.value)}
                    onKeyDown={enterSubmit(() => {
                      if (resumeToken.trim() !== "") void controller.resumeWithToken(resumeToken);
                    })}
                    {...errorProps("ownerToken")}
                    className={INPUT}
                  />
                  <FieldHint errors={errors} field="ownerToken" />
                  <button
                    type="button"
                    data-testid="resume"
                    disabled={busy || resumeToken.length === 0}
                    onClick={() => void controller.resumeWithToken(resumeToken)}
                    className={BTN}
                  >
                    Resume
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {state.step === "character" && (
          <section className="flex flex-col gap-3 rounded border border-border bg-surface p-4">
            <h2 className="font-display text-xl text-gold">{stepHeading("character")}</h2>
            {state.characters.length > 0 && (
              <ul className="flex flex-col gap-2" data-testid="character-list">
                {state.characters.map((entry: CharacterView) => (
                  <li key={entry.character.id}>
                    <button
                      type="button"
                      data-testid={`character-${entry.character.id}`}
                      disabled={busy}
                      onClick={() => void controller.selectCharacter(entry.character.id)}
                      className={BTN + " w-full text-left"}
                    >
                      <span className="break-words font-semibold">{entry.character.name}</span>
                      <span className="ml-2 text-sm text-muted">
                        {entry.character.roleId} · {lifecycleLabel(entry.character.lifecycle)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {state.view === null ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="character-name" className={LABEL}>
                  Character name
                </label>
                <input
                  id="character-name"
                  data-testid="name"
                  type="text"
                  value={state.form.name}
                  onChange={(e) => controller.updateForm({ name: e.target.value })}
                  onKeyDown={enterSubmit(() => void controller.submitName())}
                  {...errorProps("name")}
                  className={INPUT}
                />
                <FieldHint errors={errors} field="name" />
                <button
                  type="button"
                  data-testid="save-name"
                  disabled={busy}
                  onClick={() => void controller.submitName()}
                  className={BTN_PRIMARY}
                >
                  Save and choose a role
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="new-character"
                disabled={busy}
                onClick={() => controller.startNewCharacter()}
                className={BTN}
              >
                Raise a new character
              </button>
            )}
          </section>
        )}

        {state.step === "role" && (
          <section className="flex flex-col gap-3 rounded border border-border bg-surface p-4">
            <h2 className="font-display text-xl text-gold">{stepHeading("role")}</h2>
            {state.manifest === null ? (
              <p role="alert" className="text-sm text-health">
                The role pack could not be loaded. Go back to the account step and resume again to
                retry.
              </p>
            ) : (
              <div className="flex flex-col gap-2" data-testid="role-list">
                {state.manifest.packs.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    data-testid={`role-${pack.id}`}
                    disabled={busy}
                    onClick={() => void controller.submitRole(pack.id)}
                    className={
                      BTN +
                      " w-full text-left " +
                      (state.form.roleId === pack.id ? "border-gold" : "")
                    }
                  >
                    <span className="block font-semibold">{pack.label}</span>
                    <span className="block text-sm text-muted">{pack.summary}</span>
                    <span className="mt-1 block text-xs text-muted">
                      Starts with:{" "}
                      {Object.entries(pack.startingSkills)
                        .map(([skill, level]) => `${skill} ${level}`)
                        .join(", ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {state.step === "directive" && (
          <section className="flex flex-col gap-3 rounded border border-border bg-surface p-4">
            <h2 className="font-display text-xl text-gold">{stepHeading("directive")}</h2>
            <p className="text-sm text-muted">
              One sentence is enough. This is the standing order your character lives by.
            </p>
            <label htmlFor="directive" className={LABEL}>
              Directive
            </label>
            <textarea
              id="directive"
              data-testid="directive"
              rows={5}
              value={state.form.directive}
              onChange={(e) => controller.updateForm({ directive: e.target.value })}
              {...errorProps("directive")}
              className={INPUT + " resize-y"}
            />
            <p
              data-testid="directive-counter"
              className={"text-sm " + (state.form.directive.length > DIRECTIVE_MAX ? "text-health" : "text-muted")}
            >
              {directiveCounterText(state.form.directive.length)}
            </p>
            <FieldHint errors={errors} field="directive" />
            <button
              type="button"
              data-testid="save-directive"
              disabled={busy}
              onClick={() => void controller.submitDirective()}
              className={BTN_PRIMARY}
            >
              Save and connect a mind
            </button>
          </section>
        )}

        {state.step === "mind" && (
          <section data-testid="mind-step" className="flex flex-col gap-3 rounded border border-border bg-surface p-4">
            <h2 className="font-display text-xl text-gold">{stepHeading("mind")}</h2>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Mind connector">
              <button
                type="button"
                data-testid="mind-kind-cloud"
                aria-pressed={state.form.mind.kind === "cloud"}
                onClick={() => controller.updateMindForm({ kind: "cloud" })}
                className={BTN + (state.form.mind.kind === "cloud" ? " border-gold" : "")}
              >
                Cloud mind (your key)
              </button>
              <button
                type="button"
                data-testid="mind-kind-local"
                aria-pressed={state.form.mind.kind === "local"}
                onClick={() => controller.updateMindForm({ kind: "local" })}
                className={BTN + (state.form.mind.kind === "local" ? " border-gold" : "")}
              >
                Local mind (your endpoint)
              </button>
            </div>

            {state.form.mind.kind === "cloud" ? (
              <div className="flex flex-col gap-3">
                {state.view?.publicMind?.secretHint === "configured" && (
                  <p data-testid="key-configured" className="text-sm text-muted">
                    A key is already stored. Enter a new one only to replace it.
                  </p>
                )}
                <div>
                  <label htmlFor="mind-provider" className={LABEL}>
                    Provider
                  </label>
                  <select
                    id="mind-provider"
                    data-testid="mind-provider"
                    value={state.form.mind.cloud.provider ?? ""}
                    onChange={(e) =>
                      controller.updateMindForm({ cloud: { provider: e.target.value as CloudProvider } })
                    }
                    className={INPUT}
                  >
                    {CLOUD_PROVIDERS.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                  <FieldHint errors={errors} field="mind.provider" />
                </div>
                <div>
                  <label htmlFor="mind-base-url" className={LABEL}>
                    API base URL
                  </label>
                  <input
                    id="mind-base-url"
                    data-testid="mind-base-url"
                    type="text"
                    value={state.form.mind.cloud.baseUrl ?? ""}
                    onChange={(e) => controller.updateMindForm({ cloud: { baseUrl: e.target.value } })}
                    onKeyDown={enterSubmit(() => void controller.submitMind())}
                    {...errorProps("mind.baseUrl")}
                    className={INPUT}
                  />
                  <FieldHint errors={errors} field="mind.baseUrl" />
                </div>
                <div>
                  <label htmlFor="mind-model" className={LABEL}>
                    Model
                  </label>
                  <input
                    id="mind-model"
                    data-testid="mind-model"
                    type="text"
                    value={state.form.mind.cloud.model ?? ""}
                    onChange={(e) => controller.updateMindForm({ cloud: { model: e.target.value } })}
                    onKeyDown={enterSubmit(() => void controller.submitMind())}
                    {...errorProps("mind.model")}
                    className={INPUT}
                  />
                  <FieldHint errors={errors} field="mind.model" />
                </div>
                <div>
                  <label htmlFor="mind-key" className={LABEL}>
                    Provider key
                  </label>
                  <input
                    id="mind-key"
                    data-testid="mind-key"
                    type="password"
                    autoComplete="off"
                    value={state.form.mind.cloud.key ?? ""}
                    onChange={(e) => controller.updateMindForm({ cloud: { key: e.target.value } })}
                    onKeyDown={enterSubmit(() => void controller.submitMind())}
                    {...errorProps("mind.key")}
                    className={INPUT}
                  />
                  <FieldHint errors={errors} field="mind.key" />
                </div>
                <p className="text-sm text-muted">{CLOUD_KEY_NOTE}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <label htmlFor="mind-endpoint" className={LABEL}>
                    Endpoint URL
                  </label>
                  <input
                    id="mind-endpoint"
                    data-testid="mind-endpoint"
                    type="text"
                    value={state.form.mind.local.endpointUrl ?? ""}
                    onChange={(e) => controller.updateMindForm({ local: { endpointUrl: e.target.value } })}
                    onKeyDown={enterSubmit(() => void controller.submitMind())}
                    {...errorProps("mind.endpointUrl")}
                    className={INPUT}
                  />
                  <FieldHint errors={errors} field="mind.endpointUrl" />
                </div>
                <div>
                  <label htmlFor="mind-local-model" className={LABEL}>
                    Model
                  </label>
                  <input
                    id="mind-local-model"
                    data-testid="mind-local-model"
                    type="text"
                    value={state.form.mind.local.model ?? ""}
                    onChange={(e) => controller.updateMindForm({ local: { model: e.target.value } })}
                    onKeyDown={enterSubmit(() => void controller.submitMind())}
                    {...errorProps("mind.model")}
                    className={INPUT}
                  />
                  <FieldHint errors={errors} field="mind.model" />
                </div>
                <p className="text-sm text-muted">{LOCAL_MIND_NETWORK_NOTE}</p>
              </div>
            )}

            <button
              type="button"
              data-testid="save-mind"
              disabled={busy}
              onClick={() => void controller.submitMind()}
              className={BTN_PRIMARY}
            >
              Save mind connection
            </button>
          </section>
        )}

        {state.step === "review" && state.view && (
          <section className="flex flex-col gap-3 rounded border border-border bg-surface p-4">
            <h2 className="font-display text-xl text-gold">{stepHeading("review")}</h2>
            <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              <dt className="text-muted">Name</dt>
              <dd data-testid="review-name" className="min-w-0 break-words">{state.view.character.name}</dd>
              <dt className="text-muted">Role</dt>
              <dd data-testid="review-role" className="min-w-0 break-words">
                {state.manifest?.packs.find((p) => p.id === state.view?.character.roleId)?.label ??
                  state.view.character.roleId}
              </dd>
              <dt className="text-muted">Directive</dt>
              <dd data-testid="review-directive" className="min-w-0 break-words">{state.view.character.directive}</dd>
              <dt className="text-muted">Mind</dt>
              <dd data-testid="review-mind" className="min-w-0 break-words">
                {state.view.publicMind === null
                  ? "none"
                  : state.view.publicMind.config.kind === "cloud"
                    ? `cloud · ${state.view.publicMind.config.model ?? ""} · ${state.view.publicMind.secretHint ?? "no key yet"}`
                    : `local · ${state.view.publicMind.config.model ?? ""} · ${state.view.publicMind.config.endpointUrl}`}
              </dd>
            </dl>
            <ul className="flex flex-col gap-1" data-testid="readiness">
              {readinessChecklist(state.view).map((item) => (
                <li key={item.key} data-testid={`readiness-${item.key}`} className="text-sm">
                  <span className={item.ok ? "text-accent" : "text-health"}>
                    {item.ok ? "✓" : "✗"} {item.label}
                  </span>
                  {!item.ok && item.hint && <span className="block text-xs text-muted">{item.hint}</span>}
                </li>
              ))}
            </ul>
            {blockReason && (
              <p data-testid="unleash-block" className="text-sm text-muted">
                {blockReason}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="unleash"
                disabled={blockReason !== null}
                onClick={() => void controller.unleashNow()}
                className={BTN_PRIMARY}
              >
                Unleash into the vale
              </button>
              {state.view.character.lifecycle === "unleashed" && (
                <button
                  type="button"
                  data-testid="open-status"
                  onClick={() => {
                    controller.startPolling();
                    controller.goTo("status");
                  }}
                  className={BTN}
                >
                  View status
                </button>
              )}
            </div>
          </section>
        )}

        {state.step === "status" && (
          <section className="flex flex-col gap-3 rounded border border-border bg-surface p-4">
            <h2 className="font-display text-xl text-gold">{stepHeading("status")}</h2>
            {banner && (
              <div
                role="status"
                data-testid={`banner-${banner.kind}`}
                className={
                  "rounded border px-3 py-2 text-sm " +
                  (banner.kind === "autopilot" ? "border-accent bg-surface-2" : "border-health bg-surface-2")
                }
              >
                {banner.text}
              </div>
            )}
            {state.status === null ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted">Status is unavailable right now.</p>
                <button
                  type="button"
                  data-testid="refresh-status"
                  onClick={() => controller.startPolling()}
                  className={BTN}
                >
                  Refresh status
                </button>
              </div>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Lifecycle</dt>
                  <dd data-testid="status-lifecycle">{lifecycleLabel(state.status.lifecycle)}</dd>
                  <dt className="text-muted">Driver</dt>
                  <dd data-testid="status-driver">{driverLabel(state.status.driver)}</dd>
                  <dt className="text-muted">Mind</dt>
                  <dd data-testid="status-mind">{mindStateLabel(state.status.mindState)}</dd>
                  <dt className="text-muted">Runtime</dt>
                  <dd data-testid="status-runtime">{runtimeStateLabel(state.status.runtimeState)}</dd>
                  {state.status.body && (
                    <>
                      <dt className="text-muted">Health</dt>
                      <dd data-testid="status-hp">
                        {state.status.body.hp}/{state.status.body.maxHp}
                      </dd>
                      <dt className="text-muted">Doing</dt>
                      <dd data-testid="status-task">{state.status.body.task}</dd>
                    </>
                  )}
                </dl>
                {state.status.journalTail.length > 0 && (
                  <ul data-testid="journal" className="flex flex-col gap-1 border-t border-border pt-2 text-sm">
                    {state.status.journalTail.map((line, i) => (
                      <li key={i} className={"break-words " + (line.includes("(autopilot)") ? "italic text-muted" : "")}>
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
                {state.pollError && (
                  <p role="status" data-testid="poll-error" className="text-sm text-muted">
                    {state.pollError}
                  </p>
                )}
              </>
            )}
            <div className="flex flex-wrap gap-2">
              {state.status?.lifecycle === "unleashed" && (
                <button
                  type="button"
                  data-testid="recall"
                  disabled={busy}
                  onClick={() => void controller.recallNow()}
                  className={BTN}
                >
                  Recall to safety
                </button>
              )}
              {state.status?.lifecycle === "recalled" && (
                <button
                  type="button"
                  data-testid="unleash"
                  disabled={blockReason !== null}
                  onClick={() => void controller.unleashNow()}
                  className={BTN_PRIMARY}
                >
                  Unleash again
                </button>
              )}
              <button
                type="button"
                data-testid="back-to-characters"
                onClick={() => controller.goTo("character")}
                className={BTN}
              >
                Back to characters
              </button>
              <button type="button" data-testid="logout" onClick={() => controller.logout()} className={BTN}>
                Log out
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
