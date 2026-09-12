# Eight-fauna bounded acceptance — 2026-09-10

Status: local functional/visual arena batch complete; WORLDWIDE RELEASE STILL HELD.

Species: hare, hart, pine lynx, brine seal, cavern bat, stonefang ogre, cinder drake, grave lich. All eight exercised on desktop 1440x960 and touch-enabled mobile viewport 390x844 in disposable browser contexts. Built output served only at http://127.0.0.1:8124; production and public preview not updated. Changes remain uncommitted/unpushed.

## User-visible changes
- Real combat exposed an existing stale death-pose read in both original and authored art. Beast now reads c.task inside its frame callback before setting corpse rotation. No combat damage, timing, AI, resource or save-schema changes. Red source test and two-species failing original/candidate controls retained.
- Cavern bat wings widened and lightened for a readable wing/body/wing silhouette at the unchanged gameplay camera. Blender regeneration exited 0 and wrote 52 models plus editable source. Hashes changed for multiple regenerated exports, not just the bat; do not claim other GLBs byte-identical. Final tests parsed all 52 and the final eight-species candidate and built-output runs used regenerated artifacts.

## Exact evidence
- `eight-candidate-final/results.json`: 90 checks, 16 cases, pass.
- `eight-baseline-v3/results.json`: 90 checks, 16 original-body control cases after the death-pose fix, pass.
- `eight-failure-v3/results.json`: 90 checks, 16 actual HTTP503-fallback cases, pass. Rejected requests retained, including initial loaded-world fauna; not a claim of exactly 16 requests.
- `eight-built-final/results.json`: 34 checks, 16 screenshots, pass. Every selected GLB returned HTTP200 and matched local SHA256; real mouse/touch hunt intent for all eight. Uses public QA camera projection, no dev source imports.
- Total: 304 passing browser assertions across those four scoped runs, not 304 independent species/scenarios.
- `.hermes/worldwide-eight-tests-final2.log`: 250 script + 627 game/component = 877 tests passed, zero failures.
- Typecheck and lint passed; final foreground build/auth check exited0. `.hermes/worldwide-eight-build-final2.log`; `[auth-invariant] dev and build agree: sign-in off`. DATABASE_URL unset for build; migration skipped.
- Final `git diff --check` passed. No unexpected page/console/shader errors in accepted runs; injected503 errors retained as expected negative-control evidence.

All result directories are under `art/verification/worldwide/`. Repro scripts: `scripts/worldwide-fauna-eight-smoke.mjs`, `scripts/worldwide-fauna-built-smoke.mjs`.

## Visual review
- Same-state original/candidate gameplay-camera images and revised bat before/after reviewed.
- Final built desktop and mobile crop sheets reviewed for all eight: coherent silhouettes, no clear gross disconnected/duplicate anatomy or held-item attachment failure. Small hare/bat/lynx details remain scale-limited.
- Full-viewport mobile revised bat reviewed: visible and unobstructed, still deliberately small at the established camera.
- `eight-built-desktop-lineup.jpg`, `eight-built-mobile-lineup.jpg`, `bat-readability-comparison.jpg` are runtime crops, not concept art or native-size full-viewport proof. Full frames preserved in run folders.

## Retained failures and test boundary
- `eight-pilot-v1` and `eight-baseline-pilot-v1`: real combat dead state while mesh stayed upright. `worldwide-death-red.log` source regression failed before fix; corrected focused tests and full candidate/control passes retained.
- First arena at the centre of Greybarrow was black in both original and candidate because of existing pit fog. Moved disposable review arena to the Greybarrow edge with viewer outside fog; no lighting/gameplay fix or habitat-visibility acceptance claimed.
- Movement is a prescribed short route stepped through real tickEcology with rendered-position checks. Combat uses a preweakened1HP target, controlled RNG and bounded real tickPlayer steps; no direct dead-task override or fauna-array replacement masks the lifecycle. This proves basic movement, selection, strike/death and corpse transform, NOT natural fight difficulty, every attack/spell or complete autonomous AI.
- No frame-time comparison, phone-hardware performance, unchanged dense-habitat traversal, terrain occlusion or whole-world acceptance in this batch.

Next bounded work: remaining creature families. Trees still need real harvesting/growth/picking; buildings need interior/cutaway acceptance; keep art, character recaptures, frame-time comparisons and isolated public preview remain pending. Other art categories stay as tracked in WORLDWIDE-ROLLOUT.md. No automatic background implementation continues from this checkpoint.
