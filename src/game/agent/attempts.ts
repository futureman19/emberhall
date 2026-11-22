/**
 * Provider-attempt log — the durable cost record for Phase 3.
 *
 * ONE provider call attempt = ONE begin line + ONE end line on an
 * append-only JSONL stream. A begin with no end is an INTERRUPTED attempt:
 * it stays visible forever and is charged a conservative estimate (a crash
 * between send and response may still have been billed).
 *
 * This complements, not replaces, the contract's training DecisionLogRow
 * (log.ts): that row records (state, candidates, answer, outcome) for
 * learning; THIS log records every attempt — failures, retries, blocked
 * calls, interruptions — with usage, pricing provenance and attributable
 * cost. Successful attempts can emit both.
 *
 * Redaction: credentials must never reach the stream. Everything persisted
 * goes through redactForLog(); secret-shaped keys and token-shaped string
 * values are replaced with "[REDACTED]" and counted.
 */
import type { ReflexAnswer, ReflexExchange } from "./types.ts";
import {
  assertAmount,
  validUsage,
  validatePrice,
  microsForReservation,
  microsForEstimatedUsage,
  microsForUsage,
  type PriceProvenance,
  type UsageReport,
} from "./pricing.ts";

export type { PriceProvenance, UsageReport } from "./pricing.ts";

/** reported = provider usage row; estimated = payload-size fallback; none = no call sent. */
export type CostBasis = "reported" | "estimated" | "none";

export type AttemptLane = "reflex" | "mind";

/** blocked = never sent (budget denied — true $0). interrupted is DERIVED
 *  at fold time: a begin whose end never landed. */
export type AttemptStatus = "ok" | "error" | "timeout" | "blocked" | "interrupted";
export type EndStatus = Exclude<AttemptStatus, "interrupted">;

export interface TriggerInfo {
  /** What woke the reflex (e.g. "hp-drop", "danger", "hunger", "heartbeat"). */
  kind: string;
  /** Human/log-readable specifics, e.g. "hp 41 -> 33". */
  detail: string;
}

export interface CostAttribution {
  micros: number;
  /** reported = provider usage; estimated = payload-size fallback; none = no call. */
  basis: CostBasis;
  /** The exact price applied — pricing provenance travels with the row. */
  price: PriceProvenance | null;
}

export interface AttemptBegin {
  type: "begin";
  attemptId: string;
  /** The agent (owner-side identity) paying for the call. */
  agentId: string;
  /** The vale body the decision is for. */
  bodyId: string;
  lane: AttemptLane;
  trigger: TriggerInfo;
  /** Vale tick at decision time — context only, NEVER the cost clock. */
  tick: number;
  stateHash: string;
  /** Wall-clock ms epoch. The cost clock. */
  startedAt: number;
  provider: { name: string; model: string } | null;
  /** The redacted request payload, in full — replay needs the real inputs. */
  request: { exchange: unknown; bytes: number; redactions: number };
  reservationId: string | null;
  /** Optional only for legacy logs. New begins retain the original hold and tariff. */
  reservationMicros?: number;
  price?: PriceProvenance;
  /** Retry linkage: first attempt has retryOf null / retryN 0. */
  retryOf: string | null;
  retryN: number;
}

export interface AttemptEnd {
  type: "end";
  attemptId: string;
  endedAt: number;
  status: EndStatus;
  /** Normalized answers + (when the backend provides it) the raw
   *  pre-normalization probabilities for strict replay. */
  response: { answers: ReflexAnswer[] | null; raw: unknown; action: string | null } | null;
  error: { kind: string; message: string } | null;
  usage: UsageReport | null;
  cost: CostAttribution;
  latencyMs: number;
}

export type AttemptLine = AttemptBegin | AttemptEnd;

/* ── Redaction ─────────────────────────────────────────────────────── */

export const REDACTED = "[REDACTED]";

const SECRET_KEY =
  /^(authorization|proxy-authorization|x-api-key|api[-_]?key|access[-_]?token|auth[-_]?token|token|secret|password|passwd|bearer|credential|private[-_]?key)$/i;
const SECRET_VALUE = /(jv_live_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+)/g;

/**
 * Deep-copy a payload for the log with credentials stripped. Key names that
 * look secret-bearing are replaced outright; string values containing token
 * shapes are masked. Returns the copy plus a redaction count — a nonzero
 * count means the caller handed us something it should not have, and the
 * begin row will say so.
 */
export function redactForLog(value: unknown): { value: unknown; redactions: number } {
  let redactions = 0;
  const walk = (v: unknown, insideSecret: boolean): unknown => {
    if (insideSecret) return REDACTED;
    if (typeof v === "string") {
      if (SECRET_VALUE.test(v)) {
        redactions += 1;
        return v.replace(SECRET_VALUE, REDACTED);
      }
      return v;
    }
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map((x) => walk(x, false));
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) {
        redactions += 1;
        out[k] = walk(x, true);
      } else {
        out[k] = walk(x, false);
      }
    }
    return out;
  };
  const redacted = walk(value, false);
  return { value: redacted, redactions };
}

/** UTF-8 byte length without node:buffer (shared module, browser-safe). */
const encoder = new TextEncoder();
export function utf8Bytes(s: string): number {
  return encoder.encode(s).length;
}

/* ── The log ───────────────────────────────────────────────────────── */

export interface AttemptLog {
  begin(rec: AttemptBegin): void;
  end(rec: AttemptEnd): void;
  lines(): AttemptLine[];
  toJSONL(): string;
}

let seq = 0;
/** Unique-enough attempt ids: time-ordered, collision-safe within a process. */
export function newAttemptId(now: number = Date.now()): string {
  seq = (seq + 1) % 0xffff;
  return `a${now.toString(36)}-${seq.toString(36).padStart(3, "0")}-${Math.floor(
    Math.random() * 0xffff,
  ).toString(36)}`;
}

/** In-memory log, optionally mirroring every line to a sink (file writer). */
export function createAttemptLog(sink?: (line: AttemptLine) => void): AttemptLog {
  const lines: AttemptLine[] = [];
  const push = (line: AttemptLine) => {
    sink?.(line);
    lines.push(line);
  };
  return {
    begin: (rec) => push(rec),
    end: (rec) => push(rec),
    lines: () => [...lines],
    toJSONL: () => lines.map((l) => JSON.stringify(l)).join("\n"),
  };
}

/** Strict JSONL parse — a corrupt log is an investigation, not a skip. */
export function parseAttemptLines(jsonl: string): AttemptLine[] {
  const out: AttemptLine[] = [];
  const rows = jsonl.split("\n");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.trim() === "") continue;
    try {
      const parsed = JSON.parse(row) as AttemptLine;
      if (parsed.type !== "begin" && parsed.type !== "end") {
        throw new Error(`unknown line type ${JSON.stringify((parsed as { type?: unknown }).type)}`);
      }
      out.push(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`attempt log line ${i + 1}: ${msg}`);
    }
  }
  return out;
}

/* ── Folding: begin+end pairs → one record per attempt ─────────────── */

export interface FoldedAttempt {
  attemptId: string;
  agentId: string;
  bodyId: string;
  lane: AttemptLane;
  trigger: TriggerInfo;
  tick: number;
  stateHash: string;
  startedAt: number;
  /** UTC calendar day of startedAt — the cost day. NOT the vale day. */
  day: string;
  endedAt: number | null;
  latencyMs: number | null;
  status: AttemptStatus;
  provider: { name: string; model: string } | null;
  request: { exchange: unknown; bytes: number; redactions: number };
  response: { answers: ReflexAnswer[] | null; raw: unknown; action: string | null } | null;
  error: { kind: string; message: string } | null;
  usage: UsageReport | null;
  cost: CostAttribution;
  reservationId: string | null;
  retryOf: string | null;
  retryN: number;
  /** Structural anomalies worth a human eye (duplicate end, orphan end). */
  warnings: string[];
}

export function costDayOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Join the append-only stream into per-attempt records. Begins without ends
 * become status "interrupted" and are charged a conservative payload-size
 * estimate at `price` — interrupted work is never silently free. Orphan ends
 * (no begin) surface as their own warning rows rather than vanishing.
 */
export function foldAttempts(lines: AttemptLine[], price: PriceProvenance): FoldedAttempt[] {
  const byId = new Map<string, FoldedAttempt>();
  const order: FoldedAttempt[] = [];
  for (const line of lines) {
    if (line.type === "begin") {
      const originalPrice = line.price === undefined ? price : line.price;
      validatePrice(originalPrice);
      if (line.reservationMicros !== undefined)
        assertAmount(line.reservationMicros, "restored reservation");
      const hold =
        line.reservationMicros ?? microsForReservation(line.request.bytes, originalPrice);
      const row: FoldedAttempt = {
        attemptId: line.attemptId,
        agentId: line.agentId,
        bodyId: line.bodyId,
        lane: line.lane,
        trigger: line.trigger,
        tick: line.tick,
        stateHash: line.stateHash,
        startedAt: line.startedAt,
        day: costDayOf(line.startedAt),
        endedAt: null,
        latencyMs: null,
        status: "interrupted",
        provider: line.provider,
        request: line.request,
        response: null,
        error: null,
        usage: null,
        cost: {
          micros: Math.max(hold, microsForEstimatedUsage(line.request.bytes, 0, originalPrice)),
          basis: "estimated",
          price: originalPrice,
        },
        reservationId: line.reservationId,
        retryOf: line.retryOf,
        retryN: line.retryN,
        warnings: [],
      };
      byId.set(line.attemptId, row);
      order.push(row);
      continue;
    }
    assertAmount(line.cost.micros, "restored cost");
    if (line.cost.price !== null) validatePrice(line.cost.price);
    const row = byId.get(line.attemptId);
    if (!row) {
      // Orphan end: keep it visible instead of dropping it.
      const orphan: FoldedAttempt = {
        attemptId: line.attemptId,
        agentId: "unknown",
        bodyId: "unknown",
        lane: "reflex",
        trigger: { kind: "unknown", detail: "orphan end line (no begin)" },
        tick: 0,
        stateHash: "",
        startedAt: line.endedAt,
        day: costDayOf(line.endedAt),
        endedAt: line.endedAt,
        latencyMs: line.latencyMs,
        status: line.status,
        provider: null,
        request: { exchange: null, bytes: 0, redactions: 0 },
        response: line.response,
        error: line.error,
        usage: line.usage,
        cost: line.cost,
        reservationId: null,
        retryOf: null,
        retryN: 0,
        warnings: ["orphan end line: no matching begin"],
      };
      byId.set(line.attemptId, orphan);
      order.push(orphan);
      continue;
    }
    if (row.endedAt !== null) {
      row.warnings.push("duplicate end line: first end kept");
      continue;
    }
    row.endedAt = line.endedAt;
    row.latencyMs = line.latencyMs;
    row.status = line.status;
    row.response = line.response;
    row.error = line.error;
    row.usage = line.usage;
    row.cost = line.cost;
  }
  return order;
}

/* ── Cost settlement helpers (used by metering) ────────────────────── */

export function costForOutcome(
  usage: UsageReport | null | undefined,
  requestBytes: number,
  responseBytes: number,
  price: PriceProvenance,
): CostAttribution {
  if (validUsage(usage)) return { micros: microsForUsage(usage, price), basis: "reported", price };
  return {
    micros: microsForEstimatedUsage(requestBytes, responseBytes, price),
    basis: "estimated",
    price,
  };
}

export function blockedCost(): CostAttribution {
  // A blocked call was never sent — the only honest $0 in the system.
  return { micros: 0, basis: "none", price: null };
}

/** One-line digest of what the reflex decided, e.g. `next#2|danger?0.9100`. */
export function digestAnswers(answers: ReflexAnswer[]): string {
  return answers
    .map((a) => {
      if (a.type === "choice") return `${a.id}#${a.pick}`;
      if (a.type === "score") return `${a.id}~${a.expectation.toFixed(4)}`;
      return `${a.id}?${a.p.toFixed(4)}`;
    })
    .join("|");
}

export type { ReflexExchange };
