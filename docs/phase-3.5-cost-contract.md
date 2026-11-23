# Phase 3.5 cost contract — cadence + wire compaction (t_d8b9704d)

Status: COMPLETE — implementation + full gate green + fresh-agent live
re-proof PASSED the card gates (commit 7c624d5). Scale-up still withheld:
wall-day projection $1.14/agent/day > $0.50 cap (see Results).

## Why

The Phase 3 live acceptance (t_166eb9f5, evidence/phase3-live/) passed its
measured gates (full vale day survived, spend $0.499904 <= $0.50/day) but only
because the budget guard exhausted at t+277s and the remaining ~11.3 min ran
budget-forced idle. At the old default cadence (reflexCooldownTicks: 2) the
reflex layer made 611 paid calls in 277s (~2.2 calls/s, ~19.4k input
tokens/call). Sustained-cadence projection: $45.21/agent/day — ~90x over the
pivot rule <<$0.50/agent/day. Scale-up (Phase 4 fleet) was withheld.

## What changed

1. **Production cadence** (`src/game/agent/types.ts`):
   `DEFAULT_CADENCE.reflexCooldownTicks` 2 -> 150 (15 host seconds at 10 Hz).
   Worst case bounds a full vale day of continuous events to ~64 paid calls.
   Survival triggers still bypass quiet/dedupe and fire at the next allowed
   slot (<=15 s latency against vitals decaying ~3.2/vale-hour).
2. **Wire compaction** (`src/game/agent/autopilot.ts`):
   `compactObservationForWire` drops the UI-flow verb menu (76% of measured
   r1 wire bytes, never a decision input — non-candidate verbs are dropped by
   prepare anyway), zero-count pack entries, and trims the log tail to 10
   lines. Applied ONLY to the provider exchange; the FULL observation stays
   authoritative for action mapping, the decision row and hashObservation,
   so replay is intact.
3. **Test seam** (`src/game/agent/reflex-runtime.ts`): `createHostReflex`
   accepts an optional cadence override; dispatch-mechanics tests pin the old
   fast cadence explicitly (`FAST_CADENCE` / `reflexCooldownTicks: 2`).
4. **Cost-contract regressions** (`src/game/agent/cadence-cost.test.ts`,
   added to `npm test`): a full vale day of continuous events at the
   production default must stay within [55, 65] paid calls; the wire exchange
   must be compacted while mapping/hash use the full observation.

## Re-proof (fresh agent)

r1 agent `reflex-proof-qwen` spent its $0.50 daily budget on 2026-11-22, so
the re-proof uses a NEW dedicated character/agent (`reflex-proof-35` /
`reflex-proof-35-qwen`), fresh shard data dir, port 5591, evidence at
`evidence/phase35-live/`. Same recipe as r1
(skills/emberhall-dev/references/reflex-live-acceptance.md): full vale day,
watchdog 4h, no mind/planner/manual fallback, spend fences preflighted with
zero provider calls.

Results (evidence/phase35-live/report.json + review.md): full vale day
survived (24.003 sim hours, died=false, 8,642 samples, 0 rejections) on
40 paid calls — all ok, 0 retries, 0 estimated usage — costing $0.012607
(2.52% of the $0.50/day cap; guard NEVER exhausted). Independent replay
40/40 match. Input tokens 7,492/call (-61% vs r1). ~40x cheaper per vale
day than r1 ($0.499904 / 611 calls / guard exhausted at t+277s).

Wall-day caveat: an always-on shard runs ~90.5 vale days per UTC day, so
the sustained projection is $1.1408/agent/WALL day — 2.28x the cap, not
<<$0.50. Phase 3.6 needs a 2.3x cut to reach the $0.50 cap and 11.4x to
reach the <=$0.10/wall-day acceptance target. DECIDED (Codex/telegram2,
2026-11-22, user-routed): risk-gated reflexes — paid calls only on genuine
danger/meaningful events, rare idle heartbeat; t_a99e00a2 assigned to
telegram2 with child tasks. Raw cooldown alone cannot reach the target
without unsafe survival latency.

## Gates

- Agent suites (cadence-cost, scheduler, autopilot, integration, hostfeed):
  33/33 pass.
- Full gate green: lint clean, 501 script + 1603 source tests pass,
  typecheck/build/check:auth pass (art ledger refreshed: 4 autopilot.ts
  line pins remapped, no reviewed-evidence changes).
- No push/deploy/chain actions.