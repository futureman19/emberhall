# Emberhall art contracts — Phase 0, version 1

## Scope and authority

This is a **first-pass source inventory**, not whole-world art completion. Phase 0 creates the ledger, source coverage gate and contracts. The **only subsequent pilot is bank + forge**. This document does not authorize modeling, replacement, integration, deployment, a camera redesign, a mechanics change or any other asset batch. The Phase 0 worker changes only this document, `asset-ledger.json`, `scripts/audit-art-coverage.mjs`, and `src/components/game/art-coverage.test.ts`.

Preserve the accepted reference slices and their existing dirty work:

- `../BLENDER-ART-DIRECTION.md` and `../BLENDER-PREVIEW.md`: original storybook woodland, miniature craft, proud medieval twin-battlement hall, curved brown main roof, red/gold banners and warm inhabited windows. Not pavilion roof caps, copied film assets, or a claim of finished Tiny Glade quality. Hall acceptance was exterior-only; original interior and picking proxies remain.
- `../CHARACTER-PREVIEW.md`: authored **player + Looking Glass**, not all NPCs. Runtime face/collar detail, look colors, five hairstyles, existing equipment/animation anchors and user voxel attachments remain. The prior document explicitly limits tested permutations.
- `../OAK-PREVIEW.md`: canonical/planted **local COURT oak** slice, saplings and authoritative depleted stumps, not the entire resource forest. Local renderer proof and bundled-preview proof are distinct.

Reference acceptance is not silently promoted to every state in this ledger. Known source paths are linked; current geometry metrics, editable-part correspondence, attachment lists and LOD measurements remain `null` until independently inspected. Prior documents are historical evidence, not a new live check.

## Ledger semantics

`asset-ledger.json` is versioned as `phase-0-first-pass/1`, schema 1. Each row has a namespaced canonical ID, family, catalog declarations, source symbol names, renderer locations, runtime/UI file surfaces, state entries, source/export/part/material/attachment/LOD fields, bounds/bytes/triangles/material-slot fields, evidence, lifecycle status and batch owner. A null metric means **unknown**, never zero, free, compliant, or complete.

The total is an **inventory-row count**, not a unique count of modeled objects. Canonical entities, source declarations, named scene props, state vocabulary and renderer helpers are separate families. For example an oak resource, its state-field vocabulary and its renderer are intentionally different rows. Deduplication is by fully namespaced ID; a bank building and a bank UI operation are not the same asset.

Lifecycle values:

| Status                 | Required meaning                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `inventoried`          | Source/catalog/state found; no authoring or runtime claim. This is the default for every generated row and state. |
| `authored`             | Real editable source saved and independently reopened; source/part evidence recorded.                             |
| `integrated`           | Actual export parsed and wired into its identified surfaces; integration evidence recorded.                       |
| `verified`             | Exact named state exercised with real runtime/geometry evidence and `reviewEvidence`.                             |
| `approved`             | Explicit human acceptance of the bounded state/surface, with `reviewEvidence`; cannot be generated.               |
| `retained-by-decision` | Explicit documented decision and `reviewEvidence` to keep original/procedural art. Not an authored replacement.   |
| `blocked`              | Concrete missing source, mapping, acceptance or technical dependency recorded.                                    |

There is no `complete` status. A generic mesh fallback is never an authored asset or completion evidence. State status is independent of asset status. A predicate is an inventoried source condition, not proof of either branch, animation timing, or every cross-product of equipment/weather/camera conditions. States ending `applicability-unreviewed` are explicit questions, not assertions that every item is equipped or every resource has a world node.

## Source coverage contract

Run from the repository root:

```sh
node scripts/audit-art-coverage.mjs
node --experimental-strip-types --test src/components/game/art-coverage.test.ts
```

The gate creates a TypeScript Program using the repo tsconfig and compiler checker. It does not parse union members with regex or execute the game to manufacture IDs. It scans non-test `.ts`/`.tsx` under `src/game` and `src/components/game`, including nested crafting/look/resource files. It collects:

- Literal type aliases, including indexed-access aliases resolved by the checker; object/interface literal field vocabularies (boolean and numeric stages included).
- Actual initializer keys for selected metadata/catalogs, including spread objects and `satisfies`; literal-array IDs through identifiers, `Object.freeze` and spreads. Core aliases and catalogs are cross-checked, including BuildingKind/BUILD_SIZE/BUILDING_META, FaunaKind/FAUNA_META, ItemId/ITEM_META, classes/NPCs, ResourceId/RESOURCE_CATALOG, crops/herbs, craft forms and exact recipes.
- Look swatches/styles, figure/hair/slot definitions, legacy craft recipe IDs, resource forms/grades/traits, tile/biome/weather and animation vocabularies. Type-system vocabulary rows are not additional mesh claims.
- Every top-level component/procedural declaration with JSX, `new THREE.*` or `useFrame`; nonvisual top-level functions are separately labeled `renderer-helper` so procedural builders are not silently omitted.
- JSX tag names, literal JSX `name` attributes, and `if`/ternary predicates. This captures inline world-scene spell/combat/crafting/construction/travel/other effect declarations, sky/weather and game UI surfaces, rather than restricting discovery to files named `*-meshes`.
- Checker-resolved game-symbol consumer locations, plus declared family consumer files. Family links and a file's line 1 are routing evidence only, **not per-ID dispatch proof**.

The check fails on new unmapped catalog IDs, renderers, literal scene names, JSX tag names, state predicates, source symbols or surfaces, duplicate/stale IDs, missing schema fields, invalid statuses, or mismatched required catalogs. The default command is read-only. `--refresh` updates AST routing and adds new inventoried rows/states while preserving existing source metadata, metrics, review evidence and statuses; it refuses to remove reviewed rows/states. Review its diff after runtime changes, then run the read-only gate. Source and renderer line locations are checked and therefore require refresh after line shifts. `--write` bootstraps only an absent ledger. `--write --reset-inventory` deliberately resets all generated statuses; preserve any manually reviewed ledger first. No automatic reset belongs in CI.

### Bounded omissions — not hidden completion

- Consumer links are not a full data-flow proof that each catalog ID has unique geometry. Dispatch and intentional sharing need per-batch manual review.
- Source predicates do not enumerate continuous day/night/cloud/wetness/wind, animation time, all booleans combined, or all equipment/ghost/corpse/cutaway combinations. The full property vocabulary is a review aid, not a Cartesian-product matrix.
- Arbitrary user-authored voxel parts, dynamic object names, runtime-generated meshes, nested anonymous helper identities, shader-internal details and external UI-library implementation are not individually enumerated. Anonymous JSX belongs to its top-level owner; identical literal names within a file are one named-prop row with multiple source locations.
- Catalog builders returning broad index signatures cannot expose concrete keys to the checker alone. Selected literal definition arrays are collected separately; new unrecognized catalog conventions need an extractor update. A passing gate is not a semantic proof of every dynamically built catalog.
- Audio-only implementation and UI outside the two game roots are outside this first-pass art audit. Audio enum vocabulary may appear because it is part of game types; it is not audio-asset acceptance.
- Current .blend/GLB correspondence, editable part counts, materials, bounds, download cost, runtime draw calls, hardware performance and runtime screenshots are not measured by this source gate.

## Coordinate, attachment and runtime safety contracts

1. **Simulation is authoritative.** No identity IDs, saves, yields, growth/depletion, combat/equipment behavior, collision boxes, pathfinding, selection maps or balance changes. Building footprint comes from existing BUILD_SIZE. Keep the current camera and chunk-streaming cadence.
2. **Axes and pivots:** world is Y-up; world `(x,y,z)` maps to Blender `(x,-z,y)`. Export standard Y-up glTF. Remove kit-lineup offsets from export copies. Ground pivots sit at local ground level; finite transforms and measured bounds are required. Do not compensate with unexplained runtime rotations/scales.
3. **Character facing:** local front is `-Z`. Retain only the existing visual-root `+ Math.PI` conversion from simulation heading in initial and live rendering. Do not change simulation heading, rotate individual tools or double-apply conversion. Keep animation refs and body/hand/head attachment anchors. Verify forward against actual traveled displacement, not a requested path destination.
4. **Materials and resources:** small coherent material palette; named editable Blender parts; repeatable scripts may overwrite manual edits, so preserve manual source before regeneration. Save .blend before destructive export joining. Export copies can batch by material. Roof winding and upward normals must be checked, not inferred from a pretty view.
5. **Sharing/lifetime:** cache shared geometry/materials, clone placements, bake glTF node transforms where required, keep `dispose={null}` for shared GPU assets, guard stale async loads. Decorative assets use no-op raycast. Retain original invisible pick meshes (no color/depth writes or shadows as appropriate), original instanceId-to-tile mapping and working load fallback.
6. **Interiors:** keep original visible indoor/cutaway proxies until a dedicated reviewed interior implementation exists. An exterior mesh must not block entry, erase interior visibility, change chest interaction, or capture pointer selection.
7. **Determinism:** visual noise uses independently seeded deterministic art RNG, never gameplay RNG or uncontrolled placement `Math.random`. Trees used as garden decoration are not harvest nodes. Stumps require authoritative depletion plus occupancy constraints. Preserve resource IDs, harvest/regrowth timing and chunk-based invalidation; no player-coordinate terrain rescan regression.

## Bank/forge pilot handoff (not implemented by Phase 0)

Treat `building:bank` and `building:forge` as the only next batch owners. First read their current BUILD_SIZE and SPECS/renderer behavior. Record an explicit editable part/material/attachment plan before creating source. Reference the approved hall's softened masonry, timber, warm openings and restrained heraldry, but retain each building's recognizable bank/forge function. Do not retrofit other buildings, NPCs, items or world forest in this pilot.

For **each** pilot building, review exterior, current interior/cutaway, valid/invalid placement applicability, selection/picking, load fallback, daylight/night/weather readability and desktop/mobile normal-camera framing. Separately verify bank/vault interaction and forge station crafting without changing mechanics. Rows may mark non-applicable states only with reason/evidence; never assume all catalog states apply to all buildings.

Before a later pilot can advance beyond inventory, require actual Blender source reopen/export, actual GLTFLoader parsing, named-part/material/attachment correspondence, finite geometry, grounded Y-up bounds, measured bytes/triangles/material slots and explicit LOD decision. Budget values remain null until measured and agreed; no arbitrary budget is represented as user approval. Run focused tests, typecheck/lint/build as applicable, and real pointer/movement/cutaway plus visual checks at unchanged gameplay camera. Fault-injection evidence must be distinct from source-reviewed fallback. Preserve baseline failures and distinguish local from deployed proof. No deployment or `.blend1` edits are part of this Phase 0 task.
