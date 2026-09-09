# Phase 1 batch 2 — kitchen, tavern and market

User approved the bank/forge visual preview and asked to continue the rollout. This is approval of the look, not clearance of failed performance budgets or production promotion.

Approved reference: https://emberhall-vale-3liuqzdyi-andrews-projects-ffe8a9fd.vercel.app
Parent checkpoint: 8423a8d. Branch: feature/emberhall-kitchen-tavern-market. Existing backup files, plan and diagnostic screenshots remain preserved; generated route file has no content diff. Fetched upstream has zero commits missing from this checkpoint.

## Selected designs and contracts
- Kitchen: compact timber/plaster bakehouse, shaped chestnut roof, oven chimney, restrained cloth porch and bread sign.
- Tavern: wider welcoming inn, shaped roof and warm windows, hanging tankard/red-gold sign. Not a miniature hall.
- Market: open timber trading stall with curved crimson/cream canopy. Retain original counter and open sides; not a closed house.
- Routing applies only to these built kinds within 18 world units of COURT. Normal world generation is unchanged. Review fixtures may place these existing building kinds locally with validated footprints.
- Preserve bank/forge/hall/player/oak exports and source blends byte-for-byte. Reuse existing guarded shared loader and original inside/cutaway/pick proxies. No simulation, crafting economy, camera or streaming changes.
- Kitchen footprint: voxel x/z -3..3; front door x0,w2. Tavern: x-4..4,z-3..3; door x-1,w2. Market: x-4..4,z-3..3, open front. VOX .5, ground origin, Y-up; geometry door clearances independently ray-tested.
- Base kits <=12,000 triangles, 10 materials, 600,000 bytes each; no new dynamic lights. These asset limits are not frame-rate proof.

## Execution and verification
1. Contract-test missing routing/assets (red), then implement bounded presentation helpers and actual Blender exports.
2. Save named editable parts before joining export copies; independently reopen source and parse GLBs with runtime loader. Never regenerate approved older kits.
3. Before integration capture same disposable three-building fixture on approved runtime: desktop/mobile, exterior/interior, picking and existing station behavior. Record actual GPU frame metrics.
4. Integrate three kits, append tests to the explicit package list, refresh ledger preserving earlier evidence/approval metadata.
5. Repeat identical fixture QA and performance. Kitchen cooking must use actual existing recipe/action; market/tavern must retain whatever behavior source supports, not invent trade/rest actions.
6. Run full lint/typecheck/test/build/auth gates; compare the exact 12 prior script failures, not a hard-coded success claim.
7. Source-spec and quality review; isolated existing-project preview only. Independently inspect deployment, GLB bytes, gameplay and screenshot pairs. Commit reviewed source/evidence, preserve unrelated dirt, stop for visual review.

## Open acceptance gates carried forward
The preceding controlled bank/forge comparison failed 10/14 p95 relative ceilings, including distant unchanged-cost scenes. Cause unresolved. The 60 FPS/reference-hardware and usable-low-preset targets are not achieved claims. Mobile minimap/toolbar overlap remains a separate future UI batch. Do not mix that UI change or broad optimization into this Blender batch.
