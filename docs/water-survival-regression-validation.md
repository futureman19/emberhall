# Water-survival candidate — regression validation report

Task: `t_9fb0e800` (downstream regression report for the water-survival slice).
Validator: `qwen` lane. Date: 2026-11-24 (Pacific).

## Candidate under test

- **Implementation revision: `846e2903d6bbe1eb6fc3bb6ebbb046de30f07bf7`** on `wt/t_77f1af48`.
- Implementation chain: `7e245e0` (red checkpoint) → `7927770` (focused-green implementation) → `846e290` (gate repairs).
- Base: `8d3c1e7326e8910d27cb1b19e397b4df860c857f` (main). The validation worktree
  `C:/Users/futur/Desktop/emberhall/.worktrees/t_9fb0e800` started at the base and was
  fast-forwarded (`git merge --ff-only`) to `846e290`; ancestry verified, tree clean before testing.
- Diff scope (21 files): `art/asset-ledger.json`, `docs/vale-manual.md`, `package.json` (test-list
  registration of `survival.test.ts` only — no dependency change), `src/components/game/hud.tsx`,
  `src/components/game/paperdoll.tsx`, `src/game/actor.ts`, `src/game/agent/{autopilot,events,reflex,types}.ts`,
  `src/game/commands.ts`, `src/game/context.ts`, `src/game/save.ts`, `src/game/sim.ts`,
  `src/game/types.ts`, `src/game/world.ts`, `src/server/shard.ts`, new `src/game/survival.ts`
  and `src/game/survival.test.ts`, new `docs/water-survival-slice.md`.
- No crafting/catalog/forms/resources/skills/rare input files changed.

## Verdict

**PASS — normal gates green on the exact candidate `846e290`.** No required fixes, no blockers.
Live full-day proof (`t_4e2c4d13`) and independent replay/cost projection (`t_0d13c23d`) are
**not claimed here**; they remain parent-gated on this QA.

## Environment

- Node `v24.13.0` (`node.exe`, `C:/Program Files/nodejs`), native `--experimental-strip-types` test runner.
- Sparse worktree had no `node_modules`; an ignored directory junction to the main repo's installed
  `node_modules` (437 packages) was used. `package.json` dependencies are unchanged from base, so the
  junction is equivalent to a fresh install. `node_modules` and `screenshots/` are gitignored.
- Dev server `npm run dev` bound `0.0.0.0:8080` (free at start). Focused tests used `PORT=5599`
  (shard/ws wire tests bind the ambient port); `5556`/`5517` were already in use by other processes
  and were left untouched.

## Fresh gates run by this validator on the exact `846e290` tree

| Gate | Command | Result | Evidence log |
|---|---|---|---|
| Focused regression subset | `PORT=5599 node.exe --experimental-strip-types --test <18 files>` | **170/170 pass, 0 fail, 0 cancelled, 0 skipped**, exit 0, 63.7 s | `profiles/qwen/cache/scratch/water-qa-focused.log` |
| Auth invariant | `node.exe scripts/check-auth-invariant.mjs` | **PASS** — `[auth-invariant] dev and build agree: sign-in off`, exit 0 | console (dev server on :8080) |
| Crafting browser journey | `node.exe scripts/crafting-smoke.mjs` | **PASS** — desktop + mobile passed, vault visible, no overflow, no console errors, `ok:true`, exit 0 | `profiles/qwen/cache/scratch/water-qa-crafting-smoke.log`; `screenshots/crafting-smoke/verdict.json` |
| Crafting balance gate | `node.exe --experimental-strip-types scripts/crafting-balance-gate.ts` | **READY** — 2,513,760 legal combinations, **0 cap violations**, `browserOk:true`, save 24,951 B, max Vault inscription 779 B, exit 0 (~25 min) | `profiles/qwen/cache/scratch/water-qa-crafting.log`; `reports/crafting-balance-gate.{json,md}` |

Focused subset files (player, agent, persistence, edge-case, food/night, water):
`src/game/survival.test.ts`, `actor-consumption.test.ts`, `trail-food.test.ts`, `campfire.test.ts`,
`save.test.ts`, `actor-save.test.ts`, `src/server/save-decode.test.ts`, `src/server/shard.test.ts`,
`src/server/ws.test.ts`, `src/game/agent/{autopilot,risk-cadence,scheduler,cadence-cost}.test.ts`,
`src/game/fishing.test.ts`, `pathfinding.test.ts`, `movement.test.ts`, `weather.test.ts`,
`src/components/game/art-coverage.test.ts`.

**Sequencing / resource coordination:** the crafting balance gate was run strictly **after** the
focused test run finished (never concurrent with a test suite), per the task rule and the live-proof
worker's resource gate. The crafting browser smoke ran against the same :8080 dev server.

### Documented-rule coverage (`docs/water-survival-slice.md` §3)

All 19 `survival.test.ts` rule tests pass fresh, plus the full-day food/night+water test:

- §3.1 Thirst: start 80, decay 4.8/vale-hour beside hunger 3.2; sleepers/ghosts exempt;
  dehydration 1 HP/0.25 h at zero routed through `die()`; sleepers at zero take no damage.
- §3.2 Drink: verb offered on water tiles only; refusals (dry land, struggling in water, ghosts,
  closed shore); adjacent shore +40 capped at 100 with log; distant pond walks to shore first.
- §3.3 Drowning: 0.5 h grace, 2 HP/0.1 h, escape resets, fly/sleep guard; sleeper on water does not drown.
- §3.4 Awareness: `nearestWater`/`shoreBesideWater`; `bodySheet` carries thirst + water flags;
  observation exposes nearest/shore/escape.
- §3.5 Reflex: edge-triggered thirst/water crossings; thirst-critical + open-water unresolved risks;
  autopilot drink + walk-to-water, drowning scramble outranks drink, no synthetic offer above threshold.
- §3.6 Persistence: save v7 round-trips thirst, migrates v6 absent thirst → 80, rejects malformed bodies;
  actor save v7 round-trips independent bodies.
- Host wire: shard `drink` verb validates integer coordinates and restores thirst.
- Full-day: "real full-day decay and eating keep hunger above 23 through night; thirst dehydrates
  per the water contract" — PASS.

### Art ledger semantic verification

Parsed both blobs (`8d3c1e7:art/asset-ledger.json` vs `HEAD:art/asset-ledger.json`), not raw diff:

- **20 additions**, all `status:"inventoried"` (unapproved): `action:drink`, `hud:vital-thirst`,
  `item:water` (×3 renderer ids), `verb:drink`, and 14 `vocabulary:*` water entries.
- **0 removals, 0 status changes, 0 evidence/review changes.**
- 680 existing rows changed **only** in `catalogSources` (679) / `rendererLocations` (1) — mechanical
  `file:line` pin shifts from the `types.ts` edit (e.g. `types.ts:513`→`515`); no semantic field changed.
- Deterministic SHA256 of the candidate ledger:
  `79b1e6f65f499666201315d566571f3f9948d75d8d64d60b9e060a5238bffe35` — matches the controller's claim.

## Preserved heavy gates cited (NOT re-run — identical tree `846e290`)

Per the implementation controller's instruction, these identical heavy gates were independently
inspected from the preserved log rather than re-run:
`profiles/telegram3/cache/scratch/water-recovery-full-gate.log` (controller `telegram3`, exact `846e290` tree):

- `lint` — exit 0.
- Script tests — **573/573 pass, 0 fail**.
- App tests — **1632/1632 pass, 0 fail**.
- `typecheck` — exit 0.
- Production build (`build:vercel` + `build:cf`) — exit 0 (`✓ built` for client/ssr/prerender).
- Overall marker `WATER_FULL_GATE_EXIT=0`.

**Gap found and closed:** the preserved full-gate log does **not** contain a `check:auth`
(`[auth-invariant]`) stage. This validator therefore ran `check:auth` fresh on the exact tree
(PASS, sign-in off) rather than citing it from the log. The crafting balance gate and crafting
browser journey were likewise absent from the preserved log and were run fresh here.

## Side effect on tracked evidence

Running `gate:crafting` regenerated `reports/crafting-balance-gate.{json,md}`. The only change is the
representative save-payload size **24,645 → 24,951 bytes** (the new `thirst` field in save v7);
all enumeration/acquisition/cap figures are unchanged. This accurate one-line refresh is committed
alongside this report. No implementation file was modified.

## Required fixes / blockers

None.

## If the candidate implementation changes beyond `846e290`

Re-run, on the new revision: the focused regression subset, `check:auth`, `smoke:crafting`,
`gate:crafting`, and the full heavy gate (`lint`, full `test`, `typecheck`, production build).
The live full-day scenarios A–D (`t_4e2c4d13`) and the independent replay/cost projection
(`t_0d13c23d`) must also be re-run against the new revision. A docs/evidence-only commit on top of
`846e290` (such as this report) does not change the implementation and does not require re-validation.

## Boundaries

No push, deploy, chain, or paid-provider actions. Local commit only. Shared implementation untouched.
