# Deer and habitat variants — local controlled acceptance

## Outcome
Brambleback stag, thornhide doe, whiteback elk, reedback stalker, bog toad, brine hound, dune crawler and coal salamander pass controlled desktop/mobile gameplay, original-body controls, actual rejected-download fallback and final built-output checks. No art or gameplay changes were needed in this batch; all 52 fauna GLB hashes are unchanged versus `art/verification/worldwide/variants-source-hashes.json`.

Coverage: **48/52 species scoped-checked; 4 remain**. Exact ledger: `art/verification/worldwide/fauna-acceptance.json`. Full AI/habitat/performance fields remain pending for all species. No commit, push, deployment, production or public-preview change occurred.

## Fresh evidence
All paths below are relative to `art/verification/worldwide/`:
- `variants-candidate-v1/results.json`: 90 assertions, pass.
- `variants-baseline-v1/results.json`: 90 assertions, pass.
- `variants-failure-v1/results.json`: 90 assertions, pass.
- `variants-built-v1/results.json`: 34 assertions, pass.

- **304 browser assertions passed.** Each development mode has 16 unique cases, covering all eight species on both desktop/mobile viewports. Built output has 16 unique full-frame captures and real mouse/touch target checks.
- HTTP503 fallback includes actual rejected downloads for every requested species; unrelated initial-world asset requests are excluded from scoped coverage.
- Built checks ran only after successful build completion. Every selected served GLB returned HTTP200 and matched the local SHA256 on both viewports. No unexpected page/console/shader errors; deliberate HTTP503 errors retained.
- `.hermes/worldwide-variants-tests.log`: **877 tests; 877 passed, 0 failed, 0 cancelled, 0 skipped**.
- Tests, typecheck, lint, build, auth invariant, diff check and final built-browser checks ran in one foreground chain with exit0. Original-body/failure chain `proc_40e88d2ae36c` separately exited0.
- `.hermes/worldwide-variants-build.log`: build passed with DATABASE_URL unset, database migration skipped. Auth invariant: dev and build agree, sign-in off. Git line-ending warnings are preserved; diff check did not fail.

## Visual findings
All eight development and final built desktop/mobile crop silhouettes reviewed. No clear gross detached head, leg, tail, antler or accidental loose piece. Stag/elk antlers appear seated, reptile tails read continuously, hound silhouette is coherent and crawler raised tail/appendages read together.

Limits remain: thornhide doe and bog toad are particularly small; the doe-specific shape and individual toad limbs are weakly resolved. Crawler claw/leg roots and counts are unresolved at this screen scale. Dark reptile limb/tail junctions and precise antler roots cannot be certified by these stills. These are recorded visibility limits, not demonstrated anatomical defects or waived detailed-topology checks.

Native full mobile bog-toad and desktop dune-crawler frames show visible targets without HUD overlap or an intervening tree/player. They establish unobstructed fixture visibility only.

- Final enlarged gameplay crops: `variants-built-desktop-lineup.jpg`, `variants-built-mobile-lineup.jpg`.
- Native focused frames: `variants-built-v1/mobile-bog_toad.png`, `variants-built-v1/desktop-dune_crawler.png`.
- All species full idle/moving/dead frames and actual simulation/render data are retained in development run directories.

## Acceptance boundaries
Disposable cleared arena; established gameplay camera. Actual mouse/touch target input, prescribed paths stepped by real ecology, and preweakened combat targets killed through normal tickPlayer substeps using controlled RNG. No direct dead-task write or replacement of the fauna array masks combat-to-corpse renderer updates.

This does not certify natural habitats, normal fight difficulty, every attack/spell/animation, crowded-world visibility, physical-phone performance or frame times. Controlled species coverage is not worldwide release clearance.

## Next bounded work
Final four species: **bonecrow, tideclaw_crab, dusk_owl, field_rat**.

After catalog coverage, remaining worldwide gates include actual tree harvesting/growth/picking, building interiors/cutaways and keep upgrade, final character recaptures, natural-habitat/performance checks and isolated-preview delivery. Nothing published; no automatic background implementation continues from this checkpoint.
