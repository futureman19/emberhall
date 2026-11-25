# Water-survival independent replay & cost-projection refresh

Task: `t_0d13c23d` · Lane: qwen · Branch: `wt/t_0d13c23d` · HEAD: `73b16cd7193206584223da6fba492b45364202aa`
Date: 2026-11-24 · Status: **PASS (independent replay matches; projection refreshed)** with one documented, bounded traceHash caveat.

This report independently verifies the dedicated full-vale-day water-survival proof
without relying on the original worker's summary, executes the project's independent
replay procedure, confirms the regression gates cover the same candidate, and refreshes
the per-agent per-wall-day cost projection. No push, deploy, chain, or paid-model action
was taken; no game/host state was mutated; the run used an isolated shard on port 5599.
This follow-up does not block Phase 4 character creation, unleash integration, or onboarding.

---

## 1. Candidate identity — gates cover the proof candidate (no revision mismatch)

| Revision | Role | `src/` change vs prior |
|---|---|---|
| `846e290` | implementation candidate (gates run here by `t_9fb0e800`) | — |
| `72e2650` | regression-validation report + proof harness scripts | none (docs/scripts/evidence only) |
| `73b16cd` | live proof evidence (HEAD of this worktree) | none (docs/evidence only) |

Verified with git on this worktree:
- `git merge-base --is-ancestor 846e290 72e2650` → YES; `72e2650 → 73b16cd` → YES; `846e290 → HEAD` → YES.
- `git diff --stat 846e290 HEAD -- src` → **empty**. The game implementation is byte-identical
  across the gate candidate, the validation commit, the proof commit, and this replay HEAD.
- `git diff --stat 846e290 HEAD` touches only `.gitignore`, `docs/`, `evidence/`, `reports/crafting-balance-gate.*`
  (regenerated gate report), and the added proof harness `scripts/water-*.mjs` — no game source.

**Conclusion:** the regression gates (`t_9fb0e800`) and the live proof (`t_4e2c4d13`) cover the
**same implementation candidate** `846e290`. No revision mismatch; no revalidation required.

### Gates cited (from `t_9fb0e800`, `docs/water-survival-regression-validation.md`, on `846e290`)
- Focused regression **170/170** (all 19 survival-rule tests + full-day food/night+water).
- `check:auth` sign-in OFF; crafting-smoke desktop+mobile PASS; `gate:crafting` READY
  (2,513,760 combos, 0 cap violations). Art ledger verified (20 adds, 0 removals/status/evidence changes).
- Heavy gates (lint / 573 scripts / 1632 app / typecheck / build) cited from the controller log.

---

## 2. Recorded live proof (independently re-read from artifacts, `72e2650`)

Source: `evidence/water-survival-live/report.json` (committed), raw logs local.
Backend `deterministic-local-survival`, `paid=false`, `providerCalls=0`. Seed `20261124`, port `5599`,
startHour `8`, simHours `24.0027777777713`, ticks `8641`, wallSeconds `962.422`.

- **Acceptance:** `fullDaySurvival`, `zeroRejections`, `zeroInterventions`, `budgetGuardIntact`,
  `waterPressureExposed`, `waterPressureResponded` — all true; `pass=true`.
- **Counts:** observations 8642, decisions 6, attempts 6, rejections 0, interventions 0, errors 0.
- **Triggers:** boot 1, `vitals.thirst_critical` 1, `danger.unresolved` 4, `vitals.hunger_low` 1, `vitals.energy_low` 1.
- **Water exposure (directly measured):** thirst 80 → min **7.999999999994076** → end 84.78666666665399;
  first tick at/below offer60=1500, low25=4125, critical10=5250; ticks at/below offer60=5441, low25=1276,
  critical10=151; drinkOfferObservations **3363**; drinkDecisions 3 / drinkAckedOk 3 / thirstRestoreEvents 3;
  inWaterTicks 0, drowningTicks 0. Hunger 80 → min 23.662222222213416 → end 37.191111111099104; eatDecisions 1 / eatAckedOk 1.
  nightObservations 3240. **hp 40 throughout** (start/min/end = 40).
- **Budget guard:** spent 0, reserved 0, remaining 500000 of cap 500000 micros (**$0 of $0.50**), totalCostMicros 0.
- **traceHash:** `2d599eacc9f52f332efa8b3658996f0af2a9eb546aae68bda68778ea00d95b75`.

Honest criterion-3 note (carried from the proof): `thirst_low`/daybreak triggers are absent from the
reflex trace under `riskGated` cadence — hydration is `thirst_critical`-driven. Scenarios B–D not run/claimed.

---

## 3. Independent replay executed (this task)

Driver: `scripts/water-survival-replay-check.mjs` (read-only; never submits to host, never pays,
never mutates the recorded proof). Verdict: `evidence/water-survival-replay-check/verdict.json` —
**46/46 checks PASS, 0 failures.**

### 3a. Project independent replay procedure — offline policy replay
`replayPolicy` (`scripts/phase36-policy-replay.mjs`) re-executes the **production scheduler** on the
logged observations with the recorded config. Result: **PASS**, requests **6**, paidCallsIssued **0**,
mismatches **[]**. All counters, water/night/food exposure, rejection/intervention counts and the
budget guard were re-derived from raw evidence and match the report; the replay-stable `traceHash`
was recomputed and matches the recorded value.

The paid-gate decision reconstruction (`replayDecisions`, `scripts/phase36-replay.mjs`) is
**structurally inapplicable** to this zero-paid trace: the deterministic local scorer records
`raw:null` (no provider `next_action` probabilities to reconstruct). The equivalent ground —
exchange reconstruction, scheduler selection, linkages — is covered by the offline policy replay
and the fresh live re-run below. This is documented, not skipped silently.

### 3b. Fresh live re-run on HEAD (`73b16cd`)
A fresh dedicated agent `water-replay-aquila` was run end-to-end through the real production seams
on an isolated shard (port 5599), same seed `20261124` / startHour `8`. Output:
`evidence/water-survival-replay/` (raw gitignored). It completed with `acceptance.pass=true`.

**Survival-grounded replay MATCHES (`survivalReplayMatch=true`):**
- The agent's complete state trajectory is **bit-identical at all 8642 observations**: tick, hour,
  day/night, and hp/hunger/thirst/energy/x/z/inWater/drowning/ghost (max absolute divergence **0**).
- The offered verb **SET** is identical at every tick (`verbSetMismatch=0`).
- Identical 6 canonical decisions (tick/hour/verb/answer/outcome), identical triggerCounts, counts,
  water-survival metrics, scheduler config, seed, startHour, simHours, ticks, budget numerics, zero-paid.

**Strict full canonical traceHash — DIFFERS (documented, bounded):**
- recorded `2d599eac…` vs re-run `82a993ffaa65d88bad38c243da7339cf0fafb34cb0cc1f8df5dbf09127fd0f77`.
- The divergence is confined **entirely** to the MULTIPLICITY of ambient opportunistic verb offers
  (one offer per nearby ambient entity), which is not seed-reproducible across fresh shard boots:

  | verb | recorded | re-run |
  |---|---|---|
  | talk | 45531 | 40393 |
  | walk | 294645 | 289507 |
  | hunt / tame / cast / fireball | 61389 each | 60912 each |

  All other verb counts (drink 26868, fish 26868, bank/house 8642, use 19200, roster 5286,
  teleport/track 212630, till 111929, sowAcorn 77859, dig 101397) are identical.
- The agent **never selected** any of these ambient verbs (its 6 decisions are drink×3, eat×1, and
  the two other recorded choices — all reproduced exactly). No survival-critical field diverges.

**Interpretation:** the survival proof is fully reproduced and the project's independent replay
procedure passes. `traceHash` is a stricter oracle than the survival claim requires because it also
hashes ambient verb-offer multiplicity; that multiplicity depends on the ambient NPC/fauna population
per fresh shard boot and is not deterministic even at identical seed. This is reported as a bounded
limitation of strict trace-hash equality, **not** a survival divergence and **not** folded into a
false "exact match" claim. Wall-clock fields and agent/attempt ids are expected to differ.

### 3c. Follow-up determinism repair — exact replay now PASS (`t_5465ed80`)

The historical limitation above was reproduced before repair: all 46 survival-grounded checks matched,
but the strict hash differed through ambient offer multiplicity. The repair derives ambient movement
from stable per-tick/per-entity RNG keys and scopes fallback entity-ID allocation to each world so
previously created worlds in the same process cannot perturb later IDs. Rollback, save/load, wildcard
RNG, and legacy-save migration tests cover these paths.

The controller then executed two fresh independent full-day runs of the repaired candidate on isolated
ports and shard data. Both recorded 8,642 observations, six decisions/attempts, three acknowledged
drinks, one acknowledged eat, and zero rejections/interventions/errors. Both acceptance reports passed.
Their strict hashes are identical:
`9699cf7d16358569a9081e61e974cec1f5f3a592aa9c8d1c1db900f232311ee3`.
The fresh oracle verdict is `evidence/replay-exact-check/verdict.json`: **23/23 hard checks and 24/24
total checks PASS**, with `strictExact=true`, `safetyIdentical=true`, and `harmlessAmbientOnly=false`.
Scheduler and zero-tariff price configuration are hard-checked in addition to the original safety fields.

All raw observations, decisions, attempts, trace events, and shard state are preserved losslessly as
gzip with original-byte and stored-byte SHA-256 manifests; the oracle reads the compressed evidence and
recomputes the same strict hash. See `evidence/replay-exact-check/README.md` for commands and integrity
details. This follow-up does not relabel the historical pre-fix runs as exact and made no paid calls,
credential changes, push, or deployment.

---

## 4. Cost-projection refresh (traceable)

Script: `scripts/water-survival-cost-projection.mjs` → `evidence/water-survival-replay-check/projection.json`.
Pure arithmetic over recorded artifacts; no provider calls.

### Conventions (identical to Phase 3.6)
- `usdPerAgentWallDay = observedUsd × 86,400,000 / enabledWallMs` (sustained enabled-time projection; **not** a measured 24h bill).
- `enabledWallMs` = sum of `(endMs − startMs)` over `mode=enabled` segments (setup/excluded wall time not counted).
- `usdPerValeDay = observedUsd / (valeHours/24)`; `valeDaysPerWallDay = 86,400,000 / enabledWallMs × (valeHours/24)`.
- Per-call micros = `ceil(promptTokens × promptPerMTok + completionTokens × completionPerMTok)` (`src/game/agent/pricing.ts`), summed.

### Tariff (recorded)
`typesafe-jev` / `jev-1.14.0`, **$0.042 per Mtok input**, **output free** (`completionPerMTok=0`),
source docs.typesafe.ai rate card, captured 2026-11-21. No volume discounts; account billing not reconciled.

### Phase 3.6 historical baseline — reproduced EXACTLY (did NOT test water survival)
- enabledWallMs **954580** (matches raw enabled segment), 3 paid calls, prompt 22700 / completion 6282 tokens.
- Per-call ceil: 7686×0.042=322.812→323; 7588×0.042=318.696→319; 7426×0.042=311.892→312; sum **954 micros** = $0.000954.
- `usdPerAgentWallDay = 0.000954 × 86,400,000 / 954,580 =` **$0.08634750361415493** ✓ (matches recorded to 1e-12).
- usdPerValeDay $0.000953892; valeDaysPerWallDay 90.5213; historical threshold $0.10 (passed).
- Phase 3.6 metrics track hp/hunger/energy only — **no water survival**. Kept distinct from the water proof.

### Water-survival run — observed (zero-paid)
- enabledWallMs **956378**, wallSeconds 962.422, valeHours 24.0027778, 6 attempts, **0 tokens, 0 micros**.
- Direct measured projection: `0 × 86,400,000 / 956,378 =` **$0.000000 / agent / wall-day** (local price snapshot promptPerMTok=0).
- attemptsPerEnabledWallDay **542.045**; attemptsPerValeDay ≈ 6.

### Refreshed paid-equivalent projection — HYPOTHETICAL, not measured
Applies the recorded Phase 3.6 tariff and per-attempt usage to the water run's **observed attempt cadence**.
The water run itself made zero paid calls; this is an extrapolation, not a water-survival bill.
- Via mean reported cost (318 micros/attempt): **$0.1723703389245675 / agent / wall-day** (primary).
- Via mean prompt tokens (7566.67/attempt × $0.042/Mtok): $0.17226192990637593 (small delta from per-call ceil averaging).
- **Ratio to Phase 3.6 baseline: 1.9962× (~2×)** — the water-survival `riskGated` policy issues ~2× the
  reflex attempts per vale-day (6 vs 3), not a tariff change.
- **Would breach the historical $0.10/agent/wall-day threshold** under these assumptions (`breachesHistoricalThreshold=true`).
  The zero-paid run itself costs $0 and trivially passes the budget guard.

**Assumptions (explicit):**
1. Per-attempt prompt usage equals the Phase 3.6 paid mean (7566.67 tokens). The water observation adds
   thirst/inWater/drowning/drink fields absent from Phase 3.6, so real paid prompts may be **larger** —
   this projection is therefore **not an upper bound**.
2. Attempt cadence (6 per ~24-vale-hour enabled window) is taken from the zero-paid run; a paid backend
   could change timing/answers and thus cadence.
3. Tariff held at the recorded rate card; enabled-time convention identical to Phase 3.6; a sustained-rate
   projection, **not** a measured 24-hour bill or invoice.

---

## 5. Links (rules → implementation → tests/gates → live proof → independent replay)

- Rules/spec: `docs/water-survival-slice.md` (`t_dd0f07c3`, `62fd0da`).
- Implementation: `846e290` (`t_77f1af48`; chain `7e245e0` red → `7927770` focused-green → `846e290` gate repairs).
- Tests/gates: `docs/water-survival-regression-validation.md` (`t_9fb0e800`, `72e2650`, on `846e290`).
- Live proof: `evidence/water-survival-live/{report.json,review.md,timeline.json,decisions.jsonl}` (`t_4e2c4d13`, `73b16cd`).
- Independent replay: `scripts/water-survival-replay-check.mjs` → `evidence/water-survival-replay-check/verdict.json` (46/46).
- Fresh re-run: `evidence/water-survival-replay/` (raw gitignored).
- Cost projection: `scripts/water-survival-cost-projection.mjs` → `evidence/water-survival-replay-check/projection.json`.
- Phase 3.6 baseline: `evidence/phase36-live/report.json` (main repo) + raw envelope (worktree `t_bd4459bd`).

## 6. Verdict

**PASS.** Independent replay matches the recorded survival proof on every survival/decision/budget
ground (offline policy replay 6/6; fresh live re-run bit-identical survival trajectory at all 8642
observations). Gates cover the same candidate `846e290` (src byte-identical through HEAD `73b16cd`).
The cost projection is refreshed and traceable: Phase 3.6 baseline reproduced exactly
($0.08634750361415493, no water test); water run measured $0; refreshed paid-equivalent
$0.17237/agent/wall-day (~2× baseline) under stated hypothetical assumptions. The only non-match is
the strict full traceHash, confined to non-deterministic ambient verb-offer multiplicity and documented
above. No push/deploy/chain/paid; no host mutation; Phase 4 not blocked.
