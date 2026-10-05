# Rowan player integration

The approved `public/art/character-reimagined/rowan.glb` is consumed unchanged. Its editable `rowan.blend` and standalone generator are unchanged; the old standalone review contract describes the source model, not a drop-in runtime rig.

## Runtime adapter

- `rowan-character-data.ts` bakes source node/ancestor transforms and subtracts the **existing** FIGURE mesh anchor. Left/right sleeve and hand geometry stay distinct. Merged body geometry replaces only the geometry on existing renderer meshes.
- The player keeps its root, shoulder refs, hand/tool/equipment children, bob, live poses, heading correction, materials and gameplay data. No new skeleton, locomotion, stats, economy, save schema or outline pass is introduced.
- `RowanCharacterProvider` is enabled only for the player; the creator uses that same provider. Existing NPC geometry/policy is unchanged.
- Primary skin/garb/hair/legs/boots/hands retain existing appearance and equipment materials. Fixed trim/linen/leather/hardware details are grouped by palette. Brows follow hair color; ear/lip accents follow skin color. Details are hidden for ghosts, leaving the existing translucent body materials.
- Crop uses Rowan's fitted swept hair; Bald hides it. Shag/Tail/Long retain the existing additive style parts over the fitted Rowan hair. Their style IDs, selected colors and save controls are unchanged.
- Rowan's decorative belt/satchel is included in its torso. The legacy gold belt block is suppressed for Rowan, not for fallback.
- Missing/rejected/incomplete Rowan loads keep the existing authored character and, if that also fails, the existing primitive fallback. A shared rejected promise prevents request storms. Neither body path suspends gameplay.

## Bounded verification

`node --experimental-strip-types --test src/components/game/authored-character.test.ts src/components/game/character-facing.test.ts src/game/look/figure.test.ts src/game/look/save-roundtrip.test.ts`

`node scripts/rowan-character-smoke.mjs http://127.0.0.1:8080 candidate-v1`

`node scripts/rowan-character-smoke.mjs http://127.0.0.1:8080 failure-v1`

The browser script uses a fresh context and disposable loaded-save fixture, then real creator clicks, a real walk command with normal fixed simulation ticks, and a bounded hunt/action with a durable fixture target. It inspects the real local Fiber scene, saves screenshots and reports, and rejects the actual Rowan request for fallback. This is **not** a full animation/equipment matrix, natural-world combat acceptance, performance study, physical-phone test, or full new-character world-generation test.

Evidence is under `art/verification/rowan-integration/`. No production deployment is part of this task.
