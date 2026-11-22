/**
 * Phase 3 cost-control suite: replay fidelity, failure/retry accounting,
 * concurrent budget checks, day boundaries, redaction, durability.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  createAttemptLog,
  foldAttempts,
  newAttemptId,
  parseAttemptLines,
  redactForLog,
  utf8Bytes,
  type AttemptBegin,
  type AttemptLine,
} from "./attempts.ts";
import { createJsonlAttemptLog, readAttemptLogFile } from "./attempts-file.ts";
import { BudgetGuard, DEFAULT_DAILY_CAP_MICROS } from "./budget.ts";
import {
  BudgetExceededError,
  callReflexMetered,
  type MeteredDeps,
  type ReflexBackend,
} from "./metering.ts";
import {
  DEFAULT_PRICE,
  estimateTokens,
  microsForEstimatedUsage,
  microsForReservation,
  microsForUsage,
  type PriceProvenance,
} from "./pricing.ts";
import { answerChoice, answerNoul, choice, noul } from "./reflex.ts";
import { replayAttempt, replayLog } from "./replay.ts";
import { buildSpendReport, formatSpendReport } from "./report.ts";
import type { ReflexExchange } from "./types.ts";

const DAY1 = Date.UTC(2026, 10, 21, 12, 0, 0); // 2026-11-21T12:00:00Z
const NEXT_Q = choice("next", "What now?", ["chop the tree", "walk to bank"]);
const DANGER_Q = noul("danger", "Am I in danger?");
const EXCHANGE: ReflexExchange = {
  state: { tick: 42, hp: 30 },
  questions: [NEXT_Q],
};

function meteredDeps(
  overrides: Partial<MeteredDeps> & { backend: ReflexBackend },
  cfg: { capMicros?: number; clock?: () => number } = {},
): { deps: MeteredDeps; log: ReturnType<typeof createAttemptLog>; guard: BudgetGuard } {
  const guard = new BudgetGuard({ dailyCapMicros: cfg.capMicros, clock: cfg.clock });
  const log = createAttemptLog();
  const deps: MeteredDeps = {
    guard,
    log,
    price: DEFAULT_PRICE,
    provider: { name: "typesafe", model: "jev-1.14.0" },
    clock: cfg.clock,
    ...overrides,
  };
  return { deps, log, guard };
}

const BASE_INPUT = {
  agentId: "agent-1",
  bodyId: "body-1",
  trigger: { kind: "hp-drop", detail: "hp 41 -> 33" },
  tick: 42,
  stateHash: "deadbeef",
  exchange: EXCHANGE,
};

test("budget guard blocks at the cap and settles against reservations", () => {
  const guard = new BudgetGuard({ dailyCapMicros: 500_000, clock: () => DAY1 });
  const r1 = guard.reserve("agent-1", 400_000);
  assert.equal(r1.ok, true);
  const r2 = guard.reserve("agent-1", 200_000);
  assert.equal(r2.ok, false, "400k committed + 200k requested must exceed the 500k cap");
  if (!r2.ok) assert.match(r2.reason, /daily cap/);

  if (r1.ok) guard.settle("agent-1", r1.reservationId, 350_000);
  let snap = guard.snapshot("agent-1");
  assert.equal(snap.spentMicros, 350_000);
  assert.equal(snap.reservedMicros, 0);

  const r3 = guard.reserve("agent-1", 150_000);
  assert.equal(r3.ok, true, "350k spent + 150k = cap exactly is allowed");
  const r4 = guard.reserve("agent-1", 1);
  assert.equal(r4.ok, false, "one micro over the cap refuses");
  if (r3.ok) guard.voidReservation("agent-1", r3.reservationId);
  snap = guard.snapshot("agent-1");
  assert.equal(snap.reservedMicros, 0, "voided reservation frees its hold");
});

test("concurrent metered calls can never oversubscribe the day cap", async () => {
  // Price $10/Mtok so a handful of tokens is gate-visible, then size the cap
  // from the REAL reservation estimate: cap admits exactly 2 of 10 calls.
  const dear: PriceProvenance = { ...DEFAULT_PRICE, tableId: "dear-test", promptPerMTok: 10 };
  const exchange: ReflexExchange = { state: "x".repeat(300), questions: [NEXT_Q] };
  const per = microsForReservation(utf8Bytes(JSON.stringify(exchange)), dear);
  const cap = 2 * per + 1; // two fit, the third never does

  let backendCalls = 0;
  const backend: ReflexBackend = {
    call: async () => {
      backendCalls += 1;
      await new Promise((r) => setTimeout(r, 1));
      return {
        result: { answers: [answerChoice(NEXT_Q, [3, 7])] },
        usage: { promptTokens: 100, completionTokens: 0 },
      };
    },
  };
  const { deps, log } = meteredDeps({ backend, price: dear }, { capMicros: cap, clock: () => DAY1 });

  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () => callReflexMetered(deps, { ...BASE_INPUT, exchange })),
  );
  const ok = results.filter((r) => r.status === "fulfilled");
  const denied = results.filter((r) => r.status === "rejected");
  assert.equal(ok.length, 2, "the cap admits exactly the calls that fit, no more");
  assert.equal(denied.length, 8);
  assert.equal(backendCalls, 2, "denied calls never reach the provider");
  for (const d of denied) {
    assert.ok(d.reason instanceof BudgetExceededError);
    assert.equal(d.reason.code, "BUDGET_EXCEEDED");
  }
  const folded = foldAttempts(log.lines(), DEFAULT_PRICE);
  assert.equal(folded.length, 10, "blocked attempts are logged too");
  assert.equal(folded.filter((f) => f.status === "blocked").length, 8);
  const spent = folded.reduce((s, f) => s + f.cost.micros, 0);
  assert.equal(spent, 2_000, "settled spend is 2 x 100 reported tokens x 10 micros");
  assert.ok(spent <= cap);
});

test("cost day is the UTC calendar day, not the vale day", async () => {
  let now = Date.UTC(2026, 10, 21, 23, 59, 50);
  const backend: ReflexBackend = {
    call: async () => ({
      result: { answers: [answerNoul(DANGER_Q, 0.9)] },
      usage: { promptTokens: 1000, completionTokens: 0 },
    }),
  };
  const { deps, log, guard } = meteredDeps({ backend }, { clock: () => now });
  const exchange: ReflexExchange = { state: {}, questions: [DANGER_Q] };

  await callReflexMetered(deps, { ...BASE_INPUT, tick: 42, exchange });
  assert.equal(guard.snapshot("agent-1").spentMicros, 42);

  // Same vale tick, eleven wall-clock seconds later, across UTC midnight.
  now = Date.UTC(2026, 10, 22, 0, 0, 1);
  await callReflexMetered(deps, { ...BASE_INPUT, tick: 42, exchange });

  const folded = foldAttempts(log.lines(), DEFAULT_PRICE);
  assert.deepEqual(
    folded.map((f) => f.day),
    ["2026-11-21", "2026-11-22"],
    "same vale tick, different cost days",
  );
  assert.ok(folded.every((f) => f.tick === 42), "vale tick is context, never the cost clock");
  const report = buildSpendReport(log.lines());
  assert.equal(report.length, 2);
  assert.equal(report[0]!.day, "2026-11-21");
  assert.equal(report[1]!.day, "2026-11-22");
  assert.equal(report[0]!.spendMicros, 42);
  assert.equal(report[1]!.spendMicros, 42);
  // A rebuilt guard (post-restart) sees both day buckets from the log.
  const rebuilt = BudgetGuard.fromAttempts(folded, { clock: () => now });
  assert.equal(rebuilt.snapshot("agent-1", "2026-11-21").spentMicros, 42);
  assert.equal(rebuilt.snapshot("agent-1", "2026-11-22").spentMicros, 42);
});

test("failures are logged, charged, and retries account separately", async () => {
  let calls = 0;
  const backend: ReflexBackend = {
    call: async () => {
      calls += 1;
      if (calls === 1) return { error: { kind: "http" as const, message: "502 bad gateway" } };
      return {
        result: { answers: [answerChoice(NEXT_Q, [1, 9])] },
        raw: { next: [1, 9] },
        usage: { promptTokens: 2000, completionTokens: 0 },
      };
    },
  };
  const { deps, log, guard } = meteredDeps({ backend }, { clock: () => DAY1 });

  const first = await callReflexMetered(deps, BASE_INPUT);
  assert.equal(first.outcome.error?.kind, "http");
  const second = await callReflexMetered(deps, { ...BASE_INPUT, retryOf: first.attemptId, retryN: 1 });
  assert.equal(second.outcome.error, undefined);

  const folded = foldAttempts(log.lines(), DEFAULT_PRICE);
  assert.equal(folded.length, 2);
  assert.equal(folded[0]!.status, "error");
  assert.ok(folded[0]!.cost.micros > 0, "a failed provider call still costs");
  assert.equal(folded[0]!.cost.basis, "estimated", "no usage on failure => fail-closed estimate");
  assert.equal(folded[1]!.status, "ok");
  assert.equal(folded[1]!.retryOf, first.attemptId);
  assert.equal(folded[1]!.retryN, 1);
  assert.equal(folded[1]!.cost.micros, 84, "2000 tokens x 0.042 micros");

  const spent = folded.reduce((s, f) => s + f.cost.micros, 0);
  assert.equal(guard.snapshot("agent-1").spentMicros, spent, "guard settled both attempts");
  const report = buildSpendReport(log.lines());
  assert.equal(report[0]!.retries, 1);
  assert.equal(report[0]!.attempts, 2);
  assert.equal(report[0]!.spendMicros, spent, "retry spend is additive, never deduped");
});

test("interrupted attempts stay visible and are never free", () => {
  const begin: AttemptBegin = {
    type: "begin",
    attemptId: newAttemptId(DAY1),
    agentId: "agent-1",
    bodyId: "body-1",
    lane: "reflex",
    trigger: { kind: "danger", detail: "wolf adjacent" },
    tick: 7,
    stateHash: "cafe",
    startedAt: DAY1,
    provider: { name: "typesafe", model: "jev-1.14.0" },
    request: { exchange: EXCHANGE, bytes: 1200, redactions: 0 },
    reservationId: null,
    retryOf: null,
    retryN: 0,
  };
  const log = createAttemptLog();
  log.begin(begin); // process dies before end lands

  const folded = foldAttempts(log.lines(), DEFAULT_PRICE);
  assert.equal(folded.length, 1);
  assert.equal(folded[0]!.status, "interrupted");
  assert.equal(folded[0]!.cost.basis, "estimated");
  assert.ok(folded[0]!.cost.micros > 0, "interrupted != free");

  const rebuilt = BudgetGuard.fromAttempts(folded, { clock: () => DAY1 });
  assert.equal(
    rebuilt.snapshot("agent-1").spentMicros,
    folded[0]!.cost.micros,
    "a restarted guard re-charges the interrupted attempt from the log",
  );
  const report = buildSpendReport(log.lines());
  assert.equal(report[0]!.byStatus.interrupted, 1);
});

test("missing usage on a successful call is estimated, never zero", async () => {
  const backend: ReflexBackend = {
    call: async () => ({
      result: { answers: [answerNoul(DANGER_Q, 0.5)] },
      // no usage field at all — provider forgot to report
    }),
  };
  const { deps, log } = meteredDeps({ backend }, { clock: () => DAY1 });
  const exchange: ReflexExchange = { state: { big: "x".repeat(600) }, questions: [DANGER_Q] };
  const r = await callReflexMetered(deps, { ...BASE_INPUT, exchange });
  assert.equal(r.cost.basis, "estimated");
  assert.ok(r.cost.micros > 0, "unreported usage must not read as free");
  const folded = foldAttempts(log.lines(), DEFAULT_PRICE);
  assert.equal(folded[0]!.cost.basis, "estimated");
  assert.equal(buildSpendReport(log.lines())[0]!.estimatedAttempts, 1);
});

test("strict replay re-derives decisions; tampering is detected", async () => {
  const exchange: ReflexExchange = { state: { tick: 9 }, questions: [NEXT_Q] };
  const backend: ReflexBackend = {
    call: async () => ({
      result: { answers: [answerChoice(NEXT_Q, [4, 6])] },
      raw: { next: [4, 6] },
      usage: { promptTokens: 500, completionTokens: 0 },
    }),
  };
  const { deps, log } = meteredDeps({ backend }, { clock: () => DAY1 });
  await callReflexMetered(deps, { ...BASE_INPUT, exchange });

  const summary = replayLog(log.lines());
  assert.equal(summary.paidCallsIssued, 0, "replay issues no provider calls, by construction");
  assert.equal(summary.replayed, 1);
  assert.equal(summary.matched, 1);
  assert.equal(summary.mismatches.length, 0);

  const folded = foldAttempts(log.lines(), DEFAULT_PRICE);
  const verdict = replayAttempt(folded[0]!);
  assert.equal(verdict.level, "strict");
  assert.equal(verdict.action, "next#1", "re-derived pick is option 1 (6 > 4)");
  assert.equal(verdict.match, true);

  // Tamper with the recorded answer: flip the pick. Replay must catch it.
  const tampered: AttemptLine[] = log.lines().map((l) => {
    if (l.type === "end" && l.response?.answers?.[0]) {
      const copy = structuredClone(l);
      (copy.response!.answers![0] as { pick: number }).pick = 0;
      return copy;
    }
    return l;
  });
  const bad = replayLog(tampered);
  assert.equal(bad.matched, 0);
  assert.equal(bad.mismatches.length, 1);
  assert.ok(
    bad.mismatches[0]!.problems.some((p) => p.includes("differ") || p.includes("digest")),
    "tamper produces a concrete mismatch problem",
  );
});

test("shallow replay validates structure when raw probabilities are absent", async () => {
  const backend: ReflexBackend = {
    call: async () => ({
      result: { answers: [answerChoice(NEXT_Q, [4, 6])] },
      usage: { promptTokens: 500, completionTokens: 0 },
      // no raw — shallow level
    }),
  };
  const { deps, log } = meteredDeps({ backend }, { clock: () => DAY1 });
  await callReflexMetered(deps, BASE_INPUT);

  const folded = foldAttempts(log.lines(), DEFAULT_PRICE);
  const verdict = replayAttempt(folded[0]!);
  assert.equal(verdict.level, "shallow");
  assert.equal(verdict.match, true);
  assert.equal(verdict.action, "next#1");

  // Non-ok attempts are not replayable but never crash the pass.
  const errBackend: ReflexBackend = {
    call: async () => ({ error: { kind: "timeout" as const, message: "t/o" } }),
  };
  const d2 = meteredDeps({ backend: errBackend }, { clock: () => DAY1 });
  await callReflexMetered(d2.deps, BASE_INPUT);
  const v2 = replayAttempt(foldAttempts(d2.log.lines(), DEFAULT_PRICE)[0]!);
  assert.equal(v2.replayed, false);
  assert.equal(v2.status, "timeout");
});

test("blocked attempts log an honest $0 and the backend is never called", async () => {
  let backendCalls = 0;
  const backend: ReflexBackend = {
    call: async () => {
      backendCalls += 1;
      return { result: { answers: [] }, usage: { promptTokens: 1, completionTokens: 0 } };
    },
  };
  const { deps, log } = meteredDeps({ backend }, { capMicros: 1, clock: () => DAY1 });
  await assert.rejects(callReflexMetered(deps, BASE_INPUT), BudgetExceededError);
  assert.equal(backendCalls, 0);
  const folded = foldAttempts(log.lines(), DEFAULT_PRICE);
  assert.equal(folded.length, 1);
  assert.equal(folded[0]!.status, "blocked");
  assert.equal(folded[0]!.cost.micros, 0, "a call never sent is the only honest $0");
  assert.equal(folded[0]!.cost.basis, "none");
  assert.match(folded[0]!.error?.message ?? "", /daily cap/);
});

test("redaction strips credential shapes before anything is persisted", async () => {
  const dirty = {
    state: { note: "Bearer jv_live_abcdef123456", nested: { apiKey: "sk-secretvalue99" } },
    questions: EXCHANGE.questions,
    headers: { Authorization: "Bearer jv_live_abcdef123456", "content-type": "application/json" },
  } as unknown as ReflexExchange;
  const { value, redactions } = redactForLog(dirty);
  const s = JSON.stringify(value);
  assert.ok(!s.includes("jv_live_"), "token value must not persist");
  assert.ok(!s.includes("sk-secretvalue99"), "api key must not persist");
  assert.ok(s.includes("[REDACTED]"));
  assert.ok(redactions >= 3, `expected >=3 redactions, got ${redactions}`);

  // And through the whole metered path: the persisted begin line is clean.
  const backend: ReflexBackend = {
    call: async () => ({
      result: { answers: [answerChoice(NEXT_Q, [1, 0])] },
      usage: { promptTokens: 1, completionTokens: 0 },
    }),
  };
  const { deps, log } = meteredDeps({ backend }, { clock: () => DAY1 });
  await callReflexMetered(deps, { ...BASE_INPUT, exchange: dirty });
  const jsonl = log.toJSONL();
  assert.ok(!jsonl.includes("jv_live_abcdef123456"));
  assert.ok(!jsonl.includes("sk-secretvalue99"));
  const folded = foldAttempts(log.lines(), DEFAULT_PRICE);
  assert.ok(folded[0]!.request.redactions >= 3, "the row records that redaction happened");
});

test("JSONL file sink is durable and round-trips through the reader", async () => {
  const dir = mkdtempSync(join(tmpdir(), "emberhall-attempts-"));
  const path = join(dir, "attempts.jsonl");
  const fileLog = createJsonlAttemptLog(path);
  const backend: ReflexBackend = {
    call: async () => ({
      result: { answers: [answerNoul(DANGER_Q, 0.9)] },
      raw: { danger: 0.9 },
      usage: { promptTokens: 750, completionTokens: 0 },
    }),
  };
  const guard = new BudgetGuard({ clock: () => DAY1 });
  const deps: MeteredDeps = {
    backend,
    guard,
    log: fileLog,
    provider: { name: "typesafe", model: "jev-1.14.0" },
    clock: () => DAY1,
  };
  await callReflexMetered(deps, { ...BASE_INPUT, exchange: { state: {}, questions: [DANGER_Q] } });
  fileLog.close();

  const onDisk = readFileSync(path, "utf8");
  assert.equal(onDisk.trim().split("\n").length, 2, "begin + end lines persisted");
  const lines = readAttemptLogFile(path);
  const folded = foldAttempts(lines, DEFAULT_PRICE);
  assert.equal(folded.length, 1);
  assert.equal(folded[0]!.status, "ok");
  assert.equal(folded[0]!.cost.micros, Math.ceil(750 * 0.042));
  const summary = replayLog(lines);
  assert.equal(summary.matched, 1, "file round-trip replays strict");
});

test("stale reservations reconcile by charging the estimate (fail closed)", () => {
  let now = DAY1;
  const guard = new BudgetGuard({
    dailyCapMicros: 500_000,
    clock: () => now,
    reservationTtlMs: 1_000,
  });
  const r = guard.reserve("agent-1", 100_000);
  assert.equal(r.ok, true);
  now = DAY1 + 2_000; // reservation is now older than its TTL
  const rec = guard.reconcile();
  assert.equal(rec.expired.length, 1);
  assert.equal(rec.chargedMicros, 100_000);
  const snap = guard.snapshot("agent-1");
  assert.equal(snap.spentMicros, 100_000, "a lost reservation may have been billed");
  assert.equal(snap.reservedMicros, 0);
});

test("estimates are conservative: reserve >= naive prompt cost, monotonic in size", () => {
  const small = microsForReservation(300, DEFAULT_PRICE);
  const large = microsForReservation(3000, DEFAULT_PRICE);
  assert.ok(large > small, "bigger requests reserve more");
  const naive = microsForUsage({ promptTokens: estimateTokens(300), completionTokens: 0 }, DEFAULT_PRICE);
  assert.ok(small >= naive, "reservation never under-bids the naive estimate");
  assert.equal(estimateTokens(0), 0);
  assert.ok(estimateTokens(1) >= 1, "non-empty payloads never estimate to zero");
  const est = microsForEstimatedUsage(900, 300, DEFAULT_PRICE);
  assert.ok(est > microsForUsage({ promptTokens: 300, completionTokens: 0 }, DEFAULT_PRICE));
});

test("spend report aggregates per agent per day and formats the gate table", () => {
  const lines: AttemptLine[] = [];
  const mk = (attemptId: string, agent: string, at: number, micros: number): void => {
    lines.push({
      type: "begin",
      attemptId,
      agentId: agent,
      bodyId: "b",
      lane: "reflex",
      trigger: { kind: "heartbeat", detail: "" },
      tick: 1,
      stateHash: "x",
      startedAt: at,
      provider: { name: "typesafe", model: "jev-1.14.0" },
      request: { exchange: EXCHANGE, bytes: 100, redactions: 0 },
      reservationId: null,
      retryOf: null,
      retryN: 0,
    });
    lines.push({
      type: "end",
      attemptId,
      endedAt: at + 5,
      status: "ok",
      response: { answers: [], raw: null, action: null },
      error: null,
      usage: { promptTokens: 100, completionTokens: 0 },
      cost: { micros, basis: "reported", price: DEFAULT_PRICE },
      latencyMs: 5,
    });
  };
  mk("a1", "agent-1", DAY1, 300_000);
  mk("a2", "agent-1", DAY1, 300_000);
  mk("a3", "agent-2", DAY1, 10);

  const report = buildSpendReport(lines);
  assert.equal(report.length, 2);
  const a1 = report.find((r) => r.agentId === "agent-1")!;
  assert.equal(a1.spendMicros, 600_000);
  assert.equal(a1.withinCap, false, "600k micros > $0.50 cap fails the gate");
  assert.equal(a1.promptTokensReported, 200);
  const a2 = report.find((r) => r.agentId === "agent-2")!;
  assert.equal(a2.withinCap, true);

  const text = formatSpendReport(report);
  assert.match(text, /agent-1/);
  assert.match(text, /FAIL/);
  assert.match(text, /UTC calendar day/);
  assert.match(text, /typesafe-jev@2026-11-21/, "pricing provenance appears in the report");
  assert.equal(DEFAULT_DAILY_CAP_MICROS, 500_000, "the Phase 3 gate is $0.50/agent/cost-day");
});

test("parseAttemptLines is strict about corruption", () => {
  assert.throws(() => parseAttemptLines('{"type":"begin"}\nnot json\n'), /line 2/);
  assert.throws(() => parseAttemptLines('{"type":"weird"}'), /unknown line type/);
  assert.deepEqual(parseAttemptLines(""), []);
  assert.deepEqual(parseAttemptLines("\n\n"), []);
});
