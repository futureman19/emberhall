/**
 * TypeSafe Jev reflex backend — the day-one ReflexBackend.
 *
 * Speaks the TypeSafe System One HTTP API (`POST /v1/systemone`, Bearer auth,
 * see https://docs.typesafe.ai/api) and translates both directions:
 *   harness ReflexQuestion[]  → Jev question map (choice/score/noul)
 *   Jev answers               → harness ReflexAnswer[] via the contract's own
 *                               builders (normalize/topPick/clamp live in
 *                               reflex.ts — this file never re-implements them)
 *
 * Bounded failure: one decide() call makes at most `maxRetries + 1` attempts,
 * each capped by `timeoutMs`, with exponential backoff between attempts.
 * Client faults (400/401/403/404/422) are never retried — retrying a request
 * the provider has already rejected only burns tokens. Everything is recorded
 * in ReflexCallMeta for the DecisionLog lane, including failed attempts.
 *
 * Credentials: the API key rides the Authorization header only. It is never
 * written to errors, attempt metadata, or logs — every provider detail string
 * passes through sanitize() before it can leave this module.
 */
import { answerChoice, answerNoul, answerScore } from "./reflex.ts";
import type {
  ReflexAttemptMeta,
  ReflexAttemptOutcome,
  ReflexBackend,
  ReflexCallMeta,
  ReflexCallOutcome,
  ReflexUsage,
} from "./reflex-backend.ts";
import type {
  ReflexAnswer,
  ReflexExchange,
  ReflexQuestion,
} from "./types.ts";

export const JEV_PROVIDER = "typesafe-jev";
export const JEV_DEFAULT_BASE_URL = "https://api.typesafe.ai";
export const JEV_DEFAULT_MODEL = "jev-latest";
export const JEV_DEFAULT_TIMEOUT_MS = 8_000;
export const JEV_DEFAULT_MAX_RETRIES = 2;
export const JEV_DEFAULT_BACKOFF_MS = 250;
/** Serialized state is capped so one runaway observation cannot blow up cost. */
export const JEV_DEFAULT_MAX_STATE_BYTES = 32 * 1024;
/** Jev questions per request cap (harness-side; provider minimum is 1). */
export const JEV_DEFAULT_MAX_QUESTIONS = 64;
/** Never wait longer than this for one attempt, whatever the config says. */
export const JEV_MAX_TIMEOUT_MS = 60_000;
/** A Retry-After hint is honored only up to this bound. */
export const JEV_MAX_RETRY_AFTER_MS = 5_000;

export interface JevBackendConfig {
  /** Server-side bundled key. Required; sent as `Authorization: Bearer`. */
  apiKey: string;
  baseUrl?: string;
  model?: string;
  /** Per-attempt timeout, clamped to (0, JEV_MAX_TIMEOUT_MS]. */
  timeoutMs?: number;
  /** Retries after the first attempt (0 = single attempt). */
  maxRetries?: number;
  /** Base delay; attempt n waits backoffMs * 2^(n-1), unless Retry-After says less. */
  backoffMs?: number;
  /** Injectable for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable clock for metadata timestamps. Defaults to Date.now. */
  now?: () => number;
  /** Injectable backoff wait. Defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

export type JevEnv = Record<string, string | undefined>;

/**
 * Read backend config from a server environment. Returns null when no key is
 * provisioned — the caller decides whether reflexes are simply disabled for
 * this run (dev) or the absence is fatal (host). Never logs the key.
 */
export function jevConfigFromEnv(env: JevEnv): JevBackendConfig | null {
  const apiKey = env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) return null;
  const timeoutMs = Number(env.TYPESAFE_TIMEOUT_MS);
  const maxRetries = Number(env.TYPESAFE_MAX_RETRIES);
  return {
    apiKey,
    baseUrl: env.TYPESAFE_BASE_URL?.trim() || undefined,
    model: env.TYPESAFE_MODEL?.trim() || undefined,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined,
    maxRetries: Number.isInteger(maxRetries) && maxRetries >= 0 ? maxRetries : undefined,
  };
}

/* ── request translation ─────────────────────────────────────────────── */

type JevQuestion =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] }
  | { type: "noul"; instructions: string };

function toJevQuestion(q: ReflexQuestion): JevQuestion {
  switch (q.type) {
    case "choice":
      // The harness contract carries bare option strings; Jev wants a
      // criteria map. Option labels are self-describing on this wire (they
      // are the context-menu labels), so each option describes itself.
      return {
        type: "choice",
        instructions: q.question,
        criteria: Object.fromEntries(q.options.map((o) => [o, o])),
      };
    case "score":
      // Harness scores are 1-based (expectation = Σ p·(i+1)); Jev levels are
      // 0-based. Only probabilities cross the wire — the contract builder
      // owns expectation math, so the bases never mix.
      return {
        type: "score",
        instructions: q.question,
        criteria: Array.from({ length: q.levels }, (_, i) => `Level ${i + 1} of ${q.levels}`),
      };
    case "noul":
      return { type: "noul", instructions: q.question };
  }
}

/* ── exchange validation (no HTTP on failure) ────────────────────────── */

function validateExchange(
  exchange: ReflexExchange,
  maxQuestions: number,
  maxStateBytes: number,
): string | null {
  if (!exchange || typeof exchange !== "object") return "exchange is not an object";
  const qs = exchange.questions;
  if (!Array.isArray(qs) || qs.length === 0) return "exchange needs at least one question";
  if (qs.length > maxQuestions) return `exchange has ${qs.length} questions, max ${maxQuestions}`;
  const seen = new Set<string>();
  for (const q of qs) {
    if (!q || typeof q !== "object") return "question is not an object";
    if (typeof q.id !== "string" || q.id.length === 0) return "question id must be a non-empty string";
    if (seen.has(q.id)) return `duplicate question id: ${q.id}`;
    seen.add(q.id);
    if (typeof q.question !== "string" || q.question.length === 0) {
      return `question ${q.id}: question text must be a non-empty string`;
    }
    if (q.type === "choice") {
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 255) {
        return `question ${q.id}: choice needs 2..255 options`;
      }
      if (q.options.some((o) => typeof o !== "string" || o.length === 0)) {
        return `question ${q.id}: options must be non-empty strings`;
      }
      if (new Set(q.options).size !== q.options.length) {
        return `question ${q.id}: options must be unique`;
      }
    } else if (q.type === "score") {
      if (!Number.isInteger(q.levels) || q.levels < 2 || q.levels > 10) {
        return `question ${q.id}: score levels must be an integer 2..10`;
      }
    } else if (q.type !== "noul") {
      // Unreachable for well-typed callers; runtime validation still needs the
      // message, so read the id off the un-narrowed value.
      const bad = q as { id?: unknown; type?: unknown };
      return `question ${String(bad.id)}: unknown type ${String(bad.type)}`;
    }
  }
  let stateJson: string;
  try {
    stateJson = JSON.stringify(exchange.state ?? null);
  } catch {
    return "exchange state is not JSON-serializable";
  }
  if (stateJson.length > maxStateBytes) {
    return `exchange state is ${stateJson.length} bytes, max ${maxStateBytes}`;
  }
  return null;
}

/* ── response validation + translation ───────────────────────────────── */

class InvalidResponse extends Error {}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function requireFiniteProbability(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new InvalidResponse(`${label} is not a non-negative finite number`);
  }
  return value;
}

function translateAnswers(body: unknown, questions: ReflexQuestion[]): {
  answers: ReflexAnswer[];
  resolvedModel: string | null;
  usage: ReflexUsage | null;
} {
  if (!isRecord(body)) throw new InvalidResponse("response body is not an object");
  const answersById = body.answers;
  if (!isRecord(answersById)) throw new InvalidResponse("response has no answers object");

  let usage: ReflexUsage | null = null;
  if (isRecord(body.usage)) {
    const inTok = body.usage.input_tokens;
    const outTok = body.usage.output_tokens;
    if (typeof inTok === "number" && Number.isFinite(inTok) && inTok >= 0
        && typeof outTok === "number" && Number.isFinite(outTok) && outTok >= 0) {
      usage = { inputTokens: inTok, outputTokens: outTok };
    }
  }
  const resolvedModel = typeof body.model === "string" ? body.model : null;

  const answers: ReflexAnswer[] = questions.map((q) => {
    const a = answersById[q.id];
    if (!isRecord(a)) throw new InvalidResponse(`no answer for question ${q.id}`);
    if (a.type !== q.type) {
      throw new InvalidResponse(`question ${q.id}: answer type ${String(a.type)} ≠ question type ${q.type}`);
    }
    if (q.type === "choice") {
      if (typeof a.choice !== "string" || !q.options.includes(a.choice)) {
        throw new InvalidResponse(`question ${q.id}: picked option ${String(a.choice)} is not a candidate`);
      }
      const probs = a.probabilities;
      if (!isRecord(probs)) throw new InvalidResponse(`question ${q.id}: no probabilities`);
      const ps = q.options.map((o, i) =>
        requireFiniteProbability(probs[o], `question ${q.id} probability[${i}] (${o})`),
      );
      return answerChoice(q, ps);
    }
    if (q.type === "score") {
      const probs = a.probabilities;
      if (!isRecord(probs)) throw new InvalidResponse(`question ${q.id}: no probabilities`);
      const ps = Array.from({ length: q.levels }, (_, i) =>
        requireFiniteProbability(probs[String(i)], `question ${q.id} probability of level ${i}`),
      );
      return answerScore(q, ps);
    }
    return answerNoul(q, requireFiniteProbability(a.noul, `question ${q.id} noul`));
  });
  return { answers, resolvedModel, usage };
}

/* ── failure classification ──────────────────────────────────────────── */

const RETRYABLE_HTTP = new Set([408, 409, 425, 429]);

function retryableHttp(status: number): boolean {
  return RETRYABLE_HTTP.has(status) || status >= 500;
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
}

function sanitize(text: string, apiKey: string): string {
  let out = text;
  if (apiKey) out = out.split(apiKey).join("[redacted]");
  return out.length > 300 ? `${out.slice(0, 300)}…` : out;
}

function detailOf(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const d = body.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    const first = d[0];
    if (isRecord(first) && typeof first.msg === "string") {
      const loc = Array.isArray(first.loc) ? first.loc.join(".") : "";
      return loc ? `${first.msg} (${loc})` : first.msg;
    }
  }
  if (isRecord(d) && typeof d.message === "string") return d.message;
  return null;
}

/* ── the backend ─────────────────────────────────────────────────────── */

export function createJevBackend(config: JevBackendConfig): ReflexBackend {
  const apiKey = config.apiKey ?? "";
  const baseUrl = (config.baseUrl ?? JEV_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = config.model ?? JEV_DEFAULT_MODEL;
  const timeoutMs = Math.min(
    Math.max(1, config.timeoutMs ?? JEV_DEFAULT_TIMEOUT_MS),
    JEV_MAX_TIMEOUT_MS,
  );
  const maxRetries = Math.max(0, Math.floor(config.maxRetries ?? JEV_DEFAULT_MAX_RETRIES));
  const backoffMs = Math.max(0, config.backoffMs ?? JEV_DEFAULT_BACKOFF_MS);
  const fetchImpl = config.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const now = config.now ?? (() => Date.now());
  const sleep = config.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  function fail(
    kind: "config" | "invalid_request" | "provider_rejected" | "exhausted",
    message: string,
    startedMs: number,
    attempts: ReflexAttemptMeta[],
    usage: ReflexUsage | null,
    resolvedModel: string | null,
  ): ReflexCallOutcome {
    return {
      ok: false,
      error: { kind, message: sanitize(message, apiKey) },
      meta: {
        provider: JEV_PROVIDER,
        model,
        resolvedModel,
        attempts,
        latencyMs: Math.max(0, now() - startedMs),
        usage,
      },
    };
  }

  async function decide(exchange: ReflexExchange): Promise<ReflexCallOutcome> {
    const startedMs = now();
    const attempts: ReflexAttemptMeta[] = [];

    if (!apiKey.trim()) {
      return fail("config", "no API key configured (set TYPESAFE_API_KEY on the host)", startedMs, attempts, null, null);
    }
    if (typeof fetchImpl !== "function") {
      return fail("config", "no fetch implementation available on this runtime", startedMs, attempts, null, null);
    }
    const invalid = validateExchange(
      exchange,
      JEV_DEFAULT_MAX_QUESTIONS,
      JEV_DEFAULT_MAX_STATE_BYTES,
    );
    if (invalid) return fail("invalid_request", invalid, startedMs, attempts, null, null);

    const payload = JSON.stringify({
      model,
      state: exchange.state ?? null,
      questions: Object.fromEntries(exchange.questions.map((q) => [q.id, toJevQuestion(q)])),
    });

    let lastUsage: ReflexUsage | null = null;
    let resolvedModel: string | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const attemptStart = now();
      const record = (
        outcome: ReflexAttemptOutcome,
        httpStatus: number | null,
        usage: ReflexUsage | null,
        error: string | null,
      ): ReflexAttemptMeta => {
        const meta: ReflexAttemptMeta = {
          attempt,
          startedAtMs: attemptStart,
          latencyMs: Math.max(0, now() - attemptStart),
          outcome,
          httpStatus,
          usage,
          error: error === null ? null : sanitize(error, apiKey),
        };
        attempts.push(meta);
        return meta;
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let retryAfterMs: number | null = null;
      try {
        const res = await fetchImpl(`${baseUrl}/v1/systemone`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: payload,
          signal: controller.signal,
        });
        const text = await res.text();
        let body: unknown = null;
        if (text) {
          try {
            body = JSON.parse(text);
          } catch {
            body = null;
          }
        }
        if (!res.ok) {
          const detail = detailOf(body) ?? (text ? text.slice(0, 200) : null);
          const errMsg = `HTTP ${res.status}${detail ? `: ${detail}` : ""}`;
          const ra = res.headers.get("retry-after");
          if (ra !== null) {
            const secs = Number(ra);
            if (Number.isFinite(secs) && secs >= 0) retryAfterMs = Math.min(secs * 1000, JEV_MAX_RETRY_AFTER_MS);
          }
          if (isRecord(body) && isRecord(body.usage)) {
            const u = body.usage;
            if (typeof u.input_tokens === "number" && typeof u.output_tokens === "number") {
              lastUsage = { inputTokens: u.input_tokens, outputTokens: u.output_tokens };
            }
          }
          record("http_error", res.status, lastUsage, errMsg);
          if (!retryableHttp(res.status)) {
            return fail("provider_rejected", `provider rejected the request (${errMsg})`, startedMs, attempts, lastUsage, resolvedModel);
          }
        } else {
          try {
            const translated = translateAnswers(body, exchange.questions);
            resolvedModel = translated.resolvedModel;
            lastUsage = translated.usage;
            record("ok", res.status, translated.usage, null);
            return {
              ok: true,
              result: { answers: translated.answers },
              meta: {
                provider: JEV_PROVIDER,
                model,
                resolvedModel,
                attempts,
                latencyMs: Math.max(0, now() - startedMs),
                usage: translated.usage,
              },
            };
          } catch (err) {
            if (isRecord(body) && isRecord(body.usage)) {
              const u = body.usage;
              if (typeof u.input_tokens === "number" && typeof u.output_tokens === "number") {
                lastUsage = { inputTokens: u.input_tokens, outputTokens: u.output_tokens };
              }
            }
            record(
              "invalid_response",
              res.status,
              lastUsage,
              err instanceof Error ? err.message : "invalid response",
            );
          }
        }
      } catch (err) {
        if (isAbort(err)) {
          record("timeout", null, null, `no response within ${timeoutMs}ms`);
        } else {
          record("network_error", null, null, err instanceof Error ? err.message : "fetch failed");
        }
      } finally {
        clearTimeout(timer);
      }

      if (attempt <= maxRetries) {
        const wait = retryAfterMs ?? backoffMs * 2 ** (attempt - 1);
        if (wait > 0) await sleep(wait);
      }
    }

    const last = attempts[attempts.length - 1];
    return fail(
      "exhausted",
      `giving up after ${attempts.length} attempts (last: ${last?.outcome ?? "none"})`,
      startedMs,
      attempts,
      lastUsage,
      resolvedModel,
    );
  }

  return { provider: JEV_PROVIDER, decide };
}
