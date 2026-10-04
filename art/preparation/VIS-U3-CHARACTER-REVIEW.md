# U3 death-body and ghost-material source review

Status: source review only; no runtime edits, rendered reproduction or gameplay acceptance.

## Confirmed source inconsistency: held equipment ghost materials
people-meshes.tsx:97–113 implements the body/wood ghost material: pale emissive tint, opacity .58, transparent=true, depthWrite=false. Alive explicitly restores state. The effective ghost flag also covers timed invisibility (871–874).

Held main/offhand items stay mounted with ghost passed (1149,1160), but several child materials bypass this treatment: hatchet head125, knife blade140, sword guard155/blade159, mace head189, staff tip204, bow string228, fishing reel308, hoe head323, pick head338, shield face270–274/boss278. Torch ember253–257 changes emission only. This is a confirmed source-level mismatch, not a browser-reproduced visual defect. Do not call it fixed or assign gameplay impact without reproduction.

Recommended bounded follow-up after a QA slot opens: preserve each alive color/metalness/roughness while consistently specifying ghost transparency/depthWrite/emission and explicitly restoring alive state. Do not replace metal materials with the current wood-oriented Mat blindly. Cover all approved tools too without changing their geometry. Keep bow arrow visibility/ref and torch point-light ghost gating unchanged. Confirm whether the intentionally dim ghost torch should retain its special emission.

Authored face/tunic details already return null for ghost in authored-character.tsx. Worn decorative parts and crafting/gathering/construction helpers are ghost-gated. Do not add a second whole-character opacity traversal that fights these local contracts.

## Death-body design boundary
pile-meshes.tsx:7–31 renders a separate generic fallen marker with three boxes plus ring at existing ground placement/rotation. The death-source branch (41) precedes pouch rendering. Death is not the ordinary corpse-content pouch.

Recommended offline art: a subdued, faceted fallen tunic/head/shroud within the original per-part envelopes and transforms; retain the ring and distinguish it from canvas loot. Do not infer deceased clothing, hair or identity from the current living player: DeathBody receives only tx/ty and LootPile (types.ts) does not store a character-look snapshot. No schema expansion or save migration belongs in this visual batch.

Preserve pile IDs, coordinates, source, expiry, items, gold and recover objective/ghost looting rules (piles.ts:87–134). Retain existing picking behavior separately from decorative geometry. Screenshot appearance alone cannot validate contact, click targeting or recovery.

## Required future runtime checks
Alive -> ghost -> alive and invisible -> visible with representative wood, metal, shields and torch; check opacity, depthWrite, emission, shadows and original alive materials. Bow arrow remains hidden in ghost state and behaves normally after return. Torch light stays off for ghost. Exercise authored-load success and rejected-download fallback. Verify fixed-camera readability, grip/action poses and equipment swapping. Death marker: original click routing, contents/recover, expiry and save/reload. This review does not complete any of those checks.

## Verification
Read current renderer/material paths and pile type/lifecycle sources. Compared all 421 protected runtime/public/frozen U1/U2 files against the pre-U3 SHA-256 checkpoint: unchanged. No build or browser test run because this batch only writes this review document. U1/U2 independent QA remains pending; runtime integration still paused.
