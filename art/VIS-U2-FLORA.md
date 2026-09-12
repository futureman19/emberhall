# VIS-U2 flora sub-batch — implemented, independent QA pending

Script-authored Blender crops: cabbage, wheat, garlic, ginseng, mandrake, moss; each has three growing states. Wild moss, mandrake, ginseng, ash and pearl have ready/picked geometry. 28 merged, vertex-colored state meshes in flora.glb; editable components in art/blender/flora.blend, generator build_flora.py. Regeneration overwrites manual source edits.

Runtime uses shared validated geometry. Original crop pick meshes, soil/frame handlers, saplings and till preview retained. New art is non-raycasting; original primitive presentation remains on actual download failure. No simulation, save, camera, identity, yield, growth timing, or U1 source/archive edits. Protected hash check: 161 files unchanged.

## Quick checks
- Four real-GLB tests pass; initial palette failure caught all-white export and was corrected by explicit Blender vertex-color node wiring. Tests inspect normalized color values.
- Typecheck, targeted ESLint and build pass. New test appended to existing explicit package list; derived asset ledger refreshed.
- Six browser cases across candidate dev, rejected-flora fallback and built desktop/touch: all pass. Candidate dev renders all 28 named states. Native ripe garlic-bed input dispatches harvest on its exact tile; unchanged plot/herb records checked while paused. This is input dispatch, NOT completed harvesting/yield proof.
- Built HTML-linked JS/CSS and flora.glb bytes matched current output; preview restarted to avoid stale SSR cache.
- Evidence: art/verification/worldwide/vis-u2-flora-dev-v1, vis-u2-flora-fallback-v1, vis-u2-flora-built-v1. VIS-U2-work contains baseline files, protected hashes and summary.

## Visual limitations / deferred QA
Normal-camera larger leafy/grain silhouettes read; tiny sprouts, flat moss and pale reagent samples remain subtle on mobile. The conspicuous tan curved object beside the lineup also exists with flora.glb rejected, so it is not a new-flora-only regression; responsible original scenery/fixture object not identified. Initial fixture spawned a free look-hut; built fixture places an owned dummy house far away to suppress that unrelated scene mutation. These are controlled cleared-arena checks, not natural field acceptance.

Independent growth/harvesting success/failure, quantities, save/reload, herb regrowth, natural habitat and performance remain pending. No full suite or exhaustive parent-owned lifecycle pass claimed. No publish/commit/push.

## Next stopping point
Finish remaining U2 stone/gem and shared-loot presentation, then freeze VIS-U2-r1 and provide @grokhermesautobot the complete testing prompt. U1 packet remains unchanged; external testing acknowledgement is still unconfirmed.
