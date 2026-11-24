/**
 * Metered reflex backend — the Phase 3 integration point (t_166eb9f5).
 *
 * Sits between the scheduler/autopilot (t_282dd560, `decide(exchange, ctx)`
 * seam) and the Jev backend (t_0b00ee59), routing EVERY provider attempt —
 * first tries and retries alike — through `callReflexMetered`
 * (t_e3f72207): budget reservation BEFORE the call, durable begin/end
 * logging AROUND the call, cost settlement AFTER it. There is no unmetered
 * path by construction: this adapter is the autopilot's only way to reach a
 * paid backend, and it holds no direct fetch/key reference.
 *
 * Retry policy lives HERE, not inside the Jev backend: the backend must be
 * constructed with `maxRetries: 0` so each HTTP attempt gets its own budget
 * authorization, its own begin/end pair in the DecisionLog, and its own
 * settlement (`retryOf`/`retryN` link the chain). Internal backend retries
 * would share one reservation and undercount spend — that is why.
 *
 * Budget exhaustion: the first `BudgetExceededError` is durably logged as a
 * `blocked` attempt (honest $0 — nothing was sent); the adapter then marks
 * the agent done for the UTC cost day and `budgetExhausted()` stays true
 * until the day rolls over. The autopilot's prepare() checks it and stops
 * preparing, so the body rides its last intent instead of flapping against
 * the guard.
 */
import { costDayOf, type AttemptLog, type TriggerInfo } from "./attempts.ts";
import { BudgetExceededError, callReflexMetered } from "./metering.ts";
import type { BudgetGuard } from "./budget.ts";
import type { PriceProvenance } from "./pricing.ts";
import { createJevBackend, type JevBackendConfig } from "./jev.ts";
import type { ReflexCallOutcome } from "./reflex-backend.ts";
import type { ReflexCallOutcome as MeteredOutcome } from "./metering.ts";
import type {
  AttemptContext,
  ReflexBackend as SchedulerBackend,
} from "./scheduler.ts";
import type { ReflexExchange, ReflexResult } from "./types.ts";

export interface MeteredReflexBackend extends SchedulerBackend {
  /** True once the budget guard has denied a call for the current UTC cost
   *  day; false again after the day rolls over. */
  budgetExhausted(): boolean;
  /** Metered provider attempts issued so far, retries included. */
  readonly meteredCalls: number;
  /** Settled + reserved micro-USD per the guard snapshot (diagnostics). */
  committedMicros(): number;
}

/** HTTP statuses the provider itself considers transient (mirrors jev.ts). */
const RETRYABLE_HTTP = new Set([408, 409, 425, 429]);

function retryable(outcome: ReflexCallOutcome): boolean {
  if (outcome.ok) return false;
  if (outcome.error.kind !== "exhausted") return false; // config/invalid_request/provider_rejected
  const last = outcome.meta.attempts[outcome.meta.attempts.length - 1];
  if (!last) return false;
  if (last.outcome === "timeout" || last.outcome === "network_error" || last.outcome === "invalid_response") {
    return true;
  }
  return (
    last.outcome === "http_error" &&
    last.httpStatus !== null &&
    (RETRYABLE_HTTP.has(last.httpStatus) || last.httpStatus >= 500)
  );
}

/** Map the backend's failure vocabulary onto the metering error kinds. */
function toMeteredOutcome(o: ReflexCallOutcome): MeteredOutcome {
  const usage = o.meta.usage
    ? { promptTokens: o.meta.usage.inputTokens, completionTokens: o.meta.usage.outputTokens }
    : null;
  const provider = {
    name: o.meta.provider,
    model: o.meta.resolvedModel ?? o.meta.model,
  };
  if (o.ok) {
    return { result: o.result, raw: o.raw, usage, provider };
  }
  const last = o.meta.attempts[o.meta.attempts.length - 1];
  let kind: NonNullable<MeteredOutcome["error"]>["kind"] = "provider";
  if (o.error.kind === "provider_rejected") kind = "http";
  else if (o.error.kind === "exhausted" && last) {
    if (last.outcome === "timeout") kind = "timeout";
    else if (last.outcome === "invalid_response") kind = "parse";
    else if (last.outcome === "http_error") kind = last.httpStatus === 429 ? "rate_limited" : "http";
    else kind = "http"; // network_error
  }
  return { error: { kind, message: o.error.message }, usage, provider };
}

export function createMeteredReflexBackend(opts: {
  /** Backend config. Internal retries are forcibly disabled by this factory;
   *  only adapter retries can authorize another HTTP attempt. */
  jev: JevBackendConfig;
  guard: BudgetGuard;
  log: AttemptLog;
  /** Owner-side identity the spend is billed against. */
  agentId: string;
  /** Fallback body identity when no attempt context is supplied. */
  bodyId?: string;
  /** Configured provider identity recorded on every attempt row. */
  provider?: { name: string; model: string };
  price?: PriceProvenance;
  /** Retries after the first attempt (each a separate metered call). */
  maxRetries?: number;
  /** Base backoff between retries: backoffMs * 2^(n-1). */
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Host recall closes admission to subsequent internal retries. */
  isActive?: () => boolean;
}): MeteredReflexBackend {
  const backend = createJevBackend({ ...opts.jev, maxRetries: 0 });
  const maxRetries = Math.max(0, Math.min(5, Math.floor(opts.maxRetries ?? 2)));
  if (!Number.isFinite(maxRetries)) throw new Error("invalid retry count");
  const backoffMs = Math.max(0, opts.backoffMs ?? 250);
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? (() => Date.now());
  let exhaustedDay: string | null = null;
  let calls = 0;
  /** Raw backend outcome of the most recent metered call. One adapter serves
   *  one body's scheduler (max-1 in flight by design), so this handoff is
   *  race-free: call() sets it synchronously before the meter resolves. */
  let lastRaw: ReflexCallOutcome | null = null;

  /** The metering seam's backend: one jev decide() == one metered attempt. */
  const meteredBackend = {
    async call(exchange: ReflexExchange): Promise<MeteredOutcome> {
      const raw = await backend.decide(exchange);
      lastRaw = raw;
      return toMeteredOutcome(raw);
    },
  };

  function triggerOf(ctx: AttemptContext | undefined): TriggerInfo {
    const triggers = ctx?.triggers ?? [];
    if (triggers.length === 0) return { kind: "unknown", detail: "no trigger context" };
    const first = triggers[0]!;
    return triggers.length === 1
      ? { kind: first.kind, detail: first.detail }
      : { kind: first.kind, detail: `${first.detail} (+${triggers.length - 1} more: ${triggers.slice(1).map((t) => t.kind).join(", ")})` };
  }

  return {
    get meteredCalls() {
      return calls;
    },
    budgetExhausted() {
      return exhaustedDay !== null && exhaustedDay === costDayOf(now());
    },
    committedMicros() {
      const snap = opts.guard.snapshot(opts.agentId);
      return snap.spentMicros + snap.reservedMicros;
    },
    async decide(exchange: ReflexExchange, ctx?: AttemptContext): Promise<ReflexResult> {
      let firstAttemptId: string | null = null;
      let lastError: string | null = null;
      for (let n = 0; n <= maxRetries; n++) {
        if (opts.isActive?.() === false) throw new Error("reflex runtime stopped");
        lastRaw = null;
        let metered;
        try {
          metered = await callReflexMetered(
            {
              backend: meteredBackend,
              guard: opts.guard,
              log: opts.log,
              provider: opts.provider ?? { name: backend.provider, model: opts.jev.model ?? "jev-latest" },
              price: opts.price,
              clock: now,
            },
            {
              agentId: opts.agentId,
              bodyId: ctx?.bodyId ?? opts.bodyId ?? "unknown-body",
              lane: "reflex",
              trigger: triggerOf(ctx),
              tick: ctx?.tick ?? 0,
              stateHash: ctx?.stateHash ?? "0",
              exchange,
              retryOf: firstAttemptId,
              retryN: n,
            },
          );
        } catch (err) {
          if (err instanceof BudgetExceededError) {
            // Logged as a blocked attempt inside callReflexMetered; the agent
            // is done for the cost day. The scheduler sees a failure once;
            // prepare() stops offering work after this via budgetExhausted().
            exhaustedDay = costDayOf(now());
          }
          throw err;
        }
        calls += 1;
        if (firstAttemptId === null) firstAttemptId = metered.attemptId;
        const outcome = metered.outcome;
        if (outcome.result) return outcome.result;
        lastError = outcome.error?.message ?? "unknown backend failure";
        // Retry classification uses the backend's OWN failure vocabulary
        // (4xx rejections are never retried; timeouts, transport errors,
        // 429/5xx and malformed answers are), captured by the inner call.
        if (!lastRaw || !retryable(lastRaw) || n >= maxRetries) break;
        const wait = backoffMs * 2 ** n;
        if (wait > 0) await sleep(wait);
      }
      throw new Error(lastError ?? "reflex backend failed");
    },
  };
}
