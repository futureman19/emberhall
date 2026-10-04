# U3 offline weapon batch

Script-authored Blender knife, sword, club, mace and staff. Five assembled source weapons; eleven centered export parts. Deliberately outside runtime public assets and src.

build_weapons.py generates weapons.blend, weapons.glb, manifest.json and weapon-lineup.png in this folder only; regeneration overwrites manual source edits.

Actual GLTFLoader validation (validate.mjs / validation.json) checks each named part, finite positions/normals, file hash and original mesh dimension envelopes. Editable weapons.blend independently reopened in Blender: eleven unique export_part meshes found.

Enlarged offline lineup visually reviewed: distinct silhouettes and no conspicuous detached components. Not game-camera readability, attachment, animation, ghost-transition or performance proof.

Runtime src, public assets, U1 and U2 archive bytes compared against runtime-before.json and unchanged.

Next offline work: bow, torch, shield, heater. Runtime integration remains paused until at least one U1/U2 QA result returns. Do not copy this GLB over approved tools.glb: it is a separate incomplete kit. Integration must preserve materials, grips, animation refs and failure fallback.
