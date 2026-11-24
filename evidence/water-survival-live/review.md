# Water-survival live proof — full vale day (t_4e2c4d13)

**Verdict: PASS.** A fresh dedicated reflex-driven agent survived a full 24-hour
vale day under combined night + food + water pressure, with zero recorded
rejections, zero interventions, zero errors, and an intact budget guard. Water
pressure was *directly measured* (threshold crossings, drink offers, acked
drinks, thirst restores) — not inferred from survival alone.

- **Card:** t_4e2c4d13 — Prove fresh reflex-agent survival under combined water pressure
- **Revision (HEAD):** `72e2650bf422fd3c462b5bde8373362e15a1c280` (QA-final, t_9fb0e800)
- **Implementation base:** `846e2903d6bbe1eb6fc3bb6ebbb046de30f07bf7` — confirmed ancestor of HEAD (`git merge-base --is-ancestor` OK). Chain `7e245e0 → 7927770 → 846e290`.
- **Date:** 2026-11-24 · **Mode:** zero-paid, isolated, no game/host mutation (`git diff -- src` empty).
- **traceHash:** `2d599eacc9f52f332efa8b3658996f0af2a9eb546aae68bda68778ea00d95b75`

## Acceptance (harness-computed, all true)

| Flag | Result |
|---|---|
| fullDaySurvival | true |
| zeroRejections | true |
| zeroInterventions | true |
| budgetGuardIntact | true |
| waterPressureExposed | true |
| waterPressureResponded | true |
| **pass** | **true** |

Stop reason: `full-vale-day`. Counts: **8642 observations · 6 decisions · 6 attempts · 0 rejections · 0 interventions · 0 errors.**

## Initial conditions

- Seed `20261124`, port `5599`, fresh isolated `dataDir` under `evidence/water-survival-live/raw/shard-data`, start hour `8.0`.
- Agent `aquila` (host id `host-982f367a2aeea5dcf50985a9`), spawn `(256, 293)`, budget agent id `water-proof-aquila`.
- Vitals: hp 40/40, hunger 80, thirst 80, energy 80, mana 22; notoriety innocent; not in water, not drowning, not ghost.
- Weather: fair, cloud 0.32, wet 0, wind 0.2. Pack: knife 1, pick 1, hoe 1, fishing_rod 1.

## Configuration

- Authoritative host: real isolated shard via `runMain + shardConfig` (`scripts/water-shard-boot.mjs`), tick 100 ms (10 Hz), vale hour = 36 wall-seconds.
- Reflex backend: `deterministic-local-survival` — doc-compliant local survival scorer (`docs/water-survival-slice.md` §4 Scenario A): walk-to-water when far / drink when adjacent / eat when hungry / scramble when drowning / low-energy walk guard (energy ≤ 20). **Not** the generic `createStubBackend` (explicitly not a survival policy).
- Production seams (real, not mocked): `createReflexHostFeed` + `createReflexAutopilot` + `createBudgetGuard` + `createFileAttemptLog` + `callReflexMetered` at zero tariff.
- Scheduler: `riskGated: true`, `idleHeartbeatTicks: 36000`, cadence `{ mindHeartbeatHours: 3, sleepStartHour: 22, sleepEndHour: 6, reflexCooldownTicks: 150 }`, events `{ hpCriticalFraction: 0.25, hungerLow: 25, hungerCritical: 10, thirstLow: 25, thirstCritical: 10, energyLow: 25, energyCritical: 10, hostileRadius: 8, idleStasisPushes: 3 }`, `maxConcurrentAttempts: 1`, failure backoff 4→64 ticks.
- Price table `local-survival-zero` (model `deterministic-scorer`, USD, prompt/completion 0 per MTok). Watchdog 1,800,000 ms. URL `ws://127.0.0.1:5599`.

## Duration

- **24.0028 sim hours · 8641 ticks · 962.4 wall-seconds (~16.0 min) · 8642 observations.**
- Night observations: 3240. Quiet window entered hour 22, exited hour 30 (wrapped 06:00) — derived from the hourly timeline.

## Survival state

- **hp 40 start / 40 min / 40 end — no damage taken all day.**
- Thirst 80 → min 8.0 → end 84.79. Hunger 80 → min 23.66 → end 37.19.
- No drowning, no ghosting, no death.

## Water-pressure exposure (directly measured)

| Metric | Value |
|---|---|
| First tick ≤ offer60 | 1500 (hour 12.17) |
| First tick ≤ low25 | 4125 (hour 19.46) |
| First tick ≤ critical10 | 5250 (hour 22.58) |
| Ticks ≤ offer60 / low25 / critical10 | 5441 / 1276 / 151 |
| Observations with drink offered | 3363 |
| Drink decisions / acked ok / thirst-restore events | 3 / 3 / 3 |
| Eat decisions / acked ok | 1 / 1 |
| inWater ticks / drowning ticks / max consecutive in water | 0 / 0 / 0 |

Scenario A is shore-based: the agent walks to the pond edge and drinks; it never
enters open water, so inWater/drowning exposure is 0 by design (drowning variants
are Scenarios B–D, not run here). The `drink` verb was offered 26,868 times across
the day and the open-water risk trigger `danger.unresolved` admitted 4 exchanges.

## Attempt log (6 attempts, all status ok)

| Tick | Hour | Triggers | Thirst | Hunger | Action |
|---|---|---|---|---|---|
| 0 | 8.00 | boot | 80.0 | 80.0 | Till a plot [256,291] (#57) |
| 5250 | 22.58 | thirst_critical, danger.unresolved | 10.0 | 33.3 | Walk to water's edge (252,302) (#131) |
| 5400 | 23.00 | danger.unresolved | 8.0 | 32.0 | Drink (251,302) (#129) |
| 6188 | 25.19 | hunger_low, danger.unresolved | 37.5 | 25.0 | Drink / eat (#129) |
| 6338 | 25.61 | danger.unresolved | 75.5 | 23.7 | Eat (#124) |
| 8251 | 30.92 | energy_low | 50.0 | 40.7 | Rest (#122) |

Trigger counts: boot 1, vitals.thirst_critical 1, danger.unresolved 4, vitals.hunger_low 1, vitals.energy_low 1.

## Budget guard (intact)

Final snapshot: day `2026-11-24`, cap 500000 µUSD ($0.50), **spent 0, reserved 0, remaining 500000, openReservations 0.** Metered seam never exhausted. **Provider calls 0, prompt tokens 0, completion tokens 0, total $0.** No credential read, no paid provider constructed.

## Model usage / cost inputs for independent replay & wall-day projection (t_0d13c23d)

- Attempts 6 · wallSeconds 962.422 · **attemptsPerWallHour 22.44** · observations 8642 · simHours 24.0028.
- Zero-tariff price table `local-survival-zero` (0/0 per MTok). The Phase 3.6 paid price record is untouched; the paid wall-day projection is t_0d13c23d's scope. Inputs above (attempt cadence, observation count, price table) are what that projection consumes.

## Doc §4 criterion-3 mapping (honest)

`docs/water-survival-slice.md` §4 criterion 3 asks the replay trace to contain
thirst_low + drink ack + hunger_low + eat ack + nightfall + quiet entry/exit.

| Element | Present | Evidence |
|---|---|---|
| drink ack | yes | 3 acked drinks, 3 thirst restores |
| hunger_low trigger | yes | bundled at tick 6188 |
| eat ack | yes | 1 acked eat |
| nightfall | yes | 3240 night observations, isNight transition in hourly timeline |
| quiet entry / exit | yes | hour 22 entry / hour 30 exit (hourly) |
| **thirst_low trigger** | **no** | sim emitted "Your throat is dry — find water." at 19.46h, but no admitted exchange carried `vitals.thirst_low` |
| **world.daybreak trigger** | **no** | quiet exit derived from hourly timeline, not a bundled daybreak trigger |

**Why thirst_low is absent from the reflex trace:** the scheduler runs
`riskGated: true` with `idleHeartbeatTicks: 36000` (≈100 vale hours) — the
Phase-3.5 cost-bounded cadence. Advisory (non-survival) `thirst_low` does not earn
a standalone exchange; hydration is admitted on the survival trigger
`vitals.thirst_critical` (hour 22.58) plus the open-water risk
`danger.unresolved`. This is implemented scheduler behavior under no-mind
operation, **not** a harness defect and **not** a survival failure. Water pressure
was nonetheless fully exposed and responded to (3 acked drinks, all three thirst
thresholds crossed, thirst restored each time). Card acceptance does not require
the thirst_low trigger specifically; it requires measured water exposure +
full-day survival + zero rejections/interventions + intact guard — all met.

## Replay instructions

- Raw logs (gitignored, kept locally for replay): `evidence/water-survival-live/raw/{observations.jsonl, attempts.ndjson, feed.ndjson, shard.log, shard-data/}`.
- Committed evidence: `report.json`, `decisions.jsonl`, `timeline.json`, this `review.md`.
- Re-derive the hourly timeline + criterion-3 map: `node scripts/water-survival-timeline.mjs evidence/water-survival-live`.
- Re-run the proof: `node --experimental-strip-types scripts/water-survival-live.mjs --out <dir> --port 5599` (boots its own isolated shard; ~16 wall-min; watchdog 30 min).
- `traceHash` canonicalizes the observation + decision trace for independent comparison.

## Scope & guardrails

- **Run:** Scenario A — one fresh dedicated reflex agent, full vale day, combined night + food + water pressure. **Scenarios B (drowning), C, D variants were NOT run and are NOT claimed by this card.**
- No paid provider, no credential spend, no push, no deploy, no chain actions. No shared-implementation mutation (proof-only tooling added under `scripts/`; `src/` untouched). Isolated shard on port 5599 with a fresh dataDir; :8080 left free for Phase 4.
