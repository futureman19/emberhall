# Willow and ash controlled runtime batch

## Outcome
Willow and ash pass the scoped controlled desktop/mobile and built-game checks. Timber coverage is **5/8**, with **203 fresh browser assertions** (candidate 78, actual rejected-download fallback 71, built 54) and **879 canonical tests** passing. Four unique device/species cases in each run. No art or game runtime changes were needed. All eight timber GLBs remain byte-identical to the saved pre-batch hashes.

## Work and scope
Only the local QA harness, evidence and rollout records changed in this batch. The harness accepts willow/ash without losing historical oak/pine/birch defaults, uses distinct per-case coordinates inside each disposable world, derives forestry planting thresholds/chooser availability from the canonical source, records the actual normal command's chosen species, and requires finite numeric depletion timestamps.

Final runs under `art/verification/worldwide/`:
- `willow-ash-candidate-final/results.json`: 78 assertions.
- `willow-ash-failure-final/results.json`: 71 assertions, including actual HTTP503 requests for both species on both viewports.
- `willow-ash-built-final/results.json`: 54 assertions, run after the completed fresh production build.

All assert real mouse/right-click or touch harvest dispatch, correct typed wood (two sound willow logs / two choice ash logs in this controlled fixture), no duplicate legacy logs, authoritative depletion, stump presentation, same-node-ID regrowth, and a second real near-tree harvest. Candidate, fallback and built results agree on the per-species typed yield. Sapling/young/mature states preserve species, with the stump removed during sapling occupancy. Geometry inspection is dev-only; built mode uses real input/state, asset delivery/hash checks and captures, not browser /src imports or speculative React traversal.

**Planting boundary:** Actual normal `sowAcorn` command at forestry0 selects oak, not willow. It is canceled before execution and an explicit saved willow sapling is inserted in the disposable fixture for growth/render testing. Ordinary willow planting is NOT claimed. At forestry30 the real command selects ash and completes planting normally. Commands are dispatched through the store; this is not a planting-menu-button click test.

## Retained failure and harness correction
`willow-ash-candidate-v1/results.json` failed at ash sapling creation because its fixed three-second action budget ended too soon. No gameplay timing or pathfinding was changed. A bounded completion probe now records position, remaining path, intent and workT in quarter-second chunks, each advanced using normal 0.05-second world substeps, with an eight-second cap. Candidate/fallback/built traces all show the existing approach path, workT about0.45 at three seconds, and successful ash planting by the next3.25-second checkpoint on both viewports.

v2 candidate/fallback/built checks passed functionally, but early visual review found the newly completed planting effect made the ash sapling appear larger than its young form. The final recaptures let the genuine effect expire via three further seconds of normal simulation and assert that the plant remains stage1. Effects were not hidden and no tree geometry was altered. Earlier evidence remains saved.

## Visual review
Final built desktop/mobile lifecycle sheets, final mobile primitive fallback sheet and native full `willow-ash-built-final/mobile-ash-sapling.png` reviewed. Standing/mature willow has coherent drooping foliage and a connected trunk; ash has a distinct exposed branching/clustered crown. No clear large missing, floating or disconnected tree part observed. Both small-growth stages are present; native ash sapling is clear of player/HUD. Fine branch seating and sapling species identity remain too small to certify. Base markers, neighboring trees, player proximity and crop-clipped notifications limit interpretation; crops alone do not establish a full-viewport UI defect.

## Gates and evidence accounting
- `.hermes/worldwide-willow-ash-tests.log`: 879 passed, zero failed/cancelled/skipped.
- Typecheck, full lint, production build, auth invariant and whitespace diff checks passed. Lint/diff repeated after final harness edits. `.hermes/worldwide-willow-ash-build.log` records the build; DATABASE_URL was unset and migration skipped.
- Before built QA, every initial HTML stylesheet/JS reference was HTTP200 and present in the current build, including `index-CZgG_2LF.js` / `routes-WQhqC7Ex.js`; both tree GLBs matched current hashes during the built run. No stale-preview restart was needed because app/asset bytes did not change this batch.
- `timber-acceptance.json` retains all eight IDs, explicit per-species evidence and separate natural/performance statuses. `willow-ash-evidence-audit.json` verifies all five accepted species against their saved passing device cases, actual rejected requests and current hashes. **471 cumulative accepted timber assertions** is historical evidence across two batches, not this batch's fresh count.

## Remaining
Redwood, yew and ghostwood: controlled lifecycle plus relevant skill/tool/ghost gates still pending. Natural forest traversal/harvesting, dense placement, full action/status coverage and measured frame-time acceptance remain open. Broader character/building/world release gates are unchanged. No commit, push, public preview or production publication. Local built preview remains `http://127.0.0.1:8124`.
