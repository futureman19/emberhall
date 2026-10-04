# Emberhall — Grimroot Warcamp / landmark collection 04

An original old-school fantasy orc encampment, designed as a discoverable landmark rather than another civic building. Its rough timber, stitched hides, tusk ornaments and clan standard are newly authored geometry, not copied Ultima Online assets or a reproduction of a particular UO map location.

**Scope: static, reusable art.** No current map, towns, gameplay, AI, encounters, quests, loot, captives or spawn tables changed. No commit, deployment or persistent preview service.

## Deliverables

Eight individually reusable pieces:

1. `war-tent` — Chieftain’s Hide: stitched patchwork shelter, open entrance, tusks, guy ropes, hide floor and sleeping roll.
2. `palisade-gate` — Tuskbound Gate: heavy entry posts, tusks, lintel, clan pennant and side stakes. Open archway, **not an operable gate**.
3. `lookout-platform` — Ragged Lookout: braced timber platform, ladder, rails and supported hide awning.
4. `palisade-wall` — Hewn Palisade: uneven full-size pointed stakes, lashings, back rails and raking supports.
5. `cooking-pit` — Ironpot Hearth: raised cauldron with contents and hangers above a stone-ringed coal bed. Static colored embers; no animated fire, smoke or emitted light.
6. `empty-cage` — Empty Holding Cage: timber floor/lid, iron bars, latch and straw bed. No occupant or interaction.
7. `trophy-standard` — Grimroot Standard: tusked clan marker with a red banner and original tooth emblem. No gore.
8. `supply-pile` — Raider Provisions: crates, sacks and a stored spear. Decorative, not loot containers.

Plus `grimroot-camp`: the complete assembled landmark. It contains **14 unscaled module instances** and **30 assembly-only dressing parts** (earth skirt, 15 edge rocks, 10 full-size front infill stakes and four rails).

- **Source:** `art/blender/orc-encampment/emberhall-orc.blend`
- **Authoring:** `build_camp.py` (helpers/export/studio) and `designs.py` (original pieces and layout)
- **GLBs/gallery:** `public/art/orc-encampment/`
- **Blueprint:** `public/art/orc-encampment/layout.json`
- **Hero:** `art/verification/orc-encampment/camp-presentation.jpg`
- **Contact sheet:** `art/verification/orc-encampment/contact-sheet.png`
- **Complete archive:** `art/verification/orc-encampment/emberhall-orc-encampment-source.zip`

The Blender file preserves named editable pieces, not just joined export meshes. Collections share the local origin; only the first is viewport-visible initially. Toggle collection monitor/render icons in the Outliner. The assembled camp retains instance-prefixed mesh names for editing its layout.

## Measurements and reuse

**Complete camp:** 13,018 triangles, 1,065,192 GLB bytes, one material primitive, approximately 12.86 × 12.38 units footprint and 3.24 units tall. Units remain provisional, not approved map tiles.

**All nine files:** 19,784 triangles, 1,633,260 bytes, nine material primitives. This deliberately counts the pieces and the assembled prefab; an integration should generally choose one representation rather than loading both copies. Draw primitives are inventory counts, not an FPS/shadow-pass/draw-call claim.

GLBs are Y-up with ground origin; Blender source is Z-up. The blueprint records glTF-space translations, Y-axis yaw in radians and scale. Its 14 entries describe the reusable module placements. **It is not the complete geometry recipe by itself:** assembly-only ground/rubble/front-infill are explicitly listed and authored by `designs.py`. Use the assembled GLB for the complete static prefab, or load individual pieces for different layouts.

No random generation system has been implemented. Geometry variation and layout are deterministic authored art. These pieces can support future randomized placement only after separate game design and integration work.

## Verification

- Nine actual GLBs parsed by the installed Three.js GLTFLoader. Asserted IDs, finite positions/normals/colors, nondegenerate triangles, ground origin, bounds, color variation, non-emissive materials and exact manifest bytes/hashes/counts.
- Saved `.blend` independently reopened and checked for collection membership, named part counts, finite coordinates, grounding and Palette attributes.
- Blueprint-to-source proof: every vertex in all 14 source instances matches the recorded transform within tolerance. All instances are scale 1; dedicated full-size front infill replaced visually compressed palisade repeats.
- Cloth validation: 24 paired panels separated by 0.025 units along their surface normals, rather than coplanar opposing faces. Final renders show no black pennant artifacts.
- Nine sample rays pass through the gate’s visual opening; four cage-center checks find no interior occupant geometry. These are **not navigation, physical collision or usable-door acceptance**.
- Desktop 1440×1050 and mobile-emulated 390×844 browser runs load every GLB, filter categories, select pieces, toggle rotation, send pointer/touch drags, reset and verify the downloaded GLB hash. No console/page/HTTP errors or horizontal overflow. Physical-phone performance is untested.
- Final hero/contact sheet visually accepted after moving cage/standard inward, refining infill, pot hanger attachment, awning support and cloth surfaces. The camp is a presentation prefab on a ground skirt, not an already placed environmental scene.
- **567 pre-existing files preserved byte-for-byte:** game source, package.json and all three previous kit source/public/evidence directories.
- ZIP packaging reopens the archive, checks CRC and compares each included file hash. `.blend1` backups and the archive itself are excluded.

Evidence in `art/verification/orc-encampment/`:
`geometry-verification.json`, `source-verification.json`, `assembly-verification.json`, `browser-verification.json`, `scope-verification.json`, `delivery-inventory.json`.

Earlier `camp-before-refinement.jpg` and `assembly-red.log` are retained; final evidence refers to the current refined files.

## Standalone gallery

From repository root:

```sh
"C:/Program Files/nodejs/node.exe" art/blender/orc-encampment/serve.mjs
```

Open http://127.0.0.1:8190/. `PORT` overrides the port. The server serves only this kit directory. The viewer has local Three.js dependencies/license, no CDN or application build requirement. Use HTTP, not file://. Browser tests start and close their own ephemeral server; no permanent server is part of delivery.

## Regenerate

**Overwrites this kit’s generated .blend, GLBs, manifest and renders. Back up manual edits first.** Run from repository root:

```sh
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background --factory-startup --python-exit-code 1 --python art/blender/orc-encampment/build_camp.py
"C:/Program Files/nodejs/node.exe" art/blender/orc-encampment/verify.mjs --measure
"C:/Program Files/nodejs/node.exe" art/blender/orc-encampment/verify.mjs
python art/blender/orc-encampment/package_gallery.py
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background art/blender/orc-encampment/emberhall-orc.blend --python-exit-code 1 --python art/blender/orc-encampment/verify_source.py
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background art/blender/orc-encampment/emberhall-orc.blend --python-exit-code 1 --python art/blender/orc-encampment/verify_assembly.py
"C:/Program Files/nodejs/node.exe" art/blender/orc-encampment/browser_verify.mjs
python art/blender/orc-encampment/verify_scope.py
python art/blender/orc-encampment/package_delivery.py
```

Requires Blender, Pillow, installed Three.js and Playwright/Chromium. Regeneration resets measured metadata, so measurement must precede verification and packaging. Use native node.exe instead of this Windows bash environment’s background-sensitive node shim.

## Future integration — not included

Approve scale, terrain seating, camp placement rules, visibility, footprint and wall collisions. Design orc spawns/patrols, respawn conditions, loot, cage behavior, quests and random-landmark distribution separately. Add real water/fire/smoke, audio and animation only if authorized. Navigation must account for the gate, raking braces, guy ropes, cage and cooking frame, not just bounding boxes. Test rendering budgets, LOD, instancing, lighting, picking, save/load and failed-asset fallback in the actual game before rollout.
