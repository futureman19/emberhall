# Worldwide characters — bounded visual and interaction acceptance

## Outcome
All five existing NPC classes (ranger, warrior, mage, rogue, merchant) and all three service roles (banker, provisioner, healer) pass the scoped desktop/mobile checks. Clear normal-camera standing captures replace the previously obstructed lineup evidence. Actual input, service results, prescribed-path locomotion, original-body controls, failed-download fallback and built-output checks pass.

**No application or artwork changes were needed in this batch.** Added `scripts/worldwide-character-acceptance.mjs` plus evidence and reports. No commit, push, public preview or production deployment. Buildings are the next bounded batch; this is not full-world character, animation or performance acceptance.

## Exact evidence
- `art/verification/worldwide/characters-candidate-final/results.json`: 204 assertions, all eight cases on desktop and mobile.
- `characters-control-final/results.json`: 204 assertions; development request override restores the original player/near-court-service art predicate. These null-home NPC fixtures therefore use original bodies and original NPC yaw.
- `characters-failure-final/results.json`: 203 assertions; actual character.glb HTTP503 rejection in each isolated desktop/mobile context. All eight cases retain box-folk geometry, selection and services. Only deliberately injected503 console errors occurred.
- `characters-built-final/results.json`: 156 assertions; actual browser operation against completed built output, without importing source or relying on private R3F scene introspection.
- **767 fresh browser assertions; 64 exact device/mode/class-role cases** across four modes. The earlier candidate-v1 (196 assertions) is retained but excluded from these final totals; final runs add real bank and shop operations.
- **895 canonical tests passed**, 250 script + 645 game/component, zero failures/skips/cancellations: `.hermes/characters-tests.log`.
- Fresh typecheck, full lint, build, auth invariant against dev8123 and diff checks passed. `.hermes/characters-build.log`; DATABASE_URL unset, migration skipped. The new harness initially had a no-empty lint error in its screenshot-failure catch; fixed with an explanatory catch comment before the final gates/runs. No product-code fix was required.
- `characters-built-freshness.json`: exact HTML-linked assets return current built bytes. This source-identical rebuild retained valid existing references; no preview restart needed.
- `characters-evidence-audit.json` / `characters-acceptance.json`: each of the eight catalog entries joins to exact passing evidence and standing/walking files for every mode/device. Character GLB source, prior checkpoint, current built file and freshly served bytes match SHA256 `4c08799d4ebc2de738783a148d7538f069974b059ce12b1d4feb0518ed21566b` (231732 bytes).
- `characters-source-checkpoint.json`: all 289 checkpointed existing application/source/package/character-asset files remain unchanged, including the editable character.blend and character.glb.

## What actually ran
The harness loads the existing disposable review save into isolated browser storage, clears a bounded dirt area and unrelated entities, and creates one NPC at a time. It preserves the gameplay camera. NPC homes are null, deliberately outside the original authored civic policy; this does not test generated-world placements or home-return AI.

For every class/role on desktop and touch-enabled mobile contexts:
1. Record unchanged idle NPC state and capture the unobstructed whole target at the normal camera.
2. Development: inspect actual authored/fallback geometry and initial heading. Desktop: real right-click targets the exact person and the real Cancel button closes the menu.
3. Actual mouse/touch selection through the existing ground/tile targeting contract. Service selection dispatches a real approach; ordinary NPCs use a real ground-walk input. Normal fixed world substeps bring the player into talk range.
4. Real service Talk button or nearby NPC click/tap produces the normal dialogue. Banker panel opens, real Bank gold deposits 200 fixture gold, then Take 10 yields purse10/box190. Provisioner counter purchase changes inventory and subtracts the catalog price. Healer Talk restores a deliberately wounded living player's HP. No direct successful-outcome injection or production save is used.
5. After clearing actual interaction effects through normal substeps, prescribe an NPC path from (257,302) to (259,302). Normal simulation moves the NPC and consumes the path. Development scene checks verify live root position and visual heading; built checks verify movement/state and save screenshots. This is locomotion-follow evidence, not natural wandering AI or full animation acceptance.

The failed-load route retains the current +PI presentation heading even with primitive fallback; the old-policy control retains its prior NPC yaw. They are separate controls, not identical-yaw screenshots. Cached GLB failure remains deliberate and does not auto-retry in the same page.

## Visual review
Both eight-entry built desktop/mobile crop sheets, the eight-entry mobile original control and failed-download sheets, and selected full native frames were reviewed. All target silhouettes remain whole, visible and clear of trees/player/HUD in the standing captures. No conspicuous detached head/clothing or submerged body was observed. Enlarged crops are nearest-neighbor 2x references, not new detail.

Hands, individual feet, small clothing connections and face details remain scale-limited. Merchant, banker and provisioner share their existing appearance; mage and healer look similar from this direction. No unique per-role costume redesign or all-angle identity claim.

The open mobile banker panel still has existing toast/minimap/chrome overlap, but tested transaction controls and Close executed. The open service UI covering a character is not an unobstructed-standing failure: those captures are separate.

## Preserved audit limitation
A supplementary full-person cross-mode comparison failed because NPCs cloned from the live-loaded player inherited slightly different **hunger/energy** values from pre-fixture warm-up. `characters-parity-first.json` preserves all differences. All other recorded NPC fields match across modes at fixture/path-start/path-end, including appearance, position, heading and path. This establishes scoped render/motion input parity, **not full-person or whole-world deterministic parity**. No source behavior was changed or failing raw output rewritten to hide this limitation.

## Remaining / next
- Next bounded batch: worldwide buildings, beginning with doors, inside/outside presentation, roof cutaways and actual interactions.
- Still open: natural NPC placements/AI, all player appearance/equipment/ghost/action states, detailed animation, dense-scene/frame-time performance, physical phones and overall release gates.
- Local built preview remains http://127.0.0.1:8124. Production and public preview unchanged.
