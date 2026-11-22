/**
 * Reflex backend seam — the pluggable interface between the harness contract
 * (`src/game/agent/types.ts` ReflexExchange/ReflexResult) and whatever answers
 * it (TypeSafe Jev API day one, self-hosted Emberhall Reflex v1 later).
 *
 * The contract files stay pure and synchronous; backends are async and live
 * behind this interface. Implementations MUST be total: `decide` resolves a
 * ReflexCallOutcome for every expected failure (timeout, provider error,
 * invalid response) instead of rejecting, so the scheduler lane can log
 * every attempt without a try/catch around provider flakiness.
 *
 * Accounting: every HTTP attempt — success, failure, or retry — appends a
 * ReflexAttemptMeta with latency and (when the provider reported it) token
 * usage. `usage: null` means "the provider did not say", which a cost lane
 * must treat as unknown, never as free.
 */
import type { ReflexExchange, ReflexResult } from "./types.ts";

/** Billable accounting for one evaluation, as reported by the provider. */
export interface ReflexUsage {
  inputTokens: number;
  outputTokens: number;
}

export type ReflexAttemptOutcome =
  | "ok"
  | "timeout"
  | "network_error"
  | "http_error"
  | "invalid_response";

export interface ReflexAttemptMeta {
  /** 1-based attempt ordinal within one decide() call. */
  attempt: number;
  /** Wall-clock start of this attempt, from the backend's injected clock. */
  startedAtMs: number;
  latencyMs: number;
  outcome: ReflexAttemptOutcome;
  /** HTTP status when a response arrived, else null. */
  httpStatus: number | null;
  /** Provider-reported usage, including on failed attempts when the provider
   *  still consumed tokens. Null = unknown — never zero-filled. */
  usage: ReflexUsage | null;
  /** One-line sanitized reason. Never carries credentials or request bodies. */
  error: string | null;
}

export type ReflexCallErrorKind =
  /** Backend misconfigured (e.g. no API key). No HTTP was attempted. */
  | "config"
  /** The exchange itself failed validation. No HTTP was attempted. */
  | "invalid_request"
  /** The provider rejected the request outright (4xx); retrying would just
   *  burn tokens, so exactly one attempt was made. */
  | "provider_rejected"
  /** Bounded retries exhausted; every attempt is in meta.attempts. */
  | "exhausted";

export interface ReflexCallError {
  kind: ReflexCallErrorKind;
  /** Sanitized, credential-free, log-safe. */
  message: string;
}

export interface ReflexCallMeta {
  /** Backend identity, e.g. "typesafe-jev". */
  provider: string;
  /** Model requested. */
  model: string;
  /** Model that actually answered (provider-reported), when known. */
  resolvedModel: string | null;
  /** Every HTTP attempt in order, including retries and failures. */
  attempts: ReflexAttemptMeta[];
  /** Total wall-clock across attempts and backoff waits. */
  latencyMs: number;
  /** Usage of the successful attempt, else the last usage the provider
   *  reported, else null (unknown — not free). */
  usage: ReflexUsage | null;
}

export type ReflexCallOutcome =
  | { ok: true; result: ReflexResult; meta: ReflexCallMeta }
  | { ok: false; error: ReflexCallError; meta: ReflexCallMeta };

export interface ReflexBackend {
  readonly provider: string;
  /**
   * Decide one exchange. Resolves for every expected failure mode; a
   * rejected promise signals a bug in the backend itself, not the provider.
   */
  decide(exchange: ReflexExchange): Promise<ReflexCallOutcome>;
}
