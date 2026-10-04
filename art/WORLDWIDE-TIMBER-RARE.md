# Rare timber — bounded local verification

Historical batch: the two input/label defects below were subsequently fixed and independently verified in [WORLDWIDE-TIMBER-UX.md](WORLDWIDE-TIMBER-UX.md). Original results and limitations are preserved here.

## Outcome
Redwood and yew meet the controlled desktop/mobile lifecycle and input scope. Ghostwood's mature art, living/ghost visibility, extraction, stump/regrowth and living planting pass, but **touch-only action entry is not accepted**. All **8 tree styles** have now received scoped visual review; the ledger records **7 verified species plus ghostwood partial**, not 8 fully accepted species. No art or application/runtime code was changed in this batch. Existing GLBs were not regenerated.

Production and public preview unchanged; local built preview remains http://127.0.0.1:8124. No commit, push or deployment.

## Actual evidence
- `art/verification/worldwide/rare-timber-candidate-final/results.json`: 6 exact desktop/mobile species cases, 202 assertions.
- `art/verification/worldwide/rare-timber-failure-final/results.json`: 6 exact cases, 191 assertions, actual requested-species HTTP503 injection recorded for each device/species.
- `art/verification/worldwide/rare-timber-built-final/results.json`: 6 exact cases, 160 assertions, source-free browser operation against completed production output.
- **553 fresh assertions total**, including **12 observations reproducing the touch limitation**. Passing expectations about a limitation are not positive UX acceptance. The three runs each include 28 wild-node gate cases, in addition to the six planted lifecycle cases.
- **879 canonical tests passed**, zero failures/cancellations/skips. Typecheck, full lint, build, auth invariant and diff checks passed. Full logs: `.hermes/worldwide-rare-timber-tests.log` and `.hermes/worldwide-rare-timber-build.log`. Build ran with DATABASE_URL unset and migration skipped. Final script syntax and lint passed after capture changes.
- `rare-timber-build-freshness.json`: four initial served HTML JS/CSS references were HTTP200 and matched current built bytes. No stale-server restart was needed.
- `rare-timber-catalog-hashes.json`: all eight current source GLBs match previous ledger, current built files and freshly served bytes.
- `rare-timber-evidence-audit.json`: all eight unique catalog entries joined to exact saved passing candidate/fallback/built cases, actual rejected requests and asset hashes. **1024 cumulative recorded assertions** span three historical batches; this is not a fresh full-catalog interaction rerun or a release pass.

## Special rules actually exercised
The rare gate helper validates canonical pristine wild-node fixtures before execution, then uses cleared disposable terrain, normal command dispatch and bounded ordinary 0.05-second world substeps. It does not replace the browser's harvest implementation or set successful yield directly. Controlled RNG ensures an eligible strike succeeds; no natural difficulty claim.

**Redwood** — seed111 at (360,460): unknown at lumberjack34; identified but blocked at49; previously discovered identity remains known at skill0 while extraction stays blocked; knife blocked as tier1; hatchet at50 recovers exactly one choice log from the pristine-ceiling node. Normal living planting dispatch/completion at forestry50 verified.

**Yew** — seed405 at (64,110): unknown at54; identified but blocked at64; discovery survives reduction to0 without allowing harvest; knife blocked; hatchet at65 recovers one choice log from the pristine-ceiling node. Normal living planting at forestry65 verified.

**Ghostwood** — seed2463 at (64,110): living command rejected; ghost skill79 rejected; ghost80 without a blade rejected; ghost80 using the existing tier1 knife recovers one pristine log. Ghostwood has a tier1 tool policy, not redwood/yew's tier2 rule. Planted lifecycle uses a skilled ghost with hatchet and verifies two typed logs, no legacy log duplication, depletion, stump, 72.1-hour controlled regrowth jump and stable node identity. Living mature trees and stumps have no target meshes in development; built living-state full frames show the empty target area. Ghosts cannot plant; an explicit fixture switch to a living character at forestry80 permits the normal planting command and growth. This is not a real resurrection test. Saplings remain visible to living players under existing code; do not generalize mature-tree exclusion to all growth stages.

The planted yields matched candidate, rejected-download fallback and built runs on both viewports: redwood sound ×2, yew choice ×2, ghostwood rough ×2 at the respective local coordinates. The separate wild fixtures exercise skill-capped quality on pristine ceilings.

## Open input/UI defects — not disguised as passes
1. **Ghostwood touch entry:** while ghost, a real touch tap walks. An actual 800ms Chromium touch hold also did not open the Chop menu. Desktop right-click followed by the real menu button works. For mobile lifecycle continuation only, the harness explicitly opens the normal context menu in the fixture and then taps its real button. That verifies the command and touch activation after opening, **not a playable touch-only entry path**. The final results and scope text disclose this. Physical-phone behavior remains untested.
2. **Planted species menu text:** all recorded ghostwood menu labels were `Chop Rough Oak`, although the target is planted ghostwood and the actual inventory gets `ghostwood:log:rough`. The existing context label function resolves the underlying wild node, ignoring the planted species override. `store.ts`, `context.ts`, `world-pointer.ts`, and `context-menu.tsx` have no diff from HEAD; neither issue was introduced by the authored art routing. These UX issues are recorded for a separate bounded fix rather than changing gameplay rules during art acceptance.

## Preserved failed run / harness changes
`rare-timber-candidate-v1` stopped at the first desktop ghostwood context target. Its ray at ground+0.65 passed through empty space beside the thin curved trunk and hit neighboring ground (269,301), rather than the requested (269,302). Both the real scene and same-matrix isolated mesh ray missed. This was not evidence of stale instancing bounds. The fixture now projects ground+0.18 onto the visible trunk base for ghostwood; normal camera, tree geometry and runtime picking are unchanged. v2 passed, and is retained.

The final capture pass lets previous wild-harvest effects expire with normal substeps before standing frames, adds real touch-hold observations and records exact ghost menu text. Earlier v2 results remain retained; final evidence paths above supersede them for report totals. No failed output was edited away.

## Visual review
Final built desktop/mobile lifecycle sheets, final mobile rejection fallback sheet, built lineup, native mobile living-hidden and sapling frames reviewed. Redwood's tiered conifer crown, yew's compact branched foliage and pale sparse ghostwood silhouettes are whole and framed with no conspicuous large detached target part. Ghostwood's finest branch/leaf connections remain scale-limited. Native tiny ghostwood sapling is clear of player/HUD but a sprout cannot be reliably separated from its few-pixel base marker; likewise early growth species identity is weak. Large marker rings/player silhouettes and neighboring shadows are not tree anatomy. Fallback trees are intentionally coarser and less species-distinct than authored art. Cropped neighbors or notifications in contact sheets do not establish target-canopy loss or a full-viewport UI defect.

This does not certify detailed anatomy, full growth animation, physical phones, natural forests, crowded scenes, frame-time performance, all character/building states or release readiness.

## Next unresolved scope
Close the two documented ghostwood interaction/label issues in a separate bounded slice, preserving living exclusion and skill/tool rules; then continue character/building worldwide acceptance. Natural-forest behavior and performance remain separate release gates.
