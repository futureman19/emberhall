/**
 * Spend report — per-agent, per-cost-day accounting derived from the
 * attempt log. This is the Phase 3 hard-gate measuring instrument:
 * "<= $0.50/agent/day, measured from the decision log."
 */
import { foldAttempts, type AttemptLine, type AttemptStatus, type FoldedAttempt } from "./attempts.ts";
import { DEFAULT_DAILY_CAP_MICROS } from "./budget.ts";
import { DEFAULT_PRICE, formatDollars, MICROS_PER_DOLLAR } from "./pricing.ts";

export interface AgentDayReport {
  agentId: string;
  /** UTC calendar day — the cost day, not the vale day. */
  day: string;
  attempts: number;
  byStatus: Record<AttemptStatus, number>;
  /** attempts with retryN > 0 (each retry is a separately billed attempt). */
  retries: number;
  promptTokensReported: number;
  completionTokensReported: number;
  /** attempts priced from payload estimates because usage was missing. */
  estimatedAttempts: number;
  spendMicros: number;
  avgLatencyMs: number | null;
  /** distinct price table ids that produced these numbers. */
  pricingBasis: string[];
  warnings: string[];
  /** gate verdict: spendMicros <= capMicros. */
  capMicros: number;
  withinCap: boolean;
}

export function buildSpendReport(
  lines: AttemptLine[],
  opts: { agentId?: string; day?: string; capMicros?: number } = {},
): AgentDayReport[] {
  const cap = opts.capMicros ?? DEFAULT_DAILY_CAP_MICROS;
  const folded = foldAttempts(lines, DEFAULT_PRICE).filter(
    (f) =>
      (opts.agentId === undefined || f.agentId === opts.agentId) &&
      (opts.day === undefined || f.day === opts.day),
  );
  const groups = new Map<string, FoldedAttempt[]>();
  for (const f of folded) {
    const key = `${f.agentId}${f.day}`;
    const g = groups.get(key) ?? [];
    g.push(f);
    groups.set(key, g);
  }
  const rows: AgentDayReport[] = [];
  for (const g of groups.values()) {
    const byStatus: Record<AttemptStatus, number> = {
      ok: 0,
      error: 0,
      timeout: 0,
      blocked: 0,
      interrupted: 0,
    };
    let prompt = 0;
    let completion = 0;
    let estimated = 0;
    let spend = 0;
    let retries = 0;
    let latencySum = 0;
    let latencyN = 0;
    const basis = new Set<string>();
    const warnings: string[] = [];
    for (const f of g) {
      byStatus[f.status] += 1;
      if (f.retryN > 0) retries += 1;
      if (f.usage) {
        prompt += f.usage.promptTokens;
        completion += f.usage.completionTokens;
      }
      if (f.cost.basis === "estimated") estimated += 1;
      spend += f.cost.micros;
      if (f.cost.price) basis.add(`${f.cost.price.tableId}@${f.cost.price.capturedAt}`);
      if (f.latencyMs !== null) {
        latencySum += f.latencyMs;
        latencyN += 1;
      }
      warnings.push(...f.warnings);
    }
    rows.push({
      agentId: g[0]!.agentId,
      day: g[0]!.day,
      attempts: g.length,
      byStatus,
      retries,
      promptTokensReported: prompt,
      completionTokensReported: completion,
      estimatedAttempts: estimated,
      spendMicros: spend,
      avgLatencyMs: latencyN > 0 ? Math.round(latencySum / latencyN) : null,
      pricingBasis: [...basis].sort(),
      warnings,
      capMicros: cap,
      withinCap: spend <= cap,
    });
  }
  rows.sort((a, b) => (a.day === b.day ? a.agentId.localeCompare(b.agentId) : a.day.localeCompare(b.day)));
  return rows;
}

/** Plain-text table for gate evidence — paste-ready, caveats included. */
export function formatSpendReport(rows: AgentDayReport[]): string {
  if (rows.length === 0) return "agent spend report: no attempts in range";
  const head = [
    "agent".padEnd(16),
    "cost-day".padEnd(10),
    "calls".padStart(6),
    "ok".padStart(5),
    "err".padStart(5),
    "t/o".padStart(5),
    "blk".padStart(5),
    "int".padStart(5),
    "retry".padStart(6),
    "est".padStart(5),
    "spend".padStart(12),
    "cap".padStart(8),
    "gate".padStart(6),
  ].join(" ");
  const lines = [head, "-".repeat(head.length)];
  for (const r of rows) {
    lines.push(
      [
        r.agentId.padEnd(16).slice(0, 16),
        r.day.padEnd(10),
        String(r.attempts).padStart(6),
        String(r.byStatus.ok).padStart(5),
        String(r.byStatus.error).padStart(5),
        String(r.byStatus.timeout).padStart(5),
        String(r.byStatus.blocked).padStart(5),
        String(r.byStatus.interrupted).padStart(5),
        String(r.retries).padStart(6),
        String(r.estimatedAttempts).padStart(5),
        formatDollars(r.spendMicros).padStart(12),
        formatDollars(r.capMicros).padStart(8),
        (r.withinCap ? "PASS" : "FAIL").padStart(6),
      ].join(" "),
    );
  }
  lines.push("-".repeat(head.length));
  lines.push(`cost-day = UTC calendar day (wall clock), distinct from the vale's sim day.`);
  lines.push(`est = attempts priced from payload-size estimates because the provider did not report usage`);
  lines.push(`      (never silently $0 — see pricing.ts MISSING_USAGE_MULTIPLIER).`);
  lines.push(`int = interrupted attempts (begin with no end), charged a conservative estimate.`);
  const bases = [...new Set(rows.flatMap((r) => r.pricingBasis))];
  lines.push(`pricing basis: ${bases.length ? bases.join(", ") : "none (no priced attempts)"}`);
  const warned = rows.filter((r) => r.warnings.length > 0);
  if (warned.length > 0) {
    lines.push(`warnings: ${warned.map((r) => `${r.agentId}/${r.day}: ${r.warnings.join("; ")}`).join(" | ")}`);
  }
  return lines.join("\n");
}

export function microsToDollars(micros: number): number {
  return micros / MICROS_PER_DOLLAR;
}
