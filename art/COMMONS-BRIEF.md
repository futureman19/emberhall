# Commons batch — dormitory, yard and farm

User approved hospitality preview and requested continuation. Parent a7a3d39; feature/emberhall-dormitory-yard-farm. No reset or original-workspace edits. Existing ignored backups/untracked evidence stay untouched. No production promotion or later phases.

## Scope
- Dormitory: long communal timber/plaster house with shaped brown roof, warm windows and restrained red/gold details. Original door, bed records and inside geometry remain authoritative.
- Training yard: low timber/stone perimeter and open gate only; original central stone target remains. No invented training UI or decorative fake enemies.
- Farm: low perimeter and small back tool shelter; original soil beds/crop simulation are unchanged. No decorative harvestable-looking crops, new resources or altered growth rules.
- Routing only existing built kinds within18 of COURT. The existing starting yard is reused; disposable dorm/farm additions require real footprint/footing checks. No normal seed-generation changes.

## Contracts
Original voxel centres are (coordinate+.5)*.5. Dormitory doorway skips x=-1,0 so world opening[-.5,.5]; front wall occupies z[1.5,2]. Farm/yard gate skips x=-1,0,1 so opening[-.5,1],frontz[2.5,3]. Assets must not obstruct these corridors.
Dorm shell disappears on entry to reveal original interior. Yard/farm are open compounds: authored perimeters stay visible on entry, not a vanishing room. Original central target and ALL soil bed voxels (material field `t`) remain visible alongside authored shells; old perimeters/shed stay as invisible pick proxies. Fallback retains full original art if load fails. All decor uses no-op raycast and shared resource clones.

## Authoring and cost
Editable named Blender parts saved before export-only joining/vertex-color bake. <=2 runtime/export materials per GLB from the first export; source .blend deliberately retains separate editable palette materials and live modifiers. Each GLB <=600KB and <=12000 triangles, finite Y-up geometry, grounded pivot, no dynamic lights. Door/gate rays test effective world openings. Source function-scoped door tests avoid matching unrelated buildings.

## Verification and review
Original and candidate use same disposable save/clock/weather/viewport, six180-frame samples on available RTX4060, serialized browser work. Relative ceilings: p95<=1.20x, draws<=1.10x, triangles<=1.15x, renderer geometries<=1.10x, heap<=1.20x. These are not an absolute60FPS or lower-end-PC acceptance claim. Prior global and hospitality failures remain open; visual approval does not waive them. No retry-until-green measurements.
Test actual available movement/picking/crop/bed actions; non-station buildings must not spuriously open crafting. Document unavailable interactions rather than inventing tests. Inspect paired desktop/mobile exteriors and entry states, preserve forest occlusion and existing HUD issue. Run full game tests, lint/typecheck/build/auth; compare exact baseline script failures. Independent source review and deployed preview/hash/gameplay proof precede delivery.

Stop after this batch for user review. Mobile HUD repair, boards/signage, interior props and later phases remain separate.
