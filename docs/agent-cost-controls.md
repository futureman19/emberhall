# Agent cost controls — DecisionLog, budget guard, replay (Phase 3)

**Status:** Phase 3 cost infrastructure, landed behind the harness contract.
**Scope:** durable per-attempt logging, pre-call budget enforcement
($0.50/agent/day), offline replay, spend reporting. The autopilot integration
that consumes these APIs is the integration card's job.

---

## 1. What exists

| Module | Role |
|---|---|
| `src/game/agent/attempts.ts` | Durable attempt log: begin/end line schema, redaction, fold, digest |
| `src/game/agent/attempts-file.ts` | Node-only JSONL file sink (fsync per line) + reader |
| `src/game/agent/pricing.ts` | Price table with provenance, token estimation, micro math |
| `src/game/agent/budget.ts` | `BudgetGuard` — concurrency-safe reservations + reconciliation |
| `src/game/agent/metering.ts` | `callReflexMetered` — the ONLY supported provider-call path |
| `src/game/agent/replay.ts` | Offline decision reconstruction (strict + shallow) |
| `src/game/agent/report.ts` | Per-agent per-cost-day spend report (gate instrument) |
| `scripts/agent-cost-report.ts` | CLI: report from a JSONL log, exit 1 on cap breach |
| `scripts/agent-cost-replay.ts` | CLI: replay a log, exit 1 on mismatch |
| `src/game/agent/cost.test.ts` | 15-test suite (on the repo `test` script) |

Relationship to the contract's `log.ts`: `DecisionLogRow` stays the training
schema (state, candidates, answer, outcome). The attempt log is the cost and
reliability record *around* the same calls — every attempt, including
failures, retries, blocked calls and interruptions. An `ok` attempt can emit
both rows; they join on `stateHash`/`tick`/`bodyId`.

## 2. Integration API

```ts
import { foldAttempts } from "./agent/attempts.ts";
import { createJsonlAttemptLog, readAttemptLogFile } from "./agent/attempts-file.ts";
import { BudgetGuard } from "./agent/budget.ts";
import { callReflexMetered } from "./agent/metering.ts";
import { DEFAULT_PRICE } from "./agent/pricing.ts";

const path = "var/agent-attempts.jsonl";
const log = createJsonlAttemptLog(path); // durable, fsync/line
const guard = BudgetGuard.fromAttempts(foldAttempts(readAttemptLogFile(path), DEFAULT_PRICE), {});
//   ^ rebuild day buckets from the log on boot — a restart never resets spend

const { attemptId, outcome, cost } = await callReflexMetered(
  { backend: jevBackend, guard, log, provider: { name: "typesafe", model: "jev-1.14.0" } },
  {
    agentId: body.ownerId, bodyId: body.id,
    trigger: { kind: "hp-drop", detail: "hp 41 -> 33" },   // from the scheduler's event
    tick: world.tickCount, stateHash: hashObservation(obs),
    exchange: { state: obsSlice, questions },
    retryOf: null, retryN: 0,                              // retries: link + count
  },
);
```

- **Scheduler hook (t_282dd560):** call `callReflexMetered` for every reflex
  decision. `BudgetExceededError` = the agent is done for the cost day —
  catch it, skip further calls, keep the body on last-intent. There is no
  unmetered path; do not call a backend directly.
- **Backend contract (t_0b00ee59):** implement `ReflexBackend.call(exchange)
  → ReflexCallOutcome`. Return `usage` ({promptTokens, completionTokens})
  from the provider's usage row on every outcome INCLUDING errors when the
  provider supplies it; return `raw` (question id → probabilities) to enable
  strict replay; return `error` instead of throwing. Credentials live only
  inside the backend — never in the exchange, the outcome, or any log field.

## 3. The durable record

Append-only JSONL, two lines per attempt:

- **begin** — written BEFORE the call: `attemptId`, `agentId`, `bodyId`,
  `lane`, `trigger` (kind+detail), `tick`, `stateHash`, `startedAt` (wall
  clock ms), `provider`, full redacted `request.exchange` + byte count +
  redaction count, `reservationId`, `retryOf`/`retryN`.
- **end** — `endedAt`, `status` (`ok|error|timeout|blocked`), `response`
  (normalized answers + raw probabilities + action digest) or `error`,
  `usage`, `cost` ({micros, basis, price snapshot}), `latencyMs`.

A begin with no end folds to status **`interrupted`** and is charged a
conservative payload-size estimate — a crash between send and response may
have been billed, and interrupted work is never silently free. The file sink
`writeSync`+`fsyncSync`s every line before returning.

**Redaction:** everything persisted passes through `redactForLog` —
secret-shaped keys (`authorization`, `api_key`, `token`, …) and token-shaped
values (`Bearer …`, `jv_live_…`, `sk-…`) are replaced with `[REDACTED]`
and counted on the row.

**Missing usage is never free:** provider-reported usage prices exactly
(`basis: "reported"`); absent usage prices from payload sizes at 1.5x
(`basis: "estimated"`). The only honest $0 is a `blocked` attempt — no call
was sent.

## 4. The budget guard

- **Cap:** `DEFAULT_DAILY_CAP_MICROS = 500_000` ($0.50) per agent per cost day.
- **Cost day (locked interpretation):** the plan says "per day" without a
  definition. This implementation fixes it as the **UTC calendar day of the
  wall clock** (`new Date(ms).toISOString().slice(0,10)`): provider billing
  and the plan's $4/polling estimate are wall-clock concepts. It is pinned
  to UTC so hosts in any timezone agree. The vale's in-simulation day
  (24 sim hours over ticks) is **never** consulted — `tick` rides the record
  as context only.
- **Concurrency:** `reserve()` is a synchronous check-and-insert; Node runs
  it atomically, so interleaved async callers cannot oversubscribe. Per
  (agent, day): `spent + reserved + estimate ≤ cap`.
- **Reconciliation:** `settle()` replaces the reservation with the actual
  cost; `voidReservation()` drops a never-sent hold; `reconcile()` charges
  stale reservations their full estimate (fail closed);
  `BudgetGuard.fromAttempts(foldedLog)` rebuilds buckets after a restart.
- **Honesty note:** this is a pre-call gate with post-call reconciliation.
  If a provider bills more than the reservation estimate, settled spend can
  exceed the cap by one in-flight call's delta; subsequent calls then refuse.
  Estimates are deliberately conservative (1.25x + floors) to make that rare.

## 5. Replay + report tooling

- `replayAttempt` / `replayLog` — reconstruct decisions from recorded
  inputs/outputs. **No backend parameter exists; paid calls issued: 0, by
  construction.** STRICT level (backend returned `raw`): raw probabilities
  re-run through `answerChoice/answerScore/answerNoul`, must deep-equal the
  recorded answers and action digest. SHALLOW level: structural invariants +
  digest consistency. Tampering is detected as concrete mismatch problems.
- `buildSpendReport` / `formatSpendReport` — per (agent, cost-day): attempts
  by status, retries, reported tokens, estimated-attempt count, spend, gate
  PASS/FAIL, pricing basis. CLI exits 1 on any FAIL.

## 6. Pricing assumptions and limitations

- **Price:** Jev 1.14 (`jev-1.14.0`) at **$0.042 per million input tokens,
  output free** — TypeSafe public rate card (`docs.typesafe.ai/models`),
  captured 2026-11-21. Volume tiers ($0.25/Mtok on large prepaid packs) are
  NOT assumed: the guard prices at the headline rate, which can only
  overestimate. Every attempt row snapshots the price it used; a reprice
  edits `PRICES` and never rewrites history.
- **Token estimates** (fallback only): `ceil(bytes/3)`, floor 1 — JSON
  tokenizes denser than prose, so this errs high. Reserve estimate adds
  1.25x + 64 prompt + 256 completion tokens; missing-usage settlement
  multiplies by 1.5x. All multipliers fail closed.
- **$0.50 sanity:** at $0.042/Mtok the cap is ~11.9M input tokens/agent/day —
  e.g. 4,000 decisions/day at ~3,000 tokens each. Per-second polling
  (~86k calls/day) would be ~100M+ tokens ≈ $4+, tripping the guard within
  the day — which is the point.
- **Limitations:** (1) guard state is per-process — the host must run ONE
  guard per shard (single-writer discipline) or rebuild via `fromAttempts`;
  (2) `chars/3` is a heuristic, not the vendor tokenizer — settled rows use
  reported usage whenever the backend provides it; (3) mind-lane calls are
  loggable/chargeable but replay is reflex-only; (4) no rate-limit (429)
  policy here — retries are the scheduler's call, each a separately
  authorized, logged, charged attempt.

## 7. Verification

`node --experimental-strip-types --test src/game/agent/cost.test.ts` —
15 tests: cap blocking, concurrent oversubscription (10 callers, exactly
cap-fitting number pass, provider sees only those), UTC day boundary across
midnight with an unchanged vale tick, failure + retry accounting, interrupted
visibility, missing-usage estimation, strict/shallow replay + tamper
detection, blocked honesty, redaction, JSONL durability round-trip, stale
reservation reconciliation, estimate conservatism, report aggregation, parse
strictness.
