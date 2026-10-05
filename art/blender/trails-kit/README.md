# Emberhall — Wild Frontiers II: Trails & Transitions

Original deterministic script-authored art for **future** expansion. This is a separate library, not a map update. Existing landscape kit, game source and package.json are preserved byte-for-byte (404 baseline files checked; scope-verification.json).

## Assets

**Terrain (6)**: Tumbled Foothill / scree-slope; Thawline Bank / snowmelt-bank; Siltwater Edge / muddy-bank; Meadow Fringe / grassy-verge; Ashfall Margin / ash-apron; Cooled Lava Tongue / cooling-crust.

**Crossings (4)**: Fenway Boardwalk / boardwalk-straight; Fenway Return / boardwalk-corner; Old Trunk Crossing / fallen-log; Shallow Ford / stepping-stones.

**Landmarks (4)**: Wayfarer Cairn / trail-cairn; Forkroad Sign / guidepost; Forgotten Threshold / ruined-arch; Quiet Camp / abandoned-camp.

14 GLBs; **246 named editable mesh parts** in 14 Blender collections. One shared matte vertex-palette material per GLB. Cooling crust and spent campfire are deliberately non-emissive. Canvas is opaque with modeled open tent ends; no cloth simulation. Guidepost arrows are intentionally blank for later regional lettering.

Measured total: **679,304 GLB bytes; 6,904 triangles; 14 material draw primitives** for one of each asset. These are inventory counts, not FPS or a production performance budget.

## Files and viewing

- Editable source: `art/blender/trails-kit/emberhall-trails.blend`
- Primitive/export/render pipeline: `art/blender/trails-kit/build_trails.py`
- Original geometry designs: `art/blender/trails-kit/designs.py`
- GLBs + manifest + gallery: `public/art/trails-kit/`
- Rendered field guide: `art/verification/trails-kit/contact-sheet.png`
- Regional plates: `terrain-closeup.jpg`, `crossings-closeup.jpg`, `landmarks-closeup.jpg` in the verification directory.
- Complete source/public/evidence archive: `art/verification/trails-kit/emberhall-trails-kit-source.zip`

The Blender file has all assets at the same local origin and only the first collection viewport-visible. Toggle collection monitor/render icons in the Outliner to edit another asset. Named parts and palette attributes remain editable. Blender source is Z-up; standard exported glTF is Y-up with ground pivot. No presentation lineup translations are baked into GLBs.

The gallery is standalone static HTML/JS with locally vendored Three.js (license included); no CDN or app build required. Serve over HTTP rather than opening file://. From repository root:

```sh
"C:/Program Files/nodejs/node.exe" art/blender/trails-kit/serve.mjs
```

Then open http://127.0.0.1:8188/. `PORT` overrides the default. The server serves only the public trails-kit directory. No server startup, game integration, deployment or commit is part of this delivery.

## Verified

- Actual Three.js GLTFLoader parses every binary; IDs, finite vertices/normals/colors, nonzero bounds, ground pivots, palette variation, non-emissive materials, triangle counts and SHA256 hashes are asserted against measured manifest data.
- Saved Blender source independently reopened; collection membership, editable part counts, grounding and colors checked.
- Corner boardwalk refined after visual review. Independent source test checks all 22 deck planks have level tops, no planar overlap, and a roughly 0.01-unit joining seam. Original failing test log and pre-fix image are retained. This validates art geometry only, not traversal.
- Desktop 1440×1050 and mobile-emulated 390×844 browsers load every GLB. Selection, family filtering, rotation toggle, pointer/touch drag input, reset and downloaded GLB SHA256 checked; no console/page/HTTP errors or horizontal overflow. Emulated mobile is not physical-device performance testing.
- Final contact sheet, corrected boardwalk junction, desktop and mobile gallery visually reviewed. Arch opening and camp silhouette read clearly.
- Preservation hashes prove all 404 baseline files unchanged: existing src, package.json and complete first-kit directories.
- Delivery ZIP is reopened, CRC checked and every contained file hash checked. Backups and self-archive are excluded.

Reports: `geometry-verification.json`, `source-verification.json`, `browser-verification.json`, `scope-verification.json`, `delivery-inventory.json` under `art/verification/trails-kit/`.

## Regeneration

**This overwrites this kit's .blend, GLBs, thumbnails and measured manifest. Back up manual changes first.** The generator uses a local copy of the first kit's geometry helpers; it does not execute or write into the original kit. Run commands from repository root:

```sh
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background --factory-startup --python-exit-code 1 --python art/blender/trails-kit/build_trails.py
"C:/Program Files/nodejs/node.exe" art/blender/trails-kit/verify.mjs --measure
"C:/Program Files/nodejs/node.exe" art/blender/trails-kit/verify.mjs
python art/blender/trails-kit/package_gallery.py
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background art/blender/trails-kit/emberhall-trails.blend --python-exit-code 1 --python art/blender/trails-kit/verify_source.py
"C:/Program Files/nodejs/node.exe" art/blender/trails-kit/browser_verify.mjs
python art/blender/trails-kit/package_delivery.py
```

Pillow is needed for the field guide; installed Three.js and Playwright/Chromium are needed for measurement/browser tests. Browser tests use an ephemeral server and close it after testing. Use native node.exe here rather than the Windows bash node shim.

## Integration boundaries

- Art only: no navigation surfaces, collision meshes, terrain modification, saved-world changes, damage, harvesting, loot, NPCs or campsite interactions.
- Ground units and footprint metadata are provisional, not authoritative tile occupancy. Crossings do not make water traversable.
- Boardwalks have 0.68-unit deck tops in source coordinates. Butt joints are decorative and not certified grid sockets. Validate alignments, endpoints, clearance and slope against the eventual placement system.
- Terrain aprons are overlap/blend props, not seamless watertight terrain tiles. Bank strips are intended to repeat/overlap with deliberate ground placement; floating on uneven terrain remains an integration concern.
- The fallen trunk's tread pieces are visual stepping surfaces, not collision. Stepping-stone spacing needs scale and movement-design approval.
- The arch has a genuine visual opening but has no runtime portal/collision behavior. Any ruin entrance, sign interaction or camp function requires separate gameplay work.
- Add instancing, caching, culling, LOD and target-device performance testing during future integration. Counts alone establish none of these.
