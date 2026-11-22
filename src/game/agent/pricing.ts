/**
 * Pricing table + cost math for provider-call accounting.
 *
 * Money is integer micro-USD ("micros"): 1_000_000 micros = $1.00. Never a
 * float — floats smear fractions of a cent and a cost gate that can leak is
 * not a gate.
 *
 * Identity worth remembering: a price quoted in $/Mtok (dollars per million
 * tokens) is NUMERICALLY EQUAL to micros per token ($0.042/Mtok = 0.042
 * micros/token), so `micros = tokens * pricePerMTok` exactly.
 *
 * Cost days are UTC calendar days (see budget.ts) and have nothing to do
 * with the vale's in-simulation day/night cycle.
 */

export const MICROS_PER_DOLLAR = 1_000_000;

export interface PriceProvenance {
  /** Stable id used in logs/reports, e.g. "typesafe-jev". */
  tableId: string;
  /** Provider-side model identifier, e.g. "jev-1.14.0". */
  model: string;
  currency: "USD";
  /** $ per 1M input (prompt) tokens == micros per input token. */
  promptPerMTok: number;
  /** $ per 1M output (completion) tokens == micros per output token. */
  completionPerMTok: number;
  /** Where the numbers came from (URL + doc name). */
  source: string;
  /** ISO date the price was recorded from the source. */
  capturedAt: string;
  /** Free-text caveats (rate limits, tiering, unverified terms). */
  notes: string;
}

/**
 * The day-one backend price. Jev bills INPUT tokens only; output is free.
 * Verified 2026-11-21 against the public rate card. If the vendor reprices,
 * update the table — every logged attempt carries its own price snapshot, so
 * historical rows keep the price that was true when they ran.
 */
export const PRICES: Record<string, PriceProvenance> = {
  "typesafe-jev": {
    tableId: "typesafe-jev",
    model: "jev-1.14.0",
    currency: "USD",
    promptPerMTok: 0.042,
    completionPerMTok: 0,
    source: "https://docs.typesafe.ai/models rate card ($0.042/Mtok input, output free)",
    capturedAt: "2026-11-21",
    notes:
      "Org-level rate limits (tokens/s + requests/s, 429 + retry-after). Volume tiers " +
      "($0.25/Mtok on large prepaid packs) exist but are NOT assumed here — the guard " +
      "prices at the headline rate, which can only overestimate spend.",
  },
};

export const DEFAULT_PRICE: PriceProvenance = PRICES["typesafe-jev"]!;

export interface UsageReport {
  promptTokens: number;
  completionTokens: number;
}

/** Conservative token estimate from serialized payload bytes. BPE averages
 *  ~4 chars/token on prose but JSON keys, digits and punctuation tokenize
 *  denser; /3 errs on the high side, which is the fail-closed direction for
 *  a cost gate. Non-empty payloads never estimate to zero. */
export function estimateTokens(bytes: number): number {
  if (bytes <= 0) return 0;
  return Math.max(1, Math.ceil(bytes / 3));
}

/** Exact cost for a provider-reported usage row. Rounds UP — a cost gate
 *  never rounds down. */
export function microsForUsage(usage: UsageReport, price: PriceProvenance): number {
  return Math.ceil(
    usage.promptTokens * price.promptPerMTok + usage.completionTokens * price.completionPerMTok,
  );
}

/**
 * Multiplier applied when the provider did NOT report usage and we must
 * estimate from payload sizes. Estimation error must never read as free
 * compute, so unreported usage is priced at 1.5x the payload estimate.
 */
export const MISSING_USAGE_MULTIPLIER = 1.5;

/** Cost when usage is missing: estimate from payload bytes, fail closed. */
export function microsForEstimatedUsage(
  requestBytes: number,
  responseBytes: number,
  price: PriceProvenance,
): number {
  const usage: UsageReport = {
    promptTokens: estimateTokens(requestBytes),
    completionTokens: estimateTokens(responseBytes),
  };
  return Math.ceil(microsForUsage(usage, price) * MISSING_USAGE_MULTIPLIER);
}

/**
 * Reservation estimate computed BEFORE the call exists. Conservative by
 * construction: prompt tokens estimated from request bytes with margin and
 * a floor, plus a fixed completion allowance. The reservation is what the
 * budget guard holds against the cap; settling replaces it with the actual
 * (reported or estimated) cost.
 */
export const RESERVE_COMPLETION_TOKENS = 256;
export const RESERVE_MARGIN = 1.25;
export const RESERVE_PROMPT_FLOOR_TOKENS = 64;

export function microsForReservation(requestBytes: number, price: PriceProvenance): number {
  const promptTokens =
    Math.ceil(estimateTokens(requestBytes) * RESERVE_MARGIN) + RESERVE_PROMPT_FLOOR_TOKENS;
  return Math.ceil(
    promptTokens * price.promptPerMTok + RESERVE_COMPLETION_TOKENS * price.completionPerMTok,
  );
}

export function formatDollars(micros: number): string {
  return `$${(micros / MICROS_PER_DOLLAR).toFixed(6).replace(/0+$/, "").replace(/\.$/, ".0")}`;
}
