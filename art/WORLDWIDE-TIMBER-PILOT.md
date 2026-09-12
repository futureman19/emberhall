# Oak / pine / birch controlled runtime pilot

## Outcome
Three of eight existing timber species pass the scoped desktop/mobile-viewport lifecycle and built-output pilot. All 879 canonical tests pass; 268 fresh browser assertions pass: candidate 105, actual HTTP503 primitive fallback 94, final built output 69. Each run covers six unique device/species cases. This is **not** natural-forest, complete-animation or performance acceptance. No GLBs were regenerated and nothing was published.

## Changes
- `src/components/game/oak-stumps.tsx`: track sapling occupied coordinates in the stump memo dependency key. Forestry mutates the same sapling array without a land revision; an ordinary oak planting formerly left the old stump visible behind the new sapling. The key changes with occupancy, not growth-only stage updates.
- `src/components/game/terrain.tsx`: invalidate the four original solid/faded trunk/crown bounding spheres at the existing chunk update boundary. During rejected-download controls the old bounds remained around hidden geometry at y=-40; the visible fallback trunk was excluded from real pointer raycasts. New bounds are computed lazily on demand; no full terrain invalidation on each movement frame was added.
- One regression appended to each existing canonical oak/timber renderer test file. Both were run red first; the bounds test also executes the renderer reset block against real Three.js instances and demonstrates stale-bounds miss followed by a hit.
- `scripts/worldwide-timber-pilot.mjs`: resumable result/check writes, actual mouse/right-click/touch input, real store/world fixed substeps, controlled random sequence, real GLB rejection, production mode without /src imports or bundled React traversal. Fixture labels are explicit.

## Evidence and acceptance scope
`art/verification/worldwide/timber-acceptance.json` retains all eight canonical IDs and separates controlled, built, natural-forest and performance statuses.
- `timber-candidate-final/results.json`: 105 passing assertions.
- `timber-failure-final/results.json`: 94 passing assertions; actual rejected oak/pine/birch GLB requests on each viewport, original primitive visuals and gameplay retained.
- `timber-built-v2/results.json`: 69 passing assertions after fresh successful build and built-server restart. All three served GLB hashes match current local files. Candidate/fallback/built actual typed wood deltas agree for each device/species case.
- Each case uses a distinct coordinate in a cleared disposable planted-timber fixture; authoritative resource identity is never replaced at an already discovered node. Real input triggers chop, normal fixed substeps move/work/deplete, typed inventory receives two correct-species logs with no duplicate legacy logs. Clock jumps then normal world substeps prove node-ID-preserving regrowth; another real near-tree pointer interaction harvests again.
- Oak and birch acorn planting use the normal `sowAcorn` store verb and simulation completion. This is not a menu-button click test. Pine ties oak at forestry skill zero and is not selected by the existing chooser: its early-growth presentation is exercised by inserting an explicit disposable saved sapling and then advancing the normal world. **No claim that ordinary planting can select pine.**
- New sapling occupancy removes the stump, normal growth updates change stage/model scale, and maturation preserves the intended species. Presentation-only player repositioning after sapling assertions clears the target; the normal camera is unmodified. Action effects are allowed to expire through real fixed substeps before final captures, not hidden by renderer overrides.

## Visual review
Final candidate desktop, fallback mobile, final built desktop/mobile lifecycle sheets and native full `timber-built-v2/mobile-pine-sapling.png` inspected. Full oak, tiered pine and pale sparse birch silhouettes are coherent; no clear large detached crown/trunk was observed. Native pine sapling is present and clear of player/HUD. Tiny sapling species identity, fine branch/root details and exact ground contact remain scale-limited. Depleted birch stump is partly crowded by the player. Pale base rings may be gameplay indicators; these images do not establish detached wood. Contact-sheet crops clip some notifications; no full-viewport UI regression is established from that crop alone.

## Retained failures / superseding evidence
- `timber-pilot-v1/results.json`: real oak stump remained behind ordinary new sapling; fixed occupancy-key regression. `.hermes/worldwide-timber-red.log`: expected test failure.
- `timber-fallback-control-v1`, `timber-fallback-diagnostic-v2`, `timber-fallback-bounds-v3`: visible primitive trunk could not be clicked. Last diagnostic shows cached hidden-pool sphere and an isolated same-matrix trunk ray hit. `.hermes/worldwide-timber-bounds-red.log`: expected failing regression. Final failed-download run passes the unchanged screen-coordinate interaction.
- `timber-candidate-v2`: paused pine fixture insertion did not advance the hour-subscribed crop renderer; fixed the fixture by advancing normal world time.
- `timber-candidate-v3`: fixed one-second planting budget ended before birch work completed; three seconds of normal substeps completed it. No forestry action timing changed.
- v4 candidate/failure functionality passed, but review found lingering genuine action effects obscuring small states. Final recaptures let those effects expire normally; earlier files remain.
- `timber-built-v1`: Continue never appeared because the old preview process served HTML referencing removed JS chunks after rebuilding. Confirmed `index-BFbFOABA.js` and `routes-BaXWy8ay.js` returned404. Restarted only the tracked built-preview server. Its HTML then referenced current `index-CZgG_2LF.js` and `routes-WQhqC7Ex.js`; all four initial stylesheet/JS requests returned200 and existed in current build. v2 passed. This was not waived as a passing build smoke.

## Gates and remaining scope
- `.hermes/worldwide-timber-tests.log`: 879 tests, zero failures/cancelled/skipped.
- Typecheck, full lint, art AST audit/refresh, production build, auth invariant and diff whitespace checks pass. Build had `DATABASE_URL` unset; migration skipped. Full lint/diff repeated after final harness edits.
- Local built preview remains `http://127.0.0.1:8124`. No commit, push, external preview or production deployment in this batch.
- Remaining timber runtime species: willow, ash, redwood, yew, ghostwood. Rare/discovery/tool/ghost gates, unchanged natural forest traversal, dense/crowded placement and frame-time measurements remain pending, as do broader world/building/character release gates.
