# Emberhall — Wild Frontiers / landscape collection 01

A reusable, original script-authored low-poly landscape kit for **future** world expansion. Nothing in the current map, gameplay, navigation, biomes, package.json, or runtime renderer was changed. Not deployed or committed. Existing unrelated workspace changes are intentionally untouched.

## Contents

- **14 GLBs**: rocky peak, snowcap peak, mountain ridge, straight cliff, corner cliff, boulder cluster, active volcano, dormant caldera, basalt columns, lava pool, swamp water/mud patch, cattail reeds, twisted rooted swamp tree, moss rocks.
- **168 named editable mesh parts** in `emberhall-landscape.blend`, grouped into 14 ID-named collections. Only Broken Crown is viewport-visible initially; toggle collection monitor icons in the Outliner to edit another module. All source modules are authored at the origin, not laid out into a scene. Studio camera and lights are included.
- Matte shared vertex-color palette; separate warm emissive lava material. No texture downloads or gameplay random numbers. Variation is deterministic trigonometric art noise.
- `public/art/landscape-kit/manifest.json`: exact measured bounds, footprint, height, triangles, vertices, draw primitives, file bytes and SHA-256 per GLB. Placement and collision suggestions are explicitly **non-authoritative**.
- Browser gallery: `public/art/landscape-kit/index.html`, locally vendored Three.js modules and license. No CDN, package edits or application build required. An HTTP server is required; `file://` module loading is not supported.
- Contact sheet, 14 transparent source-render thumbnails, and three family closeups in `art/verification/landscape-kit/`.

## Verified delivery

- 14/14 files parsed by the repository's actual Three.js GLTFLoader; expected IDs, finite positions/normals/colors, positive XYZ bounds, Y-up ground contact, zero lineup translation, pivot within footprint, palette variation, warm (not white) emission, exact manifest measurements and hashes.
- **747,780 total GLB bytes; 7,596 triangles; 16 material draw primitives** across one copy of every asset. These are geometry inventory numbers, **not** measured frame time or a performance acceptance claim.
- Saved `.blend` reopened in a separate Blender 5.2.1 process: all collections, named parts, finite vertices, Palette attributes and Z-up source grounding checked.
- Real desktop 1440×1050 and mobile-emulated 390×844 browser runs loaded every GLB. Region filtering, selection, rotate toggle, pointer orbit, mobile CDP touch drag, reset and downloaded GLB hash passed; no page/console/HTTP errors and no horizontal overflow. Renderer was NVIDIA RTX 4060 via ANGLE D3D11. Mobile is browser emulation, **not physical-phone performance**.
- Final desktop/mobile screenshots and contact sheet visually inspected. Orange lava and visible crater/overflow verified after correcting exporter emission behavior. Source render and glTF use different tone mapping/lighting; they are not pixel-identical.
- Basalt column / tree thumbnail framing widened after review. Gold denotes selection; a separate pale pointer/focus outline may remain on another button.

Evidence JSON: `geometry-verification.json`, `source-verification.json`, `browser-verification.json`. Final logs: `verify.log`, `source-verify.log`, `browser-delivery.log`; generator log: `art/blender/landscape-kit/generate-delivery.log`.

## View locally

From the repository root:

```sh
"C:/Program Files/nodejs/node.exe" art/blender/landscape-kit/serve.mjs
```

Open `http://127.0.0.1:8187/`. This server serves only the kit directory. Set `PORT` to use another port. The entire public kit folder can be hosted as ordinary static files independently of Emberhall.

## Regenerate and validate

**Regeneration replaces the kit's .blend, GLBs and manifest; preserve manual edits first.** It does not touch other art directories. Run from the repository root:

```sh
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background --factory-startup --python-exit-code 1 --python art/blender/landscape-kit/build_landscape.py
"C:/Program Files/nodejs/node.exe" art/blender/landscape-kit/verify.mjs --measure
"C:/Program Files/nodejs/node.exe" art/blender/landscape-kit/verify.mjs
python art/blender/landscape-kit/package_gallery.py
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background art/blender/landscape-kit/emberhall-landscape.blend --python-exit-code 1 --python art/blender/landscape-kit/verify_source.py
"C:/Program Files/nodejs/node.exe" art/blender/landscape-kit/browser_verify.mjs
python art/blender/landscape-kit/package_delivery.py
```

`package_gallery.py` requires Pillow and the installed Three.js package. Browser verification uses installed Playwright/Chromium and its own ephemeral local server. Use native node.exe on this Windows bash host: the node shell shim can fail in background jobs with “stdin is not a tty.”

## Future integration checklist — NOT completed

- [ ] Approve relative scale against characters/terrain. Units are provisional; manifest footprints are geometric bounds, not occupied tiles.
- [ ] Define authoritative terrain occupancy, slope, water depth, traversal, hazard and collision rules separately. Lava is only visible artwork, not damage. Reeds and tree are not harvest nodes.
- [ ] Derive placement origins from approved world/tile coordinates. GLBs are Y-up with local ground origin; source Blender is Z-up. No placement transforms have been added.
- [ ] Seam-test combinations on real elevation. Cliffs overlap as visual modules, not watertight or grid-snapped terrain pieces. Flat patches are opaque stylized surfaces, not simulated water.
- [ ] Add LOD/culling/instancing/material-cache policy and measure target devices. Export draw primitives alone do not establish FPS, shadows, batching, or memory budgets.
- [ ] Exercise picking, occlusion, navigation and save/load/fallback behavior only when integration is separately authorized.
- [ ] Review peak/snow and boulder/moss pairs as deliberate variants, not 14 entirely unrelated silhouettes. Review swamp-tree root burial and moss readability in the actual environment.

## Resolved issues retained honestly

Initial Blender call used an obsolete `export_colors` keyword; removed for 5.2.1. First gallery browser run exposed a missing vendored SkeletonUtils dependency; included and rerun successfully. Initial lava flow was hidden in source geometry; lifted onto the slope. Vertex-color-connected emission exported white in glTF; replaced with constant warm emission and added an actual-loader regression assertion. Initial raw logs are retained; only final passing reports describe this delivery.
