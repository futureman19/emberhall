# Phase 3.5 live re-proof — reviewer verdict (t_d8b9704d)

Run: reflex-proof-35 / reflex-proof-35-qwen, dedicated local shard port 5591,
fresh data dir, seed 20261121, model jev-1.14.0. Recipe identical to r1
(evidence/phase3-live/): full vale day, 4h watchdog, no mind/planner/manual
fallback, spend fences preflighted with zero provider calls.

Code under test: commit 7c624d5 (cadence 150 + wire compaction).
Gates before run: lint clean, 501 script + 1603 source tests pass,
typecheck/build/check:auth green.

## Results (report.json + independent replay)

- End reason: full-vale-day. Elapsed 954,804 ms (~15.9 min real); sim hour
  8.0167 -> 32.0194 = 24.003 authoritative sim hours.
- Survival: died=false across 8,642 samples; rejected=0 (no hallucinated
  intents, no interventions, no manual fallback).
- Paid calls: 40 ok / 0 error / 0 timeout / 0 blocked / 0 interrupted;
  0 retries; 0 estimated-usage attempts (all usage provider-reported).
- Measured spend: $0.012607 (12,607 micros) for UTC day 2026-11-23 vs
  $0.50 cap = 2.52% of the daily budget. Guard NEVER exhausted (0 blocked).
- Tokens: 299,689 input (7,492/call vs r1 ~19.4k = -61% from compaction);
  83,584 completion (output free per rate card).
- Independent replay: 40/40 attempts match, 0 paid calls issued by replay.
- Pricing: typesafe-jev@2026-11-21 rate card ($0.042/Mtok input, output
  free), rechecked at source; cost normalized in micros.
- r1 comparison: 611 calls / $0.499904 / guard exhausted at t+277s ->
  40 calls / $0.012607 / guard intact = ~40x cost reduction per vale day.

## Wall-day economics (scale-up gate)

Sustained-cadence projection: $1.1408/agent/WALL day (one vale day is
~15.9 min real; an always-on shard runs ~90.5 vale days per UTC day).
That is 2.28x the $0.50 cap and NOT <<$0.50 — the pivot scale-up target
is still unmet on a wall-day basis. At this rate an always-on agent would
exhaust its $0.50 UTC-day budget after ~10.5 h and idle the rest.

## Verdict

PASS for the card's acceptance gates: full vale day survived on reflexes
alone, cents-level measured spend, budget guard never exhausted, clean
independent replay, zero rejections/interventions. Reviewer confirms
duration, no interventions, runtime logs (live-run.log, shard-runtime.log),
usage completeness, pricing basis, rejections and cost normalization.

SCALE-UP WITHHELD: wall-day projection $1.14/agent/day still exceeds the
pivot <<$0.50/agent/day rule. Follow-up (Phase 3.6) must cut another ~3x
via risk-gated cadence / longer cooldown with survival-latency proof /
further prompt reduction before Phase 4 fleet claims. Cadence alone
cannot reach <<$0.50 without unsafe survival latency (vitals decay
~3.2/vale-hour; hp 40), so gating reflexes on actual risk is the
promising lever.