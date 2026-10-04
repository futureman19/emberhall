# Mossveil Sanctuary — Emberhall woodland shrine kit

Original deterministic, script-authored low-poly artwork. Eight reusable modules and one assembled landmark; no copied game artwork. An open broken arch, not a roofed wayside shrine.

## Deliverables

- `emberhall-mossveil.blend`: nine named collections, with named editable mesh parts and corner-color palette data. All collections occupy their own local ground origin, not a lineup. Initially only `broken-sun-arch` is shown. To edit another, hide the current collection and enable the desired collection's viewport/render visibility; if needed unhide its objects using Alt-H. The full assembly is `mossveil-sanctuary`.
- `build_sanctuary.py` + `designs.py`: complete generation, source save, Y-up GLB export and Blender renders. Regeneration overwrites generated artifacts and any manual edits in the saved blend. `.blend1` backups are excluded from delivery.
- `../../../public/art/woodland-shrine/`: nine GLBs, measured manifest, Y-up instance layout, PNG thumbnails, contact sheet, standalone gallery and locally vendored Three.js dependencies/license. No CDN or network service required beyond a local HTTP server.
- `../../../art/verification/woodland-shrine/`: hero, contact sheet, source and assembly reopening audits, real GLTFLoader checks, desktop/mobile browser screenshots and reports, scope hash audit, ZIP and readback inventory.

## Modules

Broken Sun Arch; Mossy Ruin Wall; Worn Sanctuary Paving; Leaf Votive Markers; Dry Offering Basin; Sunleaf Carved Altar; Fallen Column Fragments; Ancient Root Tree. The altar has an original circular sun and paired-leaf relief. Warm muted limestone, shaded earthen altar body, moss greens and faceted bark; no magical effects.

The assembly uses **11 unscaled module instances** plus **47 assembly-only dressing parts**: earth skirt, 26 muted grass patches and 20 grass blades. `layout.json` describes the module placements, but does not alone reproduce dressing. The generator is the complete reconstruction recipe. Every saved-source instance vertex is checked against the source module and the recorded Y-up translation/yaw/scale (Blender coordinate conversion included).

## Reproduce from repository root

Use Blender 5.2.1 and Python with Pillow, plus repository-installed Three.js and Playwright. Native Windows executable paths avoid this host's Node shell shim.

```bash
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background --factory-startup --python-exit-code 1 --python art/blender/woodland-shrine/build_sanctuary.py
"C:/Program Files/nodejs/node.exe" art/blender/woodland-shrine/verify.mjs --measure
"C:/Program Files/nodejs/node.exe" art/blender/woodland-shrine/verify.mjs
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background art/blender/woodland-shrine/emberhall-mossveil.blend --python-exit-code 1 --python art/blender/woodland-shrine/verify_source.py -- --present
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background art/blender/woodland-shrine/emberhall-mossveil.blend --python-exit-code 1 --python art/blender/woodland-shrine/verify_assembly.py
python art/blender/woodland-shrine/package_gallery.py
"C:/Program Files/nodejs/node.exe" art/blender/woodland-shrine/browser_verify.mjs
python art/blender/woodland-shrine/verify_scope.py
python art/blender/woodland-shrine/package_delivery.py
```

Always measure after regeneration, before verification and packaging: the generator intentionally resets the manifest to source metadata.

For local viewing: `node art/blender/woodland-shrine/serve.mjs`, then `http://127.0.0.1:8190/`. The server serves only the gallery directory. Stop with Ctrl-C. Direct `file://` loading is not supported by browser module/fetch security. No public host is promised. The automated QA server uses an ephemeral loopback port and closes itself in `finally`.

## Acceptance and limits

- Real Blender 5.2.1 exports and Cycles renders, then independent saved-source reopen.
- Actual GLTFLoader parses all binary geometry: finite positions/normals/colors, unit normals, strictly positive triangle area, positive bounds, Y-up ground pivots, palette variation, zero emission, exact byte/hash/manifest agreement.
- Browser desktop 1440×1050 and mobile-emulated 390×844: every asset selected, filters, rotation toggle, mouse orbit, native CDP touch orbit on mobile, reset, actual download magic/hash and served hashes. No console/page/HTTP errors or horizontal overflow. Mobile is Chromium touch emulation, not a physical phone.
- Full-size hero/contact sheet and actual browser renders visually reviewed. Refinement added softened masonry edges, tighter arch joints, darker altar/emblem contrast, broader root tips, a clean base rim and irregular ground growth. The first generation log is retained as provenance; final candidate uses `generation-refined.log`.
- A pre-authoring SHA256 snapshot covers `src`, package files, and all source/public/evidence trees for landscape-kit, trails-kit, buildings-landmarks, orc-encampment and abandoned-mine. Scope verification checks these unchanged.
- No game code integration, deployment, quests, NPCs, harvesting, walkability, collision or runtime performance acceptance. Counts are asset statistics, not FPS promises. The image has deliberate stylized facets and clean modular fracture planes; this is not scanned or physically simulated ruin geometry.
