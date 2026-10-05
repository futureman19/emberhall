# Candidate vs current runtime contract

Coordinates in this document are **game/glTF X,Y-up,Z**. Blender stores `(x,-z,y)`. Both the actual authored current character and the proposals face local **−Z**. Current player heading uses `atan2(dx,dz)` (+Z), so an eventual integration must retain the existing `playerVisualYaw` +π correction, including initial and live updates; it must not alter simulation facing or individually rotate tools.

## Inspected current implementation

- `src/game/look/figure.ts`: authoritative FIGURE and HAIR dimensions and positions.
- `src/components/game/authored-character-data.ts`: clones named geometry, applies `matrixWorld`, disposes imported materials and reuses extracted geometry.
- `authored-character.tsx`: adds face features and V seams outside the imported GLB.
- `people-meshes.tsx`: the actual player renderer, shoulder refs (`left`, `right`), held-tool ref, gear colors/attachments, bob, facing, numerous action poses and ghost behavior.
- `look-preview.tsx`: creator mirror uses those same named body dimensions, plus an idle arm pose and shared authored parts.
- `src/game/look/catalog.ts` and `resolve.ts`: default look, swatches, style IDs and appearance resolution.
- Existing `art/blender/build_character.py`, saved `character.blend`, and actual `public/art/lanternwood/character.glb`.

Frozen copies used for reconstruction are in `baseline-reference/`; these are reference inputs, not modifications to the originals.

## Anchor comparison

| Element | Current game contract | Candidate | Status |
|---|---|---|---|
| Root | Ground origin; live visual yaw +π | Ground origin; local front −Z | Static ground/facing conventions retained |
| Head | Mesh anchor `(0,.88,0)`; face added locally | Named `{id}_head` empty `(0,.88,0)`, all face/hair children | Anchor retained; geometry/material organization changed |
| Arm L/R | Group `(-/+.32,.52,0)`; sleeve child `(0,-.10,0)`; hand child `(0,-.26,0)` | `{id}_arm_L/R` empties at same groups; asymmetric absolute assembled geometry converted to local parent coordinates | Actual rigid rotation tested; animation compatibility NOT established |
| Torso | Centered `torso` geometry at `(0,.48,0)` | Separate tunic/hem/collar/strap/scarf/toggles at assembled coordinates | Adapter/splitting required |
| Hands | One centered `hand` geometry, reused twice; tool refs live under shoulders | Named left/right palms, thumbs and knuckles | Grip alignment and all tool offsets untested |
| Legs | Centered `leg`, reused at `±.11,.19,0` | Independent trouser meshes at approximately `±.115` | Not current geometry contract |
| Feet | Centered `foot`, reused at `±.11,.04,.02` | Independent shaped boots, cuffs, soles and stitches | Ground proof only; not current geometry contract |
| Hair | `hair_cap`, `hair_shagSide`, `hair_shagFront`, `hair_tail`, `hair_long` with fixed style switch | Distinct fitted crowns, swept/cropped locks, braid chunks | Three authored looks, not all legacy style substitutions |
| Gear | `cloak`, `helm`, `hood`, `belt` plus live equipment and custom voxel parts | Decorative satchel/belt/mantle and a clearly unvalidated preview equipment marker | No runtime equipment mapping |
| Materials | Runtime skin/garb/hair/gear/ghost overrides; old GLB materials discarded | Named per-feature palette materials, including fixed eyes/hardware | Recolor masks/material-routing design still needed |

Current extracted names are exactly:
`head`, `torso`, `arm`, `hand`, `leg`, `foot`, `cloak`, `helm`, `hood`, `belt`, `hair_cap`, `hair_shagSide`, `hair_shagFront`, `hair_tail`, `hair_long`.

The candidate deliberately does **not** impersonate this contract with misleading names. `{id}_head` is an empty, not the old centered head mesh. It cannot be inserted into the existing extractor unchanged.

## Scope of the articulation study

The gallery rotates the candidate's rigid right-shoulder group by −0.8 radians around local X. Source and GLTFLoader checks verify child hand movement; browser checks verify the actual displayed node rotation. Soles stay grounded and there is no fake whole-character bob called a walk cycle. This is a limited joint/parenting study—not a gait, blend-tree, animation-retargeting, tool-use, mesh-deformation or in-game-action proof.

## If a design is approved later

Keep the current simulation, refs, action groups, material semantics and +π yaw. Author explicit per-part centered exports/adapters or a deliberately approved new renderer; bake loaded world transforms before extracting geometry. Share the approved path with the creator. Then verify every appearance/equipment/ghost/fallback category, actual live movement-facing parity, joint intersections throughout full action ranges and normal-camera desktop/mobile gameplay. Budget and measure performance separately. None of that integration is performed by this review pack.
