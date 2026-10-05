# Reedwake Crossing — Emberhall landmark collection 07

Original deterministic script-authored low-poly artwork: a wrecked shallow river ferry and abandoned landing. No copied game assets. Eight reusable modules and one assembled landmark; standalone locally vendored Three.js gallery. Nothing is integrated or deployed into Emberhall.

## Contents

- `emberhall-reedwake.blend`: nine named editable collections at local ground origin, one initially visible. Blender 5.2.1 LTS. Toggle collection visibility to inspect another module; they deliberately overlap at origin rather than forming an export-offset lineup.
- `build_crossing.py` + `designs.py`: complete deterministic generator. Regeneration overwrites generated exports, images, measured manifest and manual `.blend` changes.
- `../../../public/art/river-ferry/`: nine Y-up GLBs, measured `manifest.json`, Y-up `layout.json`, preview PNGs, contact sheet, `index.html`, `gallery.js`, local Three.js dependencies and license.
- `../../verification/river-ferry/`: source renders, hero/contact sheet, desktop/mobile gallery screenshots, machine-readable audits, raw logs, scope snapshot and hash-verified delivery archive.

Modules: Wrecked River Ferry; Weathered Dock; Broken Landing End; Roped Mooring Posts; Abandoned Hauling Winch; Ferry Sign and Lantern; Washed-up Cargo; Reeds and Driftwood.

## Scene and removability

The assembly uses 12 unscaled module instances. `layout.json` records translation, yaw and scale in Y-up coordinates. Saved-source vertex comparisons prove these transforms against all source module vertices.

42 assembly-only editable dressing parts are explicitly listed by family in the layout: opaque water slab, raised riverbank polygon, silt shoal, six wet shoreline lip beams, sixteen moss patches, twelve static water strokes and five access ramp planks. The layout alone does **not** reconstruct those parts; the full recipe is `assembly()` in `designs.py`.

To remove the diorama base, delete/hide the named presentation water, land, shoal, shoreline, moss and water-stroke parts in the assembly collection and export selected remaining geometry. The five access ramp planks are also assembly-only, optional dressing. Individual GLBs do not include the assembly base/water. Gallery's dark circular display plinth is viewer-only and not exported.

The ferry is deliberately broken/open, not watertight or operable. A clear gap separates it from the broken dock. The hauling rope is wound on an abandoned winch with a loose end, not an active cross-river cable. One rope-post pair is on the bank and one is intentionally deck-mounted. The lantern is unlit/non-emissive. Water is opaque static presentation geometry, not a water shader or gameplay surface.

## Reproduce (repo root; Windows Git Bash)

```sh
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background --factory-startup --python-exit-code 1 --python art/blender/river-ferry/build_crossing.py
"C:/Program Files/nodejs/node.exe" art/blender/river-ferry/verify.mjs --measure
"C:/Program Files/nodejs/node.exe" art/blender/river-ferry/verify.mjs
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background art/blender/river-ferry/emberhall-reedwake.blend --python-exit-code 1 --python art/blender/river-ferry/verify_source.py --python art/blender/river-ferry/verify_assembly.py --python art/blender/river-ferry/verify_structure.py
python art/blender/river-ferry/package_gallery.py
"C:/Program Files/nodejs/node.exe" art/blender/river-ferry/browser_verify.mjs
python art/blender/river-ferry/verify_scope.py
python art/blender/river-ferry/package_delivery.py
```

Requires installed Three.js and Playwright for verification, Pillow for presentation packaging, and the Windows Georgia/Segoe UI fonts. The delivered browser gallery itself has no CDN or network dependency; serve via HTTP rather than `file://`. Optional local inspection: `node art/blender/river-ferry/serve.mjs` (loopback, default 8190); stop it afterward. Automated browser QA creates its own temporary random-port server and closes it in `finally`.

## Verification and limits

Real GLTFLoader parsing checks all nine binary exports: measured hashes/bytes/bounds/counts, finite positions/colors/normals, grounded Y-up pivots, palette variation, unit normals and strictly nondegenerate triangles. No gates were relaxed.

Independent Blender reopening checks nine editable collections and colors, all twelve instance vertex transforms, deck-plank non-overlap, support reach, hull rib/strake structure, rope endpoint attachment, cargo and hardware on raised land, and separation from the dock. These are targeted art-geometry contracts, not a comprehensive physical collision solver.

Desktop and mobile Chromium load all nine assets, filter families, toggle rotation, mouse-orbit, touch-orbit on mobile, reset and download a hash-matching GLB. Screenshots are visually reviewed. The renderer reports RTX 4060 / Direct3D11; this is not performance acceptance. ZIP packaging excludes `.blend1`, `.blend2`, Python caches and nested ZIPs, then reads every archived entry back and checks its SHA256.

Scope preservation compares 806 pre-existing files covering `src`, package manifests and all six earlier kits' source/public/evidence. No branch changes, commits, application edits, deployment or persistent server were performed.

Not accepted: map placement, navigation/walkability, collision/physics, flotation, vehicles, rope mechanics, NPCs, quests, gameplay or runtime performance. The simplified waterline can read as a presentation tile, and tiny details are less readable at phone scale.
