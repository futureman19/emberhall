# Mammal variants — local controlled acceptance

## Outcome
Ember fox, moss badger, oak bear, frosthorn ram, highland aurochs, redtail squirrel, river otter and cave mole pass scoped desktop/mobile gameplay, original-body controls, actual rejected-download fallback, and final built-output checks.

No art or gameplay edits were needed in this batch. All 52 fauna GLB hashes remain identical to `art/verification/worldwide/mammals-source-hashes.json`. No commit, push, deployment or public-preview change occurred.

Coverage: **40/52 species** scoped-checked; **12 remain**. Exact per-species ledger: `art/verification/worldwide/fauna-acceptance.json`. Full AI/habitat/performance fields remain pending for every species; controlled checks are not worldwide release clearance.

## Fresh evidence
Results below are relative to `art/verification/worldwide/`:
- `mammals-candidate-v1/results.json`: 90 assertions, pass.
- `mammals-baseline-v1/results.json`: 90 assertions, pass.
- `mammals-failure-v1/results.json`: 90 assertions, pass.
- `mammals-built-v1/results.json`: 34 assertions, pass.

- Total: **304 browser assertions**. Each candidate, original-body and HTTP503-fallback run covers every selected species once on each of the two viewports (16 cases per run). Built output has 16 unique captures and mouse/touch target checks.
- Actual HTTP503 requests cover all eight requested species. Unrelated initial-world requests are not used to establish requested-species coverage.
- Built output was tested only after the successful build finished; each selected GLB was HTTP200 and SHA256-identical to the local asset on both viewports. No unexpected page, console or shader errors; expected injected503 errors retained.
- `.hermes/worldwide-mammals-tests.log`: **877 tests, 877 passed, 0 failed, 0 cancelled, 0 skipped**.
- Tests, typecheck, lint, build, auth invariant, diff check and built-browser QA completed in one foreground command chain with exit0. Background original-body/failure chain `proc_d18c8c9f66bd` also exited0.
- `.hermes/worldwide-mammals-build.log`: build passed with DATABASE_URL unset; database migration skipped. Auth check: dev and build agree, sign-in off. Git reports line-ending warnings, not failing diff checks.

## Visual review
Development and final built desktop/mobile lineups reviewed across all eight species. No clearly demonstrated gross detached head, limb, tail, horn or accidental loose fragment. Fox/squirrel tails, bear mass, ram wool/horn cluster, aurochs bovine outline and otter continuous body read coherently at the established camera.

**Limits retained:** badger and mole are particularly small and low-contrast; facial/foot attachments cannot be individually resolved. Small squirrel/otter limbs and exact ram/aurochs horn roots are also not certified by these stills. Native full mobile mole and desktop badger frames show visible, unobstructed targets without UI overlap, not detailed anatomy proof.

- Final enlarged gameplay crops: `mammals-built-desktop-lineup.jpg`, `mammals-built-mobile-lineup.jpg`.
- Native frames: `mammals-built-v1/mobile-cave_mole.png`, `mammals-built-v1/desktop-moss_badger.png`; full frames for every species retained in run directories.
- Candidate/control runs retain idle, moving and dead frames. Assertions compare actual ecology movement with rendered roots, actual input with target intent, and normal combat-created death with corpse rotation.

The arena is disposable and cleared, using the established camera and paused clock advanced in bounded simulation steps. Movement uses prescribed paths through real ecology; combat uses preweakened targets and controlled RNG. No direct dead-task writes or replacement of the fauna array masks the real-combat renderer lifecycle. These checks do not certify natural difficulty, every animation/ability, unmodified habitats, crowded-world visibility, physical-phone behavior or frame times.

## Remaining scope
Next bounded batch: brambleback_stag, thornhide_doe, whiteback_elk, reedback_stalker, bog_toad, brine_hound, dune_crawler, coal_salamander.

All remaining species: brambleback_stag, thornhide_doe, reedback_stalker, bog_toad, brine_hound, dune_crawler, coal_salamander, bonecrow, tideclaw_crab, whiteback_elk, dusk_owl, field_rat.

Trees (including actual harvesting/growth/picking), building interiors/cutaways, keep upgrade, final character recaptures, natural habitat/performance and public isolated-preview delivery remain open. No automatic background implementation continues from this checkpoint.
