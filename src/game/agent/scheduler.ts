/**
 * Reflex scheduler — decides WHEN a body thinks, never WHAT it does.
 *
 * Push-driven, zero timers, zero polling: the host (src/server/ws.ts pushes
 * welcome + obs frames, adapted by hostfeed.ts) or the solo-vale driver
 * pushes one Observation per sim tick; `ingest` derives events and decides
 * whether a reflex attempt fires. Work is
 * delegated to a two-phase Thinker so this module stays independent of the
 * Jev backend (task t_0b00ee59) and of the durable DecisionLog/budget guard
 * (task t_e3f72207):
 *
 *   prepare(ctx) → P | null   cheap, pure, NO provider contact; null means
 *                             "nothing worth a paid call" and the cycle ends
 *                             silently (no attempt record, no reservation).
 *   authorize(req)            budget gate hook — runs AFTER prepare, BEFORE
 *   execute(req, prepared)    the provider is touched. 1:1 with real calls.
 *
 * Cost guards (contract §5 — reflexes fire on events; the forbidden
 * ~$4/agent/day shape is per-second polling):
 * - coalescing: every trigger derived from one push merges into ONE attempt
 * - duplicate suppression: an unchanged decision surface never re-fires
 * - cooldown: at most one attempt per `reflexCooldownTicks` sim ticks
 * - concurrency: at most `maxConcurrentAttempts` in flight (default 1) plus
 *   one coalesced pending slot — bursts collapse, never queue unboundedly
 * - quiet window: non-survival triggers dropped 22:00–06:00 (cadence default)
 * - failure backoff: consecutive execute failures suppress attempts for an
 *   exponentially growing tick window (capped), so a dead backend cannot burn
 *
 * Survival-critical triggers (hp loss, critical vitals, death, engaged
 * hostiles) bypass the quiet window and are RETAINED across cooldown,
 * backoff, and failed attempts — deferred at most to the next allowed slot,
 * never silently dropped while the scheduler runs. `stop` is the only
 * operation that discards them.
 */
import {
  createDeriveState,
  deriveEvents,
  noteAction,
  surfaceDigest,
  type DeriveState,
  type EventDeriveConfig,
  type ReflexEvent,
  DEFAULT_EVENT_CONFIG,
} from "./events.ts";
import { hashObservation } from "./log.ts";
import { IDLE_HEARTBEAT_TICKS, riskGatedEvents, riskStillRelevant } from "./risk.ts";
import { DEFAULT_CADENCE, type CadencePolicy, type Observation } from "./types.ts";
import type { ReflexExchange, ReflexResult } from "./types.ts";

/* ── Backend seam (implemented by t_0b00ee59; offline stub in stub.ts) ── */

export interface ReflexBackend {
  budgetExhausted?(): boolean;
  /** `ctx` carries the attempt's tick/trigger/stateHash for metering
   *  backends (see AttemptContext); unmetered backends ignore it. */
  decide(exchange: ReflexExchange, ctx?: AttemptContext): Promise<ReflexResult>;
}

/* ── Attempt hooks (durable implementations owned by t_e3f72207) ─────── */

export interface AttemptRequest {
  /** Monotonic within one scheduler run; counts provider attempts + denials. */
  attemptId: number;
  tick: number;
  bodyId: string;
  triggers: ReflexEvent[];
  /** Contract replay key (hashObservation — tick-inclusive). */
  stateHash: string;
  /** Tick-independent dedupe digest. */
  surfaceDigest: string;
}

export type AttemptStatus = "ok" | "error" | "denied";

export interface AttemptRecord extends AttemptRequest {
  status: AttemptStatus;
  /** Wall-clock start (from injected `now`) and duration, for cost reports. */
  startedAtMs: number;
  latencyMs: number;
  /** Error message when status is "error". */
  error: string | null;
}

export interface ThinkContext extends AttemptRequest {
  observation: Observation;
}

/** Optional per-attempt context a Thinker may forward to the backend so a
 *  metering wrapper (t_166eb9f5) can attribute the call (tick, trigger,
 *  stateHash) without re-deriving it from the exchange. Backends that do
 *  not meter (stub, tests) simply ignore it. */
export type AttemptContext = AttemptRequest;

/**
 * The schedulable unit. `prepare` runs synchronously on the push path and
 * must never touch the network; returning null closes the cycle with no
 * attempt record. `execute` runs only after the budget hook authorizes.
 */
export interface Thinker<P> {
  prepare(ctx: ThinkContext): P | null;
  execute(req: AttemptRequest, prepared: P): Promise<void>;
}

export interface SchedulerHooks {
  /**
   * Pre-call budget authorization. Called exactly once per prepared attempt,
   * BEFORE execute runs. Return/resolve false to deny: the provider is never
   * touched, the denial is reported through onAttemptEnd, and the trigger
   * instance is consumed (it does not flap against the guard every push).
   * Default: allow.
   */
  authorize?(req: AttemptRequest): boolean | Promise<boolean>;
  /** Fired when an authorized attempt starts — interrupted attempts stay visible. */
  onAttemptStart?(req: AttemptRequest): void;
  /** Fired exactly once per attempt with its terminal status. */
  onAttemptEnd?(rec: AttemptRecord): void;
}

export interface SchedulerConfig {
  /** Production paid admission; false only for legacy dispatch-mechanics tests. */
  riskGated: boolean;
  idleHeartbeatTicks: number;
  cadence: CadencePolicy;
  events: EventDeriveConfig;
  maxConcurrentAttempts: number;
  /** Base failure backoff in ticks; doubles per consecutive failure. */
  failureBackoffTicks: number;
  maxFailureBackoffTicks: number;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  riskGated: true,
  idleHeartbeatTicks: IDLE_HEARTBEAT_TICKS,
  cadence: DEFAULT_CADENCE,
  events: DEFAULT_EVENT_CONFIG,
  maxConcurrentAttempts: 1,
  failureBackoffTicks: 4,
  maxFailureBackoffTicks: 64,
};

export function inQuietWindow(hour: number, cadence: CadencePolicy): boolean {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const { sleepStartHour, sleepEndHour } = cadence;
  if (sleepStartHour === sleepEndHour) return false;
  return sleepStartHour < sleepEndHour
    ? h >= sleepStartHour && h < sleepEndHour
    : h >= sleepStartHour || h < sleepEndHour;
}

export interface ReflexScheduler {
  /** Feed one pushed observation. No-op after stop(). */
  ingest(obs: Observation): void;
  /** Tell the scheduler the driver acted on the body: re-arms idle
   *  detection so a body that finishes its work asks "what now?" once. */
  noteAction(): void;
  /** Resolves once no attempt is in flight and nothing is queued. Never
   *  awaits cooldown/backoff-retained triggers — those need another push. */
  settled(): Promise<void>;
  /** Unsubscribe from the event flow: ingest becomes a no-op and queued
   *  triggers are discarded. A stopped scheduler cannot be re-started —
   *  create a fresh one (state is session-scoped by design). */
  stop(): void;
  readonly running: boolean;
  /** Attempts started so far (provider-bound + denied; diagnostics). */
  readonly attemptsStarted: number;
  /** Triggers currently retained by cooldown/backoff (diagnostics). */
  readonly retained: number;
}

export function createReflexScheduler<P>(opts: {
  thinker: Thinker<P>;
  hooks?: SchedulerHooks;
  config?: Partial<Omit<SchedulerConfig, "cadence" | "events">> & {
    cadence?: Partial<CadencePolicy>;
    events?: Partial<EventDeriveConfig>;
  };
  now?: () => number;
}): ReflexScheduler {
  const config: SchedulerConfig = {
    ...DEFAULT_SCHEDULER_CONFIG,
    ...opts.config,
    cadence: { ...DEFAULT_CADENCE, ...opts.config?.cadence },
    events: { ...DEFAULT_EVENT_CONFIG, ...opts.config?.events },
  };
  const hooks: SchedulerHooks = opts.hooks ?? {};
  const now = opts.now ?? (() => Date.now());

  let running = true;
  let derive: DeriveState = createDeriveState();
  let attemptCounter = 0;
  let inFlight = 0;
  let lastAttemptTick: number | null = null;
  let consecutiveFailures = 0;
  let backoffUntilTick: number | null = null;
  /** Surface covered by the most recent provider attempt; unchanged ⇒ suppress. */
  let suppressSurface: string | null = null;
  let pending: { obs: Observation; triggers: ReflexEvent[] } | null = null;
  let prevQuiet: boolean | null = null;
  let drainWaiters: (() => void)[] = [];

  // Retained work cannot progress without a future push; do not deadlock
  // callers waiting for the current provider/authorization work to settle.
  const drained = () => inFlight === 0;
  const notifyDrained = () => {
    if (!drained()) return;
    const waiters = drainWaiters;
    drainWaiters = [];
    for (const w of waiters) w();
  };

  /** Merge triggers into the single pending slot (latest observation wins,
   *  kinds union) — a burst collapses to at most one queued attempt. */
  const offer = (obs: Observation, triggers: ReflexEvent[]): void => {
    if (pending !== null) {
      const kinds = new Set(pending.triggers.map((t) => t.kind));
      pending = {
        obs,
        triggers: [...pending.triggers, ...triggers.filter((t) => !kinds.has(t.kind))],
      };
    } else {
      pending = { obs, triggers };
    }
    pump();
  };

  const fire = (obs: Observation, triggers: ReflexEvent[]): void => {
    lastAttemptTick = obs.tick;
    const digest = surfaceDigest(obs);
    const base = {
      tick: obs.tick,
      bodyId: obs.you.id,
      triggers,
      stateHash: hashObservation(obs),
      surfaceDigest: digest,
    };
    const startedAtMs = now();
    inFlight += 1;
    void (async () => {
      let req: AttemptRequest | null = null;
      const finish = (status: AttemptStatus, error: string | null) => {
        if (req === null) return;
        hooks.onAttemptEnd?.({
          ...req,
          status,
          startedAtMs,
          latencyMs: Math.max(0, now() - startedAtMs),
          error,
        });
      };
      try {
        const prepared = opts.thinker.prepare({ ...base, attemptId: 0, observation: obs });
        if (prepared === null) {
          // Nothing worth a paid call. Not an attempt: no reservation, no
          // record, no surface suppression — cheap re-prepares are allowed.
          return;
        }
        req = { ...base, attemptId: ++attemptCounter };
        suppressSurface = digest;
        const allowed = (await hooks.authorize?.(req)) ?? true;
        if (!allowed) {
          // Budget denial consumes the trigger: the body goes without this
          // decision and must not flap against the guard on every push.
          finish("denied", null);
          return;
        }
        hooks.onAttemptStart?.(req);
        await opts.thinker.execute(req, prepared);
        consecutiveFailures = 0;
        backoffUntilTick = null;
        finish("ok", null);
      } catch (err) {
        consecutiveFailures += 1;
        const backoff = Math.min(
          config.maxFailureBackoffTicks,
          config.failureBackoffTicks * 2 ** (consecutiveFailures - 1),
        );
        backoffUntilTick = obs.tick + backoff;
        finish("error", err instanceof Error ? err.message : String(err));
        // Survival-critical triggers are never lost to a failed attempt:
        // they re-enter the pending slot and fire once backoff expires.
        const survival = triggers.filter((t) => t.survival);
        if (running && survival.length > 0) offer(obs, survival);
      } finally {
        inFlight -= 1;
        pump();
      }
    })();
  };

  /** Start queued work within backoff/cooldown/concurrency bounds. */
  const pump = (): void => {
    if (!running || pending === null) {
      notifyDrained();
      return;
    }
    if (inFlight >= config.maxConcurrentAttempts) return; // resumes via finally→pump
    const { obs, triggers } = pending;
    if (backoffUntilTick !== null && obs.tick < backoffUntilTick) {
      notifyDrained();
      return; // retained — fires from a later push
    }
    if (
      lastAttemptTick !== null &&
      obs.tick - lastAttemptTick < config.cadence.reflexCooldownTicks
    ) {
      notifyDrained();
      return; // retained — a later push (its tick window past) fires it
    }
    pending = null;
    fire(obs, triggers);
  };

  /** No new triggers this push: the tick still advanced, so a retained
   *  trigger whose cooldown/backoff window has passed releases now, with the
   *  freshest observation. Never creates work — only unblocks existing work. */
  const releaseRetained = (obs: Observation): void => {
    if (pending !== null) {
      pending = { ...pending, obs };
      pump();
    } else {
      notifyDrained();
    }
  };

  return {
    get running() {
      return running;
    },
    get attemptsStarted() {
      return attemptCounter;
    },
    get retained() {
      return pending?.triggers.length ?? 0;
    },
    noteAction(): void {
      if (!running) return;
      noteAction(derive);
    },
    ingest(obs: Observation): void {
      if (!running) return;
      const quiet = inQuietWindow(obs.hour, config.cadence);
      const events = deriveEvents(derive, obs, config.events);
      // Wake trigger: leaving the quiet window is itself an event — without
      // it a body that slept through daybreak would stand until something
      // else changed. (isNight and the cadence window do not align exactly.)
      if (prevQuiet === true && !quiet) {
        events.push({ kind: "world.daybreak", survival: false, detail: "quiet window ended" });
      }
      prevQuiet = quiet;

      if (config.riskGated && pending !== null) {
        const remaining = pending.triggers.filter(t => riskStillRelevant(t, obs, config.events));
        pending = remaining.length ? { obs, triggers: remaining } : null;
      }

      // Quiet window: opportunities are dropped (the body sleeps); danger
      // still wakes the reflexes, per contract §5.
      let triggers = config.riskGated
        ? riskGatedEvents(obs, events, config.events, lastAttemptTick, config.idleHeartbeatTicks)
        : quiet ? events.filter((e) => e.survival) : events;
      if (triggers.length === 0) {
        // Eventless (or quiet-filtered) push: the tick still advanced, so a
        // retained trigger whose window has passed releases now. No events
        // means no NEW work is created here.
        releaseRetained(obs);
        return;
      }

      // Duplicate suppression: while the decision surface is unchanged from
      // the last provider attempt, normal triggers repeat a question already
      // answered at full price — drop them. Survival triggers always pass.
      if (suppressSurface !== null && surfaceDigest(obs) === suppressSurface) {
        triggers = triggers.filter((t) => t.survival);
        if (triggers.length === 0) {
          releaseRetained(obs);
          return;
        }
      }
      offer(obs, triggers);
    },
    settled(): Promise<void> {
      if (drained()) return Promise.resolve();
      return new Promise((resolve) => drainWaiters.push(resolve));
    },
    stop(): void {
      running = false;
      pending = null;
      suppressSurface = null;
      backoffUntilTick = null;
      derive = createDeriveState();
      notifyDrained();
    },
  };
}
