# Worldwide art rollout — implementation in progress

The new request expands approved Lanternwood art across existing world placements. It supersedes starting-settlement-only art gates, not the production hold or gameplay boundaries.

Baseline: 75570b5; feature/emberhall-worldwide-art. Pre-existing file hashes: .hermes/worldwide-baseline.json. No reset, stash or blanket add. Original workspace untouched.

## Ownership and catalog scope
- Fauna lane: all 52 existing species, distinct anatomy and preserved root animation/effects.
- Forest lane: all 8 existing timber species, canonical identity, instancing, growth/depletion and picking.
- Architecture lane: all 23 building kinds, existing 11 kits globally routed and remaining 12 evaluated against exact door/floor/cutaway contracts.
- Controller: NPCs, integration, coverage ledger, tests, browser review and preview delivery.

## Acceptance
Actual GLB parsing, editable Blender sources and approved-asset hash preservation. Desktop/mobile gameplay-camera checks, fallback behavior, relevant interactions and measured frame samples. Full npm test, lint, typecheck, build, auth invariant, diff review. Geometry coverage is not full animation/performance acceptance.

## Remaining program
Remaining weapons/offhands, dropped items/loot, crops/herbs, ore/rocks, terrain/water/horizon transitions, props, effects/atmosphere and UI art stay explicitly pending unless verified in this batch. User-authored voxel attachments remain untouched.

The prior player visibility overlay stays CLOSED/SHELVED. Existing occlusion and performance limits are not waived. No minimum-hardware certification. Preview-only delivery.

## Bounded review recovery — 2026-09-10

Implementation delegates timed out; their work was inspected directly, not accepted from task status. Read-only review findings were reproduced against current source.

Corrected and locally checked:
- Fauna regeneration exited 0 and produced all 52 GLBs; real GLTFLoader parsing verifies exported bytes/hashes and shape budgets. Pine lynx manifest now has bobtail without the extra canid tail.
- Original fauna bodies use a hidden parent only when authored art exists. Original materials, geometry, animations and action logic remain untouched. Removed material swapping and its duplicate render submissions.
- Forest species use dense own-count batches and their own solid/faded tile maps. Executable Three.js tests cover reset, species swaps, fading, depleted slots and regrowth; source checks guard renderer wiring. These tests do not replace actual harvest/growth gameplay acceptance.
- All three new test files explicitly appended to canonical npm test. AST inventory refreshed with existing reviewed evidence preserved, not reset. Legacy oak test now asserts species-local maps.

Fresh results:
- Canonical npm test: 250 script + 626 game/component = 876 passed, 0 failed. `.hermes/worldwide-review-full-tests-green.log`.
- Typecheck, full lint, diff check and production build passed. `.hermes/worldwide-review-build.log`. Build deliberately had no DATABASE_URL; migration skipped, no database writes.
- Auth invariant passed against local 8123: dev/build agree, sign-in off.
- `scripts/worldwide-fauna-review-smoke.mjs` / `art/verification/worldwide/review-v2/results.json`: 16 checks passed. One disposable wolf, desktop and mobile viewport. Real context-menu pointer targeting, authored/fallback visibility, fixture dead-state root transition, actual HTTP503 fallback. No unexpected console/page/shader errors; deliberately injected503 errors retained.
- Same-scene no-shadow draw attribution: desktop control119 vs candidate116; mobile control83 vs candidate80. Three original wolf mesh submissions removed in both. This is draw attribution, NOT FPS/no-slowdown acceptance.
- Normal-camera desktop/mobile wolf and desktop fallback screenshots inspected: coherent single body, fallback visibly retained. Wolf remains small at gameplay scale, so detailed anatomy/animation and other species remain unaccepted.

Retained failing evidence:
- `worldwide-proxy-red.log` proves old implementation fails hidden-parent gate.
- Initial full tests failed due to stale AST ledger + obsolete oak map expectation; repaired without deleting prior logs.
- `review-v1/results.json` failed a fixture transition because mutating the existing fauna array did not update the subscribed snapshot. v2 replaces the disposable array and verifies the renderer transition. This is NOT proof of a real combat-kill lifecycle; that remains pending.

No commit/push/deploy or preview promotion in this recovery batch. Current keep remains original. Building/cutaway worldwide checks, real timber harvesting/regrowth, remaining species gameplay/visual review, same-state frame-time comparisons and final character captures remain outstanding. Remaining-program categories above are still pending. Do not claim world-wide acceptance from these local tests.

## Eight-fauna arena batch — 2026-09-10

See `WORLDWIDE-EIGHT-FAUNA.md` for exact boundaries, failures and evidence. All eight representative creatures have local desktop/mobile movement, actual pointer/touch selection, controlled real-combat death and actual failed-download fallback checks. Fixed existing standing-corpse bug in the render callback; widened/lightened bat wings. Final built-output art and targeting checked for all eight.

Fresh totals: 877 tests pass; 304 browser assertions across candidate, original-body control, HTTP503 fallback and built-output runs. Typecheck/lint/build/auth/diff checks pass. No frame-time or natural-AI/terrain acceptance claim. Final gameplay-camera crop sheets and full frames retained. Local built preview is http://127.0.0.1:8124; no public preview/production deployment, commit or push. Remaining creature families are next; other release gates above remain open.

## Remaining body-type representatives

See `WORLDWIDE-FAUNA-FAMILIES.md`: eight more species pass controlled desktop/mobile and built-output checks, with 304 new browser assertions and 877 canonical tests passing. No new art/runtime change needed; 52 asset hashes unchanged. Coverage is now 16/52 species and a representative of all15 anatomy families, not full-world acceptance. Exact52-entry status is `art/verification/worldwide/fauna-acceptance.json`. Next: eight remaining humanoid monsters. Public preview/production unchanged; existing release gates remain open.

## Humanoid monster acceptance batch

See `WORLDWIDE-FAUNA-HUMANOIDS.md`: eight additional humanoid monsters pass controlled desktop/mobile, original-body, failed-download and built-output checks. Fresh877 tests and304 accepted browser assertions pass. Built v1 hit transient404 during concurrent build; retained evidence and sequenced v2 pass recorded. Red foot-side marks identified as existing monster ground rings. No new art/runtime edits; all52 GLBs unchanged. Current coverage24/52 species,28 remaining. Dark-creature variants are next; performance/habitat and all other worldwide release gates remain open. Nothing published.

## Dark-creature acceptance batch

See `WORLDWIDE-FAUNA-DARK.md`: eight more dark-creature variants pass controlled desktop/mobile, original-body, HTTP503 fallback and built-output checks. Fresh877 tests and304 accepted browser assertions pass. Build and built QA sequenced successfully. No new art/gameplay changes; all52 assets unchanged. Coverage32/52,20 remaining; next eight mammals are enumerated in the batch record. Spider-leg/basilisk-underside fine detail remains scale-limited. Whole-world and release gates remain open; nothing published.

## Mammal acceptance batch

See `WORLDWIDE-FAUNA-MAMMALS.md`: the next eight mammals pass controlled desktop/mobile, original-body, actual HTTP503 fallback and postbuild checks. 877 tests and 304 browser assertions pass. No new art/gameplay changes; all 52 assets unchanged. Current coverage **40/52**, **12 remaining**. Small badger/mole anatomy and exact horn roots remain screen-scale-limited, without demonstrated gross detachment. Whole-world and release gates remain open; nothing published.

## Deer and habitat-variant acceptance batch

See `WORLDWIDE-FAUNA-VARIANTS.md`: eight additional deer/habitat variants pass controlled desktop/mobile, original-body, actual HTTP503 fallback and postbuild checks. 877 tests and 304 browser assertions pass. No art/gameplay changes; all 52 fauna assets unchanged. Current coverage **48/52**, **4 remaining**: bonecrow, tideclaw_crab, dusk_owl, field_rat. Fine toad/crawler limb and antler details remain scale-limited. Natural habitats, performance and worldwide release gates remain open. Nothing published.

## Controlled creature catalog closure

See `WORLDWIDE-FAUNA-CATALOG-CLOSURE.md`: final four species pass, bringing controlled coverage to **52/52**. Fresh 877 tests and 156 browser assertions pass; 1980 accepted browser assertions across all seven saved batches. `fauna-catalog-evidence-audit.json` joins every manifest/ledger row to exact candidate/control/failure/built evidence and freshly verifies all52 served assets. No art/gameplay edits in this batch and nothing published. Small-appendage visibility limitations remain. Next bounded work is the planned oak/pine/birch interaction pilot. Natural habitats, complete fauna states, performance and other worldwide release gates remain open.

## Oak / pine / birch runtime pilot

See `WORLDWIDE-TIMBER-PILOT.md`: **3/8 timber species** pass scoped controlled desktop/mobile lifecycle and built-output checks, with **879 tests and 268 fresh browser assertions**. Fixed lingering stumps after sapling planting and stale click bounds on failed-download primitive trees; gameplay rules and GLBs unchanged. Ordinary oak/birch planting checked through real commands; pine small-growth uses an explicit saved-sapling fixture because the current chooser selects oak at their tied threshold. Natural forest/rare gates and performance remain pending. Other five species are tracked in `art/verification/worldwide/timber-acceptance.json`. Local built preview restarted against fresh output; nothing published.

## Willow and ash runtime batch

See `WORLDWIDE-TIMBER-WILLOW-ASH.md`: **5/8 timber species** now have scoped controlled desktop/mobile and built-output checks. **879 tests and 203 fresh browser assertions pass**; no art/runtime edits required and all eight GLBs unchanged. Ash normal planting completes; willow shares pine's tied-threshold chooser limitation and its growth uses a saved sapling. Harness now waits for bounded actual planting completion and clears genuine action effects through normal substeps before captures. Redwood/yew/ghostwood plus natural-forest and performance gates remain open. Nothing published.

## Rare timber visual pass; ghostwood input remains partial

See `WORLDWIDE-TIMBER-RARE.md`: all **8 tree styles** have scoped visual review, with **7 species meeting controlled input/lifecycle acceptance and ghostwood partial**. Fresh **879 tests and 553 browser assertions** passed; 12 assertions intentionally reproduce a touch limitation rather than certify success. Redwood/yew unknown, discovery, extraction and tool gates passed; ghostwood living exclusion and skilled-ghost extraction passed. Desktop ghostwood context action works, but tap/800ms touch hold do not open Chop; fixture-opened mobile menu is not a complete touch path. Existing planted ghostwood menu also incorrectly says Oak while its yield remains ghostwood. Neither issue is claimed fixed. All8 GLBs are unchanged and freshly matched to served build. No application/art changes or publication in this batch. Separate ghostwood UX fixes, natural forests, full animation, performance, characters and buildings remain open.

## Timber UX closure

See `WORLDWIDE-TIMBER-UX.md`: both documented interaction issues are fixed. Actual ghostwood touch hold opens the ordinary menu, its real Chop button harvests correctly, and short taps still walk. Planted names use their planted species with the tile-owned quality ceiling. All eight planted labels have fresh regression coverage; latest desktop/mobile candidate, HTTP503 fallback and built-output runs repeat redwood/yew/ghostwood lifecycle and wild gates. **895 tests and 589 fresh browser assertions pass**. The timber ledger now records **8/8 controlled species cumulatively**, not full-world acceptance or a fresh all-eight browser rerun. All eight GLBs remain unchanged and matched to served build. Native menu captures pass framing/readability; an existing mobile ghost-banner/minimap overlap remains outside this fix. Physical-phone testing, natural forests, full animation and performance remain open. Next bounded work: unobstructed worldwide character captures and interaction checks, then buildings. Nothing published.

## Character class/role controlled closure

See `WORLDWIDE-CHARACTERS.md`: **five classes and three service roles** now pass clear desktop/mobile captures, actual tile-level selection and walking/approach, dialogue, banking, shop purchase and living healing, plus prescribed-path NPC render following. Original-body policy, actual failed-download fallback and source-free built checks pass. **895 tests and 767 fresh browser assertions**; all64 mode/device/case records audited. All289 existing checkpointed application/source/package/character-asset files remain unchanged. Fine-detail visibility and shared role costumes are disclosed; natural NPC AI/placements, all player/ghost/equipment/action states, performance and physical phones remain open. Full-person parity was not established because only warm-up-inherited hunger/energy differed; movement/render fields matched. Next bounded work: worldwide building doors/interiors/cutaways and interactions. Nothing published.

## Enterable architecture and chest UX closure

See `WORLDWIDE-BUILDING-HOMES.md`: **seven new enterable kinds** (shop, townhome, townhouse, cottage, porch, hut, homestead) pass controlled desktop/mobile exterior, real entry/exit, original-interior cutaway and restoration, actual failed-download fallback and built-output checks. Fixed touch-only house chest entry and stale paused chest contents; fractional nearby entity priority is preserved. **907 canonical tests**, **1,500 building assertions across the accepted seven-kind + final three-house priority batches**, plus150 ghostwood regression assertions. Whole exterior captures and original interiors reviewed; furniture still obscures some player anatomy. GLBs/Blender source, canonical building specs and gameplay transfer/ownership rules unchanged. Latest local built preview refreshed and checked; nothing published. Next: fortifications, keep/remaining global building coverage; the inherited invalid-colored legal deed preview is explicitly pending. Natural scenes, construction/body collision, full state matrices, performance and physical phones remain open.

## Deed shade and paused insertion closure

`WORLDWIDE-HOUSE-SHADE.md` supersedes the open deed-preview colour item above. All three deed kinds now use the correct existing house predicate, with stationary valid/invalid shade updates. New buildings also mount while paused rather than waiting for walking. **916 tests and282 fresh accepted browser assertions** pass across candidate, real-GLB-failure and source-free built modes, desktop/genuine touch. Built colour/placement crops reviewed;96 checkpointed GLB/editable-source assets unchanged. Existing rules/costs unchanged, local preview updated, nothing published.

Scope remains controlled: other-owner bootstrap blockers prevent the automatic free hut in disposable worlds; terrain is unchanged. A separate low-tick loaded-review-save ID collision (`b-27` reused by placeHouse) was retained, not fixed; QA's counter adjustment isolates display checks and is not runtime acceptance. This issue and fortification/keep/global-building coverage remain pending. Foliage/UI obscure some body parts; no complete animation, collision, performance or physical-phone acceptance.

## Loaded-save entity ID collision closure

`WORLDWIDE-HOUSE-IDS.md` supersedes the open new-building ID-collision item above. The shared allocator now retries exact occupied live IDs, preserving existing IDs, tickCount, saved schema, ownership and charges. Actual low-tick browser red retained (`b-27` rampartV/porch collision); all three deed kinds now pass real desktop/touch placement, canonical autosave, fresh-context reload and exact chest retrieval. **937 tests and 540 accepted browser assertions** pass; current built output is checked at unadjusted tick23, while candidate/failure fixtures retain tick24. The 96 checkpointed art assets are unchanged.

This closes prevention of new live-entity collisions, not repair of already-corrupted saves. Fixtures still supply starter inventory/deeds, block free-hut bootstrap and relocate the body; walking/natural housing/full construction/collision/animation/performance/physical phones remain separate. Chest captures expose header/control and toast overlap, retained as a UI-clarity follow-up. Four fortifications, keep and other worldwide architecture acceptance remain pending. Current local preview updated; nothing published.

## Chest panel clearance closure

`WORLDWIDE-HOUSE-CLEARANCE.md` supersedes the chest header/control and notification-overlap follow-up above. Three house kinds now have viewport-bounded panels, fixed heading/feedback/Close, useful landscape content space and single-column narrow-phone lists. Other primary panels temporarily take precedence without clearing the chest ID; notification routing follows the same visibility rule. The mini-map can intentionally sit behind the chest on narrow screens, and is usable after Close.

**950 tests and 2,034 accepted browser assertions pass:** 1,684 final candidate/built clearance checks across24 unique cases, plus350 renewed desktop/touch placement/autosave/reload/chest-ID checks across12 cases. Actual native scrolling, full-chest rejection, five other-panel entry/exit flows and HUD status-row stress are covered. Fresh built HTML-linked assets match local output. Final built headings, entire multiline status and Close are visually reviewed across all four viewports. Canonical gameplay/save source is unchanged.

Ordinary tooltips and scrolled/clipped/truncated item rows remain outside the fixed-region guarantee; Pets priority is state-tested only. Natural placement/AI, full animation, construction/collision, fortifications/keep/global-building coverage, performance and physical phones remain pending. **Local only; nothing published.**

## Four-fortification controlled closure

`WORLDWIDE-FORTIFICATIONS.md` closes the bounded render/input checks for rampart, rampartV, tower and gatehouse. **808 accepted browser assertions** cover32 four-mode fortification cases plus8 existing-city supplements. Exact foundation/proxy multisets, original/failure restoration, active-path captures and cross-mode movement/record equality are verified. The existing loaded west passage works, and an adjacent wall-crossing command detours through the gate with legal smoothed path segments, while local terrain/building hashes remain unchanged. This does not promote flat render fixtures to physical wall-collision or all-world acceptance.

The canonical suite passed950 tests, and typecheck/lint/build/auth/diff plus4 focused architecture tests passed. **A separate focused city-route test failed**; fixed seed2469134 reproduces no route from `(176,336)` to `(140,336)` at caps4000/20000 despite a working local gate passage. This generated-route counterexample remains unresolved; no test was weakened or gameplay/terrain changed. All410 source/package/art checkpoint entries, including114 GLB/Blend assets, remain unchanged. Built assets and complete desktop/mobile structures were verified; player occlusion inside the real city gate and small passage detail remain limitations.

Keep/story and earlier worldwide-kit coverage, generated-route correctness, broader natural placement/AI/construction/collision, complete animation, performance and physical phones remain open. Local built preview verified; **no application/art edits or publication in this slice.**


## City-route assertion resolved — test-only

The fortification follow-up is closed by correcting its test, not by changing gameplay. Exact seed2469134 makes old target140336 an isolated off-road tree tile; actual road140328 and Millcross96300 are reachable. The deterministic test now verifies those routes and keeps the old destination as a required rejection, preserving search caps and movement rules.

952 full tests and156 fresh dev/built browser assertions pass. Native ground taps reach the road; the existing mini-map returns to Kingsford. A tree-occluded ground-return attempt remains recorded, not declared fixed. Terrain/building records and movement tracks match across dev/built; early weather-toast timing differs. All114 checkpointed GLB/Blend files and runtime source remain unchanged. Nothing published or visually changed.

See `art/WORLDWIDE-CITY-ROUTE.md` and `art/verification/worldwide/city-route-acceptance.json`. This supersedes the older pending seed-route finding above. Keep stories are next; broad natural-world/road continuity, animation, collision/construction, performance and physical-phone acceptance remain open.


## Retained keep — ceiling fix verified, interaction acceptance partial

`WORLDWIDE-KEEP.md` records a real visibility fix: the next timber floor no longer covers the player on the occupied story. Original walls, stairs, occupied/lower floors and exterior geometry remain. Only three renderer lines plus an appended regression changed from this slice's source checkpoint; all114 GLB/Blend assets and all gameplay/save/camera source remain unchanged.

**953 canonical tests,14 focused tests and828 accepted browser assertions pass**, across candidate/original-policy/actual surrounding-art rejection/built output, desktop and genuine Chromium touch. The20-leg route covers south entry, all four story plateaus, north ascent, south descent and exit on unchanged canonical city terrain. Exact movement/terrain/building parity and original exterior restoration are audited. Final built player visibility was reviewed on every story; four served JS/CSS assets match current output.

**Full keep acceptance is not closed.** Ground-projected mouse/touch traversal works, but clicking a ray-confirmed visible upper deck at181320 commands175314; raised-floor picking still falls through to ground. Original floor-top/player-root seating also remains unresolved. Fix those seams before calling the keep fully usable. General camera visibility, full animation, natural actors, construction/collision, earlier worldwide kits, performance, physical phones and public release remain separate. Local built preview changed inside the keep only; nothing published.


## Retained keep — visible-floor pointers fixed, lower stairs still partial

`WORLDWIDE-KEEP-PICKING.md` supersedes the raised-floor picking failure above. Actual surface181320 now commands181320 rather than175314 in desktop/touch candidate, real art-rejection and fresh built runs; the original-pointer control still reproduces175314. The minimal inside-keep handler delegates to the existing action/navigation policy. Original art, terrain, camera, save and story code remain unchanged.

**962 full tests,23 focused tests,620 corrected-mode browser checks plus208 original-control checks pass.** All four floor targets and upward stairs are exercised by real mouse/touch. The bounded19-leg route descends3→2→1 and then uses the native mini-map to exit: tower/deck occlusion still prevents acceptance of direct lower-stair tapping. Failed full-route attempts remain recorded; they are not relabeled passes. Floor/root seating also remains unresolved.

Four fresh built JS/CSS assets match local bytes, and desktop/mobile built rendering is checked. Current phase: visible-surface dispatch verified, full keep acceptance partial. Next: lower-stair occlusion/input, then seating. Local preview updated; nothing published. Details, preservation proof, exact state differences and limits are in `art/verification/worldwide/keep-picking-audit.json`.
