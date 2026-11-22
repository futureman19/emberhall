/**
 * Metered reflex calls — the Phase 3 integration seam.
 *
 * The scheduler (autopilot) and the Jev backend meet here: every provider
 * attempt goes through budget authorization BEFORE the call and durable
 * attempt logging AROUND the call. There is no unmetered path: this module
 * is the only supported way to turn a ReflexExchange into a provider call.
 *
 *   1. redact request → 2. reserve budget (sync, atomic) → 3. log begin →
 *   4. backend.call → 5. cost (reported usage, else fail-closed estimate) →
 *   6. log end + settle reservation
 *
 * Budget denial logs a "blocked" attempt (honest $0 — nothing was sent) and
 * throws BudgetExceededError. Provider failures still log and still settle
 * (a failed call may have been billed). Retries are separate attempts, each
 * authorized, logged and charged on its own, linked by retryOf/retryN.
 */
import {
  blockedCost,
  costForOutcome,
  digestAnswers,
  newAttemptId,
  redactForLog,
  utf8Bytes,
  type AttemptLane,
  type AttemptLog,
  type CostAttribution,
  type TriggerInfo,
} from "./attempts.ts";
import { BudgetGuard, type BudgetSnapshot } from "./budget.ts";
import {
  DEFAULT_PRICE,
  microsForReservation,
  type PriceProvenance,
  type UsageReport,
} from "./pricing.ts";
import type { ReflexExchange, ReflexResult } from "./types.ts";

/** What a reflex backend returns. Backends return outcomes, they do not
 *  throw — the meter maps throws to {error:{kind:"unknown"}} defensively. */
export interface ReflexCallOutcome {
  /** Normalized answers on success. */
  result?: ReflexResult;
  /**
   * Raw pre-normalization probabilities keyed by question id (number[] for
   * choice/score, number for noul). Providing this enables STRICT replay;
   * without it replay validates structure and digest only.
   */
  raw?: Record<string, number[] | number>;
  error?: {
    kind: "http" | "timeout" | "rate_limited" | "parse" | "provider" | "unknown";
    message: string;
  };
  /** Provider usage row. Missing/null => fail-closed estimate, never free. */
  usage?: UsageReport | null;
  provider?: { name: string; model: string };
}

export interface ReflexBackend {
  call(exchange: ReflexExchange): Promise<ReflexCallOutcome>;
}

export class BudgetExceededError extends Error {
  readonly code = "BUDGET_EXCEEDED" as const;
  readonly snapshot: BudgetSnapshot;
  constructor(reason: string, snapshot: BudgetSnapshot) {
    super(reason);
    this.name = "BudgetExceededError";
    this.snapshot = snapshot;
  }
}

export interface MeteredDeps {
  backend: ReflexBackend;
  guard: BudgetGuard;
  log: AttemptLog;
  price?: PriceProvenance;
  /** Configured provider identity recorded on every attempt. */
  provider?: { name: string; model: string };
  clock?: () => number;
}

export interface MeteredCallInput {
  agentId: string;
  bodyId: string;
  lane?: AttemptLane;
  trigger: TriggerInfo;
  tick: number;
  stateHash: string;
  exchange: ReflexExchange;
  retryOf?: string | null;
  retryN?: number;
}

export interface MeteredCallResult {
  attemptId: string;
  outcome: ReflexCallOutcome;
  cost: CostAttribution;
  latencyMs: number;
}

export async function callReflexMetered(
  deps: MeteredDeps,
  input: MeteredCallInput,
): Promise<MeteredCallResult> {
  // Snapshot the tariff before awaiting provider work.
  const price = { ...(deps.price ?? DEFAULT_PRICE) };
  const clock = deps.clock ?? Date.now;
  const lane = input.lane ?? "reflex";
  const attemptId = newAttemptId(clock());

  // 1. Redact. The request persisted to the log never carries credentials.
  const redacted = redactForLog(input.exchange);
  const requestBytes = utf8Bytes(JSON.stringify(redacted.value));

  // 2. Pre-call budget authorization (synchronous — atomic under concurrency).
  const estimate = microsForReservation(requestBytes, price);
  const auth = deps.guard.reserve(input.agentId, estimate);
  if (!auth.ok) {
    const now = clock();
    try {
      deps.log.begin({
        type: "begin",
        attemptId,
        agentId: input.agentId,
        bodyId: input.bodyId,
        lane,
        trigger: input.trigger,
        tick: input.tick,
        stateHash: input.stateHash,
        startedAt: now,
        provider: null,
        request: { exchange: redacted.value, bytes: requestBytes, redactions: redacted.redactions },
        reservationId: null,
        reservationMicros: 0,
        price,
        retryOf: input.retryOf ?? null,
        retryN: input.retryN ?? 0,
      });
      deps.log.end({
        type: "end",
        attemptId,
        endedAt: now,
        status: "blocked",
        response: null,
        error: { kind: "budget", message: auth.reason },
        usage: null,
        cost: blockedCost(),
        latencyMs: 0,
      });
    } catch (error) {
      deps.guard.failClosed("blocked attempt write failed");
      throw error;
    }
    throw new BudgetExceededError(auth.reason, auth.snapshot);
  }
  const reservationId = auth.reservationId;

  // 3. Log begin BEFORE the call — an interruption still leaves this row.
  const startedAt = clock();
  try {
    deps.log.begin({
      type: "begin",
      attemptId,
      agentId: input.agentId,
      bodyId: input.bodyId,
      lane,
      trigger: input.trigger,
      tick: input.tick,
      stateHash: input.stateHash,
      startedAt,
      provider: deps.provider ?? null,
      request: { exchange: redacted.value, bytes: requestBytes, redactions: redacted.redactions },
      reservationId,
      reservationMicros: estimate,
      price,
      retryOf: input.retryOf ?? null,
      retryN: input.retryN ?? 0,
    });
  } catch (error) {
    deps.guard.voidReservation(input.agentId, reservationId);
    deps.guard.failClosed("attempt begin write failed");
    throw error;
  }

  // 4. The one and only paid path.
  let outcome: ReflexCallOutcome;
  try {
    outcome = await deps.backend.call(input.exchange);
  } catch (err) {
    outcome = {
      error: { kind: "unknown", message: err instanceof Error ? err.message : String(err) },
    };
  }

  // 5. Cost: reported usage if the provider gave it, else fail-closed
  //    estimate — errors included (a failed call may still have been billed).
  let cost: CostAttribution = { micros: estimate, basis: "estimated", price };
  try {
    const responseBytes = outcome.result ? utf8Bytes(JSON.stringify(outcome.result)) : 0;
    cost = costForOutcome(outcome.usage ?? null, requestBytes, responseBytes, price);
    if (cost.basis === "estimated") cost.micros = Math.max(estimate, cost.micros);

    // 6. Log end + settle.
    const endedAt = clock();
    const status = outcome.error ? (outcome.error.kind === "timeout" ? "timeout" : "error") : "ok";
    deps.log.end({
      type: "end",
      attemptId,
      endedAt,
      status,
      response: outcome.result
        ? {
            answers: outcome.result.answers,
            raw: outcome.raw ?? null,
            action: digestAnswers(outcome.result.answers),
          }
        : null,
      error: outcome.error ?? null,
      usage: outcome.usage ?? null,
      cost,
      latencyMs: endedAt - startedAt,
    });

    return { attemptId, outcome, cost, latencyMs: endedAt - startedAt };
  } catch (error) {
    deps.guard.failClosed("attempt accounting or end write failed");
    throw error;
  } finally {
    deps.guard.settle(input.agentId, reservationId, cost.micros);
  }
}
