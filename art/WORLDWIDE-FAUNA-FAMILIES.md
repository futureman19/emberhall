# Remaining body-type representatives — local acceptance

## Outcome
Checked wolf, ironwood boar, mire croaker, orebeetle, saltback tortoise, reed heron, fen leech and willow wisp in disposable desktop and touch-enabled mobile contexts. No new art/runtime change was needed. Only the two existing review scripts were generalized to accept explicit validated catalog subsets and preserve their original defaults. Public preview and production unchanged; no commit/push/deploy.

Eight additional species pass scoped arena checks. Combined with the prior eight: 16/52 species checked, 36 remain; all 15 authoring families have at least one representative. This is NOT all-species or full-world acceptance. `art/verification/worldwide/fauna-acceptance.json` enumerates every species and its current boundary.

## Evidence
- `families-candidate-v1/results.json`:90 checks,16 cases,pass.
- `families-baseline-v1/results.json`:90 original-body control checks,16 cases,pass.
- `families-failure-v1/results.json`:90 actual HTTP503 fallback checks,16 cases,pass. Every requested species has rejected requests; initial-world unrelated requests are not mistaken for scoped coverage.
- `families-built-v1/results.json`:34 checks,16 captures,pass. Actual served assets match local hashes; normal mouse/touch input selects each target on both viewports.
- 304 browser assertions across these four runs. Runtime errors: none unexpected; injected503 console errors retained.
- `.hermes/worldwide-families-tests.log`:877 tests pass,0 fail. Typecheck,lint,diff check and foreground build/auth command passed.
- `.hermes/worldwide-families-build.log`:build passes; DATABASE_URL unset,migration skipped. Auth invariant: dev/build agree,sign-in off.
- All52 fauna GLB hashes unchanged in this batch versus `families-source-hashes.json`.

All run directories and crop sheets are under `art/verification/worldwide/`.

## Visual and functional boundary
All eight desktop/mobile gameplay crop silhouettes reviewed: no clear gross attachment/duplicate-anatomy blocker. Heron head/neck/body and beetle body/legs look connected. Wisp floating presentation is intentional. Native mobile heron and desktop wisp frames confirm visible entities without UI overlap. Small animal details remain limited by the established camera. Final built lineup retained separately.

Controlled prescribed routes run through real ecology; targeting uses actual mouse/context-menu/touch; normal combat code resolves a preweakened target with deterministic RNG. This verifies basic motion, strike/death and render lifecycle, not natural fight balance, every attack/spell or full autonomous behavior. No physical-phone performance, unchanged habitat traversal or frame-time acceptance.

Next bounded batch: remaining humanoid monsters (brine_troll, orc_marauder, tomb_sentinel, blackbriar_hag, fen_ghoul, drowned_reaver, ossuary_knight, ash_demon). Remaining trees/buildings/keep/character recaptures and performance/release gates stay open. No automatic background implementation remains running.
