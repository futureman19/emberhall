# Emberhall — Hearth & Heritage / Collection 03

Eight original script-authored buildings and landmarks for future towns, roads and discoveries. Warm plaster/stone, timber framing, brown curved-profile tiled roofs, red/gold banners and warm-colored windows follow the Emberhall reference direction. **Exterior art library only. No game integration.**

## Collection

Buildings:
- `hearth-cottage` — Hearthside Cottage: chimney, shuttered windows, planter and garden stones.
- `roadside-inn` — The Amber Rest: two-story timber facade, tiled entry canopy, hanging sign and benches.
- `watermill` — Willowbrook Mill: open-rim paddle wheel, outboard axle bearing, raised sluice with trestles and spare millstone.
- `watchtower` — Border Watch: square stone shaft, arrow slits, crenellations, crimson/gold banner and approach steps.

Landmarks:
- `gatehouse` — Twinward Gate: twin crenellated towers, curved brown main roof and physically open central passage.
- `wayside-shrine` — Pilgrim’s Shelter: columned canopy, stepped platform, votive altar and sun medallion.
- `bell-tower` — Evening Bell: open belfry, bronze-colored bell, visible clapper and crown suspension.
- `standing-stones` — The Elder Circle: five irregular megaliths, restrained rune marks and a central offering stone.

## Actual deliverables

- `art/blender/buildings-landmarks/emberhall-buildings.blend`: **917 named editable mesh parts** across eight collections. Assets share local origin; only the first collection is visible initially. Switch collections using the Outliner monitor/render icons. Source studio lights and camera are included.
- `build_buildings.py` + `designs.py`: deterministic primitive/export/render pipeline and original authored geometry. Regeneration replaces generated source/export/render files; preserve manual edits first.
- `public/art/buildings-landmarks/`: eight standard Y-up GLBs, measured manifest, standalone gallery and locally vendored Three.js with its license.
- `art/verification/buildings-landmarks/contact-sheet.png`, `buildings-closeup.jpg`, `landmarks-closeup.jpg`, eight transparent source thumbnails and browser screenshots.
- `art/verification/buildings-landmarks/emberhall-buildings-landmarks-source.zip`: complete source/public/evidence archive, excluding .blend1 backups, with CRC and all-file SHA256 readback verification.

**Measured inventory:** 967,432 total GLB bytes; 12,012 triangles; eight material draw primitives. One shared matte vertex-color material per GLB. Warm windows are colored geometry, **not lights or emissive lighting**. Counts do not establish runtime performance or total renderer draw calls.

## Verification and visual refinements

- All binaries parsed by actual Three.js GLTFLoader; IDs, finite attributes, nondegenerate triangles, color variation, zero lineup translation, Y-up ground pivot, positive bounds, footprint, bytes and hashes checked against manifest.
- Saved Blender source independently reopened: part membership, source grounding, Palette attributes and **392 upward-facing roof tile tops** verified.
- First visual review exposed dark gable triangles. Replaced double-sided planar gables with solid segmented panels. Six sample rays per house/inn/mill now intersect gable infill; final cottage and mill renders visually reviewed as closed/coherent. Original pre-refinement sheet and failing detail test retained.
- Mill sluice raised clear of the wheel by approximately 0.10 source units. Two outboard bearing legs and two sluice trestles added; paddle orientation corrected. Bell crown suspension and shrine devotional detail added.
- Gatehouse has nine clear front-to-back visual rays across a sampled 1.4-unit width and 1.8-unit height. This is **not** a character, collision or pathfinding acceptance test.
- Desktop 1440×1050 and mobile-emulated 390×844 gallery checks load all eight assets, select/filter, toggle rotation, send pointer/touch drags, reset, download a GLB and compare its SHA256. No page/console/HTTP errors or horizontal overflow. Mobile emulation is not physical-phone performance testing.
- **493 existing files preserved byte-for-byte**: game source, package.json and both earlier complete asset-kit directories. No current town, building renderer, map, gameplay, application dependency or live deployment changed.

Evidence JSONs in the verification directory:
`geometry-verification.json`, `source-verification.json`, `detail-verification.json`, `browser-verification.json`, `scope-verification.json`, `delivery-inventory.json`.

## View the gallery

From repository root:

```sh
"C:/Program Files/nodejs/node.exe" art/blender/buildings-landmarks/serve.mjs
```

Open http://127.0.0.1:8189/. `PORT` overrides the port. The launcher serves only this public kit directory. The folder can be independently hosted as ordinary static content; it needs HTTP, not file://. No CDN or app build is required. No server is left running by the verification harness.

## Regenerate and verify

From repository root, with Blender, Pillow, installed Three.js and Playwright/Chromium available:

```sh
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background --factory-startup --python-exit-code 1 --python art/blender/buildings-landmarks/build_buildings.py
"C:/Program Files/nodejs/node.exe" art/blender/buildings-landmarks/verify.mjs --measure
"C:/Program Files/nodejs/node.exe" art/blender/buildings-landmarks/verify.mjs
python art/blender/buildings-landmarks/package_gallery.py
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background art/blender/buildings-landmarks/emberhall-buildings.blend --python-exit-code 1 --python art/blender/buildings-landmarks/verify_source.py
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background art/blender/buildings-landmarks/emberhall-buildings.blend --python-exit-code 1 --python art/blender/buildings-landmarks/verify_details.py
"C:/Program Files/nodejs/node.exe" art/blender/buildings-landmarks/browser_verify.mjs
python art/blender/buildings-landmarks/verify_scope.py
python art/blender/buildings-landmarks/package_delivery.py
```

Measurement is mandatory after export because regeneration replaces the measured manifest. Use native node.exe on this Windows bash host rather than the background-sensitive node shell shim.

## Not included / future integration decisions

- **No interiors or enterable building implementation.** House bodies are exterior masses. Doors/windows are facade art, not openings or interactions. The shrine and gate have visual open space but no gameplay behavior.
- **No roof cutaway controller.** Named roof parts are retained in Blender, while each GLB is joined for efficient material grouping. Integrating cutaways requires a separately specified export/runtime contract.
- No nav meshes, colliders, placement rules, terrain foundations, NPC services, housing state, quests, shrine effects, bells/audio, functioning water or animated wheel.
- Source Z-up exports standard Y-up. Ground units and footprints remain provisional; approve against actual character/tile scale before placement.
- Mill clearance check concerns the static saved pose, not a complete rotating assembly or fluid simulation. The elevated flume has a deliberate connection end for a future waterway; it is not a self-contained river.
- Overlapping timber/stone construction is intentional. Art checks do not certify manifold meshes, watertight shells, arbitrary-angle mechanical clearances or physical structural integrity.
- Desktop/mobile gallery lighting differs from Blender studio rendering and the actual game. Add culling, instancing/material caching, LOD, shadows and target-device budgets during a separately approved integration pass.
