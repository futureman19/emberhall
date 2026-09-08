# Blender courtyard kit — first playable asset slice

Preview: https://emberhall-vale-8xm6v7zds-andrews-projects-ffe8a9fd.vercel.app
Deployment: dpl_9VBPkUJzRnecF4u62LvrWW41YzC2 (read back as Preview / Ready).
Branch: feature/emberhall-blender-courtyard. No production promotion or merge.

## Editable source and runtime assets
- `art/blender/lanternwood-kit.blend`: actual Blender 5.2.1 source, named individual parts and editable curve/bevel modifiers; hall and two trees arranged as a kit lineup.
- `art/blender/build_lanternwood.py`: repeatable custom modeling/export script. These are script-authored Blender meshes, not manually sculpted human artwork.
- `public/art/lanternwood/hall.glb`, `tree-0.glb`, `tree-1.glb`: runtime meshes, consolidated into material batches.
- `public/art/lanternwood/manifest.json`: actual export bounds/geometry counts/byte sizes.

Rebuild from repository root:
`"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background --python-exit-code 1 --python art/blender/build_lanternwood.py`

Rebuilding overwrites the source .blend and GLBs. Save manual Blender edits under a different filename before rebuilding. The source lineup offsets are removed from export copies to retain local ground pivots. The script asserts upward roof normals and twin battlements before saving/exporting.

## What changed
The starting hall exterior now uses a continuous bowed chestnut roof, custom shingles, softened walls/towers, stone battlements, curved cloth banners and warm arched windows. Two branching broadleaf variants are used as small non-resource garden trees with deterministic variation. Existing woodland terrain treatment remains. Most forest/resource trees, other buildings, and characters are still the prior art.

Original voxel building meshes remain as invisible picking layers outdoors and visible cutaway presentation indoors. New meshes do not raycast; optional load failure retains original presentation. This fallback is source-reviewed, not network-fault-injection tested. No gameplay, collision, world data, schema, camera or streaming source edits were made in this slice.

## Verification
- Blender export and independent reopen of final .blend: pass; 377 editable objects, 253 roof surfaces with upward normals, 12 front/back battlements (plus side merlons).
- Four new tests parse actual GLBs with Three GLTFLoader, verify bounds/materials/finite vertices and placement/integration contracts.
- 506 game tests pass; lint/typecheck/build/auth-invariant pass.
- Full npm test is NOT green: baseline was rerun before implementation and has 12 pre-existing script failures (184/196 passed). See blender-baseline-test.log and LANTERNWOOD-PREVIEW.md. No tests weakened.
- Local and deployed same-save desktop/day/dusk/mobile Playwright captures: no captured page or shader errors. Final deployed desktop/mobile images visually inspected.
- Deployed all three GLB requests returned HTTP 200.
- Hall-entry and exit through actual useTile + fixed tick simulation arrived at requested coordinates locally and deployed; local inside screenshot confirms roof cutaway.
- Actual mouse click on local candidate produced same walk target/path as prior preview. On deployed check an animal occupied the click target and correctly triggered hunt/movement, so exact live ground-click parity is not claimed.

## Remaining work
Not a completed Tiny Glade-quality world makeover. Interiors retain original voxel appearance; most woodland/other buildings and characters remain unchanged. Existing mobile minimap-toolbar overlap, daylight-floor lighting and dense foreground occlusion remain. No new hardware-performance benchmark or old-device guarantee. Character art, larger forest replacement and more material/junction refinement are later slices.

Evidence: profile `lanternwood-review/blender-before-*`, `blender-final-*`, `blender-live-*`; repo `blender-*.log`.
