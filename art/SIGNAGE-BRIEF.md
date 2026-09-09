# Signage kit — asset-only authoring

Script-authored Blender kit, not manually sculpted artwork. Notice: single softened timber post, mortised frame, uneven parchment, red/gold shield and curved chestnut rain cap. Board: two posts, wide frame, three pinned papers and curved roof. Named editable parts, source palette, live bevels, paper thickness and roof curves remain in the saved source (27 notice / 40 board parts). Export copies alone are joined and palette-baked.

## Anchor contract

Place GLB at `[tx, groundY, ty]`, identity rotation and scale. Y-up, ground pivot `[0,0,0]`; no source lineup offset in exports. Original voxel centers are `(v + .5) * .5`. Enforced occupied envelopes: notice X[-.5,1], Y[0,3], Z[0,1.5]; board X[-1.5,2], Y[0,2], Z[0,1.5]. Board source is vertically fitted to its original shorter height. Geometry is visual only: non-enterable, no station/quest UI. Existing pick proxies, fallback and selector remain parent-owned and untouched.

## Reproduce

From repository root, invoke Blender with `--background --factory-startup --python-exit-code 1 --python art/blender/build_signage.py`. Regeneration overwrites this source and the two GLBs. Run independently with the same command plus `-- --verify` to reopen the saved source and assert named parts, retained curves/bevels, upward roof normals and no lights/cameras/animation.

Run `node scripts/measure-signage.mjs --write` for real GLTFLoader measurements and manifest regeneration, then `node --experimental-strip-types --test src/components/game/signage-assets.test.ts`. The test re-parses both files and compares the measured manifest, finite world vertices, ground/identity pivots, containment within the original occupied envelope, vertex colors, no lights/cameras/animations, <=2 materials, <=2500 triangles and <=150000 bytes per asset.

Evidence: `art/verification/signage-author/`: red.log (actual missing notice GLB), export.log, source-reopen.log, measurements.json, green.log. Initial board export exceeded the byte budget; omitting unused UVs fixed this without lowering the gate. Final measured values and hashes are in `public/art/lanternwood/signage-manifest.json`.

No renderer, simulation, UI, package scripts, Git or deployment changes. No runtime visual/picking/performance acceptance is claimed. Repository-referenced `.grok/skills/building-games/SKILL.md` was unavailable; loaded the installed Blender pipeline skill and read AGENTS.md instead.
