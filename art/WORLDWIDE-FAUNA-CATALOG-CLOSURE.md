# Final four creatures and controlled catalog closure

## Outcome
Bonecrow, tideclaw crab, dusk owl and field rat pass scoped desktop/mobile gameplay, original-body controls, actual rejected-download fallback and final built-output checks. No new art or gameplay edits were needed; all 52 fauna GLBs remain byte-identical to `art/verification/worldwide/final-four-source-hashes.json`.

**Controlled species coverage is now 52/52; none missing.** This is not whole-world acceptance. Natural AI/habitats, every action/state, physical-phone and frame-time performance remain pending. No commit, push, publication, public-preview update or production change occurred.

## Fresh final-four evidence
Paths relative to `art/verification/worldwide/`:
- `final-four-candidate-v1/results.json`: 46 assertions, pass.
- `final-four-baseline-v1/results.json`: 46 assertions, pass.
- `final-four-failure-v1/results.json`: 46 assertions, pass.
- `final-four-built-v1/results.json`: 18 assertions, pass.

- **156 new browser assertions passed.** Candidate, original-body and HTTP503-fallback each cover the four species on both viewports (8 cases per mode). Built output has 8 full-frame captures with actual mouse/touch targeting.
- Every requested species has actual rejected HTTP503 download coverage. Initial-world requests for unrelated species are not counted as scoped coverage. All final-four built GLBs return HTTP200 and match local SHA256. No unexpected page/console/shader errors; expected503 errors retained.
- `.hermes/worldwide-final-four-tests.log`: **877 tests; 877 passed, 0 failed, 0 cancelled, 0 skipped**.
- Tests, typecheck, lint, build, auth invariant, diff check and built browser QA completed in one foreground chain with exit0. Built checks start after successful build completion.
- Background original-body/failure chain `proc_f69ba9c915a0` exited0. Shell emitted a no-job-control warning but both saved results passed; not the earlier non-TTY failed run.
- `.hermes/worldwide-final-four-build.log`: build passed with DATABASE_URL unset; migration skipped. Auth invariant confirms dev/build sign-in off. Git line-ending warnings retained, diff check passed.

## Whole-catalog evidence audit
`fauna-catalog-evidence-audit.json` freshly audits the saved results, not just ledger booleans:
- **52 unique species across 7 accepted batches**, exact match to the manifest, no omissions/duplicates.
- **1980 accepted browser assertions cumulatively**. Earlier assertions are historical saved runs, not all rerun today at closure.
- **104 unique device/species cases per development mode**, plus **104 built captures**.
- Every species has explicit candidate, original-body, rejected-download and built evidence paths, added consistently to the acceptance ledger.
- Checked pass flags, individual check names, exact case/capture sets and screenshot existence; verified render routing, actual input/combat-death results and rejected-request coverage.
- Every final candidate hash equals the current asset and ledger hash. Historical original-body/fallback hashes are not used as candidate freshness evidence.
- **Freshly fetched every currently served built GLB:** all 52 HTTP200 and SHA256-identical to local assets. This is fresh delivery evidence, not a new all-species browser-input rerun.
- The oldest built result predates `selected`; exact capture filenames and per-species asset/input assertions establish its actual coverage instead. Its raw result was not rewritten.
- Failed earlier pilots and the superseded humanoid built-v1 result remain preserved and are not counted as accepted evidence.

## Visual findings
All four development and final built desktop/mobile crops reviewed. No clear gross disconnected head, wing, claw, leg or tail. Birds read as grounded idle bodies; the crab has a coherent shell/claw outline; rat has a continuous low body/tail silhouette.

Limits retained: dark bonecrow has weak ground contrast; bird feet/folded-wing boundaries, crab appendage roots/count and rat feet/tail root are too small for confident individual-joint certification. Idle bird stills do not establish flight-animation correctness. Native full mobile bonecrow and desktop rat frames show visible targets without UI/player overlap.

- Final compact gameplay sheets: `final-four-built-desktop-compact.jpg`, `final-four-built-mobile-compact.jpg`.
- Native focused frames: `final-four-built-v1/mobile-bonecrow.png`, `final-four-built-v1/desktop-field_rat.png`.
- Full idle/moving/dead captures for all four retained in each development run directory; all built full frames retained.

## Scope and next bounded batch
The cleared disposable arena uses the established gameplay camera, real mouse/touch input, prescribed routes stepped by real ecology and preweakened targets killed by normal combat substeps with controlled RNG. No live save is used, no direct dead-task writes, and no fauna-array replacement masks combat-to-corpse updates.

**Next: oak/pine/birch interaction pilot** from the plan's living-landscape phase: real selection/harvesting, correct resource yield, depletion/stumps, regrowth and applicable sapling states. Then remaining timber species/rare gates, building interiors/cutaways/keep, character recaptures, natural-world visibility/behavior and performance, and isolated-preview delivery.

Creature inventory closure does not clear taming/companions/summons, every attack/spell/status, native habitats, crowded worlds, graphics presets or performance. No automatic background implementation continues from this checkpoint.
