# Phase 1 — starting-settlement interior prop kit

Script-authored low-poly furniture, not hand-sculpted art. Editable source: `blender/interiors-kit.blend`; regenerate with `build_interiors.py` (overwrites manual edits). Eight collections retain individual named palette parts and live bevel modifiers; export copies alone are joined and vertex-color baked. One opaque material and one mesh per GLB. No textures, lights, cameras, or animations.

## Exact integration contract

`interiorKitName(kind, tx, ty)` in `src/components/game/interior-kit.ts` returns `interior-hall`, `interior-dormitory`, `interior-kitchen`, `interior-yard`, `interior-market`, `interior-forge`, `interior-tavern`, or `interior-bank`, only within radius 18 of COURT. Other kinds and nonfinite positions return null. Load `/art/lanternwood/${name}.glb`.

Place at `[building.tx, groundY(world, building.tx, building.ty), building.ty]`, identity rotation and scale. Floor top **0.5 is already authored**: do not add another 0.5. Original voxel centers are `(v + 0.5) * 0.5`; Blender mapping is `(gameX, -gameZ, gameY)` before Y-up export. Market counter correctly centers at local Z=0.25, unlike the shared house table's Z=0.

`replaceInteriorVoxel(kind, voxel)` matches exact original furniture coordinates AND material `t`, excluding floor and cutaway voxels. Use only after an asset successfully loads. Keep original matched voxels as invisible pick proxies (`colorWrite=false`, `depthWrite=false`, no shadows), with original handlers and instance maps. New prop meshes must have no-op raycasts. Cache shared geometry/materials, clone objects per placement, `dispose={null}`. On load failure keep original visible furniture. This worker did not modify renderer/loader; parent owns integration and live cutaway/picking QA. Original floors, walls, doors, exterior kits and simulation remain untouched.

## All starting kinds

| Actual kind | Authored coverage / retained behavior                                | Replaced cells |
| ----------- | -------------------------------------------------------------------- | -------------: |
| hall        | Planked trestle table, pegged stretcher, tally dish                  |              7 |
| dormitory   | Shared-house trestle table/dish                                      |              7 |
| kitchen     | Table/dish, stone-cheek ash pan with charred billets                 |              9 |
| yard        | Compact tapered-stump iron crafting station at original stone target |              2 |
| market      | Paneled counter with separate planks and tally dish                  |             16 |
| forge       | Banked hearth and wedge-horn anvil on stump                          |              3 |
| tavern      | Table/dish and existing chimney-foot hearth                          |              9 |
| bank        | Strapped tally table, two original gold-cell dishes                  |              8 |
| farm        | Retained original soil beds; no authoritative interior furniture     |              0 |
| notice      | Excluded: external sign worker owns it                               |              0 |
| board       | Excluded: external sign worker owns it                               |              0 |

These are actual BuildingKind IDs, not invented saved-building IDs. Existing `house()` and each requested original make-function were inspected. All TSX files were searched for beds/mattress/pillow: there is **no separate sleeping-bed renderer** in this checkout. `world.ts` holds logical occupant slots only. The `bed` mesh in `world-scene.tsx` is a tilling effect, not sleeping furniture. Therefore no guessed beds, bed anchors, sleep UI, harvestables, or extra furniture in corridors were added. Benches were not invented where the source has only a central table/station. Logical beds and their ownership remain untouched.

## Verification

- Actual GLTFLoader asset test first failed ENOENT for missing interior-hall.glb: `verification/interiors-author/assets-red.log`.
- Final tests: **3 pass, 0 fail**, `tests-final.log`. Tests evaluate the actual original generator with TypeScript transpilation (ES2022), asserting exact replacement counts for all eleven kinds; reject floor/cutaway and wrong materials; test routes and half-cell mapping.
- GLTFLoader measures finite vertices, real world bounds, one mesh/material, vertex colors, no animations, floor contact within floating-point tolerance and occupied footprint limits. CLI writes `public/art/lanternwood/interiors-manifest.json`; test independently reloads and compares its full measurements.
- Independent Blender process reopened source and verified named editable parts/modifiers: `source-reopen.json` and `reopen-final.log`.
- Initial verification found a test harness downlevel-Map issue and an overly strict source-part minimum for the five-part yard station; corrected harness to ES2022 and minimum to five, retaining raw logs. Market was adjusted to its correct half-cell Z center before final export.
- `.grok/skills/building-games/SKILL.md` is absent in this checkout; root AGENTS and available Blender skill read.

Scope gaps: no shared renderer changes, browser, performance, deployment or production acceptance. No Phase 2 work. Parent must integrate, ensure no duplicate fallback visuals, and verify live cutaways, picking and original actions. Source collections overlap at their correct building-local coordinates: isolate one collection for editing rather than expecting a presentation lineup.
