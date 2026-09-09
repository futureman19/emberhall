# Commons batch verification

## Scope
Phase1 dormitory/yard/farm presentation only, parent a7a3d39. All53 previous saved buildings unchanged; only2 disposable additions (dormitory267,284 and farm269,304). Original yard248,291 reused. All nonbuilding saved records remain byte-equivalent as JSON. Real footprint and underlying footing checks accepted adjusted fixture positions; normal seed generation is untouched. No simulation, training, crop, resource, camera, streaming or HUD behavior changes.

## Actual assets
Dormitory218396bytes/3184triangles/2materials; yard159880bytes/2146triangles/1material; farm271764bytes/3988triangles/1material. All actual GLBs parsed with GLTFLoader.7 asset/helper tests passed, including source-function-specific original doorway and gate assertions, finite geometry, bounds, palette and unobstructed corridors. Independent Blender5.2.1 source reopen confirmed134/53/151 named editable parts, upward roof normals and retained live curves/bevels. Export-only vertex color batching preserves editable source parts; regeneration overwrites manual edits.

## Local runtime
Original baseline67 checks passed; authored candidate74 checks passed including6 relative performance comparisons. Same fixture SHA256, stable per-scene noon/clear state, desktop1440x960 and portrait390x844. Original proxy pointer checks passed. Dormitory roof/shell cuts away to original interior; yard/farm compounds remain present on entry with retained central target and all original soil beds. A source check corrected material-property naming to original voxel.t before integration.
Yard is an EXISTING bench crafting station (not a new training UI): real pointer opens its existing crafting UI. Dormitory has original two unassigned bed records; no rest-UI proof asserted. Farm has no synthetic crops/resources/plant-harvest proof: original beds and saved plot state are preserved. Do not label unchanged placement/entry as farming or sleep gameplay verification.
The first separate live-compatible local harness wrongly expected no crafting at yard; corrected that test to the actual station contract, without runtime edits. A subsequent dev-harness run hit a navigation/context-destroyed error. Final deployed verification is recorded separately; neither failed attempt is marked green.

## Performance limits
Parent independently recomputed all6 comparisons from raw baseline and candidate; all p95/draw/triangle/geometry/heap relative ceilings passed. Candidate p95: desktop dorm50ms, yard33.4ms, farm33.4ms; portrait dorm33.4ms, yard49.9ms, farm50ms. Actual RTX4060/D3D11,180 frames per sample. Heap is browser-reported/coarsely quantized, not a memory-leak certification. Portrait viewport is not a physical low-end phone. No60FPS or global acceptance claim; prior global and hospitality failures remain unresolved. Do not infer their clearance from this local batch.
The inherited baseline/candidate `releaseGate` text contained stale prior counts; parent gate results and this report are authoritative. Harness wording was corrected without rewriting raw measured runs.

## Gates, source review and deployment
Lint, typecheck, build and actual8093 auth invariant passed. Initial harness lint warnings were unused copied helpers, removed. Two initial source-regex test failures were resolved by keeping the original closed-room predicate explicit and OR-ing only the open-compound exception; no existing assertions were weakened. The final full game run passed541/542, failing city.test.ts:39 (`a road out the west gate`). A focused rerun passed all3 city tests. No src/game files differ from a7a3d39. This is an observed intermittent failure, not a fully green suite or a claim its cause is fixed. Full npm test retains exactly the same12 named baseline script failures, verified by set comparison.

Independent source-spec re-review passed and bounded quality review found no critical blocker after correcting copied launcher text/fixture validation and clarifying that the2-material limit applies to runtime GLBs, not editable Blender palette materials. Actual .blend reopen independently verifies what asset-test manifest flags alone cannot.

Exact deployment: https://emberhall-vale-qxsgrhthc-andrews-projects-ffe8a9fd.vercel.app/art/commons-preview.html . Independent Vercel inspect reports Preview/Ready. Launcher save backup and restoration passed.39 live checks passed on that URL, including real terrain click walking, doorway/gate entry/exit, existing yard bench UI, and player inventory/resource preservation around pointer actions. No sleep, training or plant/harvest action proof is asserted.11 deployed asset hashes match current/approved local GLBs.

All3 paired desktop/mobile entry-state comparisons were visually inspected. Dorm roof removal and retained interior are visible; yard/farm perimeters remain, with original stone target and bare beds. Existing forest obscures doors/fence stretches, retained soil beds look blocky, and mobile minimap overlaps toolbar. These are unresolved presentation limitations; no trees/camera/old props were changed to hide them. Current styles and transitions are reviewable, not globally approved.

Ledger:3117 assets and4994 states. Production, original workspace and later phases untouched. Stop after this review batch. Prior performance gates and the intermittent city test remain open.
