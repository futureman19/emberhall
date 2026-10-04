# Timber interaction fixes — local bounded acceptance

## Outcome
Both previously documented defects are fixed locally. A skilled ghost can open the ordinary Ghostwood context menu with a stationary touch hold (550ms), then tap Chop. Short taps retain walk behavior. Planted timber menu labels use the planted family and the canonical tile quality ceiling instead of the unrelated wild family. All eight planted species have fresh label regressions; wild identification and harvesting rules remain unchanged.

Controlled timber coverage is now **8/8 cumulatively**, not a fresh full-catalog interaction run. The fresh browser batch covers redwood, yew and ghostwood. No models regenerated or changed. No commit, push, public preview or production deployment.

## Changed application scope
- `src/game/context.ts`: validated planted-family name and planting-known identification, preserving deterministic quality and ordinary wild identification.
- `src/game/touch-hold.ts`: scoped single-contact gesture controller, 550ms threshold and 8px movement tolerance; no simulation writes.
- `src/components/game/use-ghostwood-touch.ts`: actual context/walk callbacks; playing/ghost/skill/tree/build/till eligibility; listener/timer cleanup on cancellation, blur, visibility and unmount.
- `src/components/game/terrain.tsx`: invokes the scoped gesture before existing left-button handling. Other tile/mouse routes remain on their existing path. This file also contains earlier worldwide-art work, not introduced by this fix.
- Seven gesture unit tests and nine planted-label/gate regressions; new file appended to the explicit canonical test list. AST ledger refreshed without discarding reviewed statuses.
- Browser harness now uses actual touch entry, not fixture-opened menus. A separate helper exercises cancellation cases.

## Evidence
- **895 canonical tests passed**: 250 script + 645 game/component, zero failed/skipped/cancelled. `.hermes/timber-ux-tests-final.log`.
- Typecheck, full lint, build, auth invariant against dev8123, script syntax and diff checks passed. Build log `.hermes/timber-ux-build.log`; DATABASE_URL unset, migration skipped.
- `art/verification/worldwide/timber-ux-candidate-v1/results.json`: **214** assertions, six desktop/mobile species cases.
- `art/verification/worldwide/timber-ux-failure-v1/results.json`: **203** assertions, six cases, actual HTTP503 injection for each requested species/device. Only injected503 console messages occurred.
- `art/verification/worldwide/timber-ux-built-v1/results.json`: **172** assertions, six cases, source-free browser operation against completed built output; no unexpected browser errors.
- **589 fresh browser assertions**. Each run includes 28 rare wild-node gate cases. Harvest, typed yield, depletion, regrowth, living planting and growth checks reran for all three selected species.
- Each run verifies two real mobile holds (standing/regrown), ordinary short-tap walking, no walk on hold release, and six hold cancellations: drag, pointer cancel, second finger, lost skill, depleted target, phase transition. Four exact desktop/mobile Ghostwood labels per run read `Chop Rough Ghostwood`. Actual menu-button activation produces normal harvesting, not injected successful output.
- `timber-ux-evidence-audit.json` joins all eight ledger species to two device cases in each retained candidate/fallback/built evidence file. **1613 cumulative recorded assertions**, including the prior batch's 12 limitation observations; historical failures are not reclassified as positive acceptance.
- `timber-ux-catalog-hashes.json`: all eight current source GLBs remain byte-identical to prior hashes, current build and freshly fetched built-preview bytes.
- `timber-ux-built-freshness-final.json`: exact current HTML-linked JS/CSS URLs returned200 and matched the current files. The long-lived old preview initially served stale HTML references after rebuilding; its tracked process alone was restarted before the accepted built run. Initial freshness failure retained separately.

## Red evidence and verification repair
- `.hermes/timber-label-red-final.log` reproduced seven wrong planted-family labels; oak already matched its fixture's wild identity. Earlier fixture attempts were corrected because setWorld repaints terrain: tests must establish their disposable tree after hydration, not interpret repainted dirt as an application defect.
- The previous rare-timber report/results retain actual failing touch observations and Oak text. They remain historical evidence; `timber-ux-prior-acceptance.json` preserves the previous partial ledger.
- The first full suite failed on the stale terrain AST inventory after the new input wiring. The sanctioned `audit-art-coverage.mjs --refresh` preserved reviewed evidence; the complete rerun passed. The first failing log remains `.hermes/timber-ux-tests.log`.

## Visual and scope limits
Native built desktop/mobile menu screenshots were reviewed: `Chop Rough Ghostwood` is readable, every action row is within the viewport, and no HUD covers the menu. The pale target tree remains visible. The pre-existing mobile ghost banner/minimap overlap is still visible outside this fix; HUD source has no diff from HEAD.

Chromium mobile touch emulation is not physical-phone certification. Ordinary pine/willow planting remains limited by the chooser's tied thresholds and uses saved-sapling growth fixtures. Tiny sapling species detail remains scale-limited. Natural forests, crowded scenes, full animation, frame-time performance and worldwide character/building/release acceptance are not cleared.

## Next bounded batch
Finish unobstructed worldwide character captures and scoped interaction review, then proceed to worldwide buildings. Natural-forest and performance validation remain separate open release gates. Local built preview: http://127.0.0.1:8124. Production unchanged.
