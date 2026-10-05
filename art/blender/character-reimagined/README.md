# Emberhall — A self for the road

An **original, script-authored Blender character redesign preview**, not a live-game replacement.

## Review first

- `art/verification/character-reimagined/hero-before-after.png` — current default character and three proposals, identical studio camera/light.
- `art/verification/character-reimagined/contact-sheet.png` — full figure, face and back for every character.
- `art/verification/character-reimagined/gameplay-scale-comparison.png` — native-pixel default-distance comparison, plus explicitly labeled 4× inspection crops.
- `public/art/character-reimagined/index.html` — interactive locally vendored gallery. Serve over HTTP (ES modules do not work reliably through `file://`).

The gallery supports same-camera current/proposed comparison, all three appearances, face/body/default-world-distance cameras, pointer/touch orbit, turntable, a rigid arm articulation study and a byte-verified GLB download. It uses local Three.js modules; no CDN or external service is required. A temporary QA server was closed after the tests; this is not a deployment.

From the repository/extracted package root, run:

```text
node art/blender/character-reimagined/serve.mjs
```

Then open the printed `http://127.0.0.1:8194` address. `launch-gallery.cmd` uses this machine's native Node installation. Stop the server with Ctrl+C. The artifact is usable without the application server.

## The three appearances

All are **player adventurer presentations, not NPC professions**. They share a reusable core mesh-generation routine and compact Emberhall proportions.

- **Rowan / ember & oak:** warm light skin, swept chestnut locks, rust tunic, ochre lapels, split hem and flat satchel strap; a masculine-leaning presentation.
- **Mira / river & brass:** warm dark skin, pulled-back segmented braid, flax scarf with knot/tail and teal back mantle; a feminine-leaning presentation without exaggerated anatomy.
- **Arden / heather & silver:** medium warm skin, silver cropped waves, broader tunic silhouette, stand collar, shoulder tab, toggles and short leather mantle; an androgynous presentation.

The improved faces have brows, seated multi-part eyes, an angular connected nose, ears and a small restrained mouth. Hands have palms, thumbs and grouped knuckles. Boots have continuous uppers/cuffs, shaped toes, soles and stitching. Materials are named editable flat palettes rather than external textures. Hair is intentionally chunky low-poly—not realistic strand hair.

## Honest baseline

`baseline-current.glb` is assembled from the **actual preexisting `public/art/lanternwood/character.glb`**, not the older primitive-box fallback and not a deliberately degraded stand-in. The source `.blend` was opened and inspected before authoring. `baseline-reference/` freezes that source and GLB plus the actual renderer/creator/appearance-contract files used for inspection.

Reconstruction follows `FIGURE`, `HAIR`, `DEFAULT_LOOK` and `people-meshes.tsx`: default crop, default skin/hair/rust garb, pants/boots, permanent player belt, idle ±0.12 arm rotations and the runtime face/seams. It excludes optional equipment, custom voxel additions, bob, selection ring and transient effects. Face primitives are reconstructed from the runtime dimensions in Blender; this is **not a pixel-identical capture of React/Three shaders**, nor an in-game screenshot. Geometry verification compares the six main baseline parts to actual old GLB vertices with a small floating-point tolerance.

Full figure and face images share cameras and studio lighting between baseline and every candidate. World-distance images use the actual world camera offset `(16,23,20)`, target `(0,.4,0)`, vertical FOV `48°`, with characters rotated π to face it. Source: `world-scene.tsx`. This tests static silhouette at that scale on a neutral floor, **not live-world readability under scenery/fog/occlusion**. Native gameplay crops are not enlarged; the second row is explicitly 4× nearest-neighbor.

## Editable sources and exports

- `rowan.blend`, `mira.blend`, `arden.blend`: assembled at local ground origin, with individually named meshes/materials and rigid head/arm parent empties.
- `baseline-current.blend`: the reconstructed comparison figure.
- `build_characters.py`: reusable deterministic base, distinct appearance parameters and geometry variants, export and render pipeline.
- `public/art/character-reimagined/{rowan,mira,arden,baseline-current}.glb`: standard Y-up glTF, local front **−Z**, ground at Y=0.
- `manifest.json`: measured bytes, hashes, world bounds, vertices, triangles, mesh/material counts and scope.

All `.blend` files are saved before studio cameras/lights/floor are added. Export preserves named articulated components rather than flattening them into one mesh. Regeneration overwrites these new-kit sources and outputs; save manual edits elsewhere before regenerating. `.blend1` backup files are excluded from the delivery archive.

## Not drop-in compatible

See `INTEGRATION-CONTRACT.md`. These are **rigid-part design models**, not a skinned rig: no armature, weights, animation clips, facial morphs or game-animation acceptance. Shoulder/head pivot positions were intentionally retained, but child organization, assembled-space meshes, materials and hand/outfit proportions differ. The old runtime extracts a small set of centered geometry names and replaces materials. Loading these whole-character GLBs through that extractor would not work.

Not tested or claimed: full creator recoloring/hair swaps; all gear and custom voxel combinations; hand grip/tool alignment; walk/combat/crafting/ghost/death/resurrection animation; navigation/picking; fallback loading in-game; FPS or performance budgets. No application files, package scripts or original assets are changed by this preview. The existing dirty branch was not reset, stashed, checked out or committed.

## Verification

```text
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background --factory-startup --python-exit-code 1 --python art/blender/character-reimagined/build_characters.py
node art/blender/character-reimagined/verify.mjs --measure
node art/blender/character-reimagined/verify.mjs
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background --factory-startup --python-exit-code 1 --python art/blender/character-reimagined/verify_source.py
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background --factory-startup --python-exit-code 1 --python art/blender/character-reimagined/audit_saved_source.py
python art/blender/character-reimagined/compose_plates.py
node art/blender/character-reimagined/browser_verify.mjs
python art/blender/character-reimagined/package_delivery.py
```

Source regeneration needs Blender 5.2; plate composition needs Python/Pillow and the included Windows-font paths. Browser/Node verification uses this repository's installed `three` and `playwright`. The gallery itself is independently vendored. Archive verification requires only Python stdlib.

Evidence lives under `art/verification/character-reimagined/`: source reopening, evaluated triangle/ground/pivot checks, independent per-mesh source↔GLB world-vertex audit, actual GLTFLoader parsing, baseline geometry provenance, desktop/mobile real-browser controls/download/HTTP checks, original-asset preservation, visual-review notes and archive readback hashes. Early failed bevel checks and initial renders remain labeled as historical evidence; final reports distinguish the corrected results.
