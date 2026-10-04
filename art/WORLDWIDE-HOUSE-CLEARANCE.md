# Chest panel clearance — bounded local closure

## Delivered
- Porch, hut and homestead headings sit clear of the status HUD and left tool buttons. The shell is viewport-bounded; Close and feedback remain outside its scrolling body.
- Short landscape screens move the panel beside the HUD to retain useful content height. Below 380px wide, Pack and Chest stack into one column rather than squeezing the Bandage label.
- Notifications appear once inside an active chest. Settings, Work, Spellbook, Vault, Pets and ordinary side panels temporarily hide the chest without clearing or retargeting its ID; notification routing uses the same visibility predicate. Closing the competing panel restores the chest.
- The panel intentionally paints in front of the mini-map where narrow viewports cannot fit both. Close remains usable and normal mini-map minimize/restore still works afterward. This is not a claim of zero geometric intersection with the map.

Only the house presentation, HUD notification routing and a presentation helper changed in application code. `world.ts`, `house.ts`, `store.ts`, `live.ts` and `save.ts` match their pre-UI hashes. Ownership, eight-slot capacity, transfer quantities, costs, allocator and save rules were not changed.

## Verified
- **950 full tests pass:** 250 script tests and 700 source tests, including 13 focused panel tests. Typecheck, lint, build, auth invariant and diff checks pass. Final logs: `.hermes/house-clearance-{tests,ledger,build}-final.log`.
- **1,684 final clearance assertions / 24 cases:** `house-clearance-routed-v1` and `house-clearance-built-final`, each 842 assertions and 12 unique cases: three houses × desktop1440×960, portrait390×844, narrow320×568, landscape844×390.
- Actual mouse/native-touch context opening, deposits, retrieval, wheel/swipe scrolling of populated lists, canonical full-chest rejection, multiline notification geometry, ghost-disabled controls, Close, and mini-map minimize/restore pass.
- Actual Settings, Work, Spellbook, Pack and Vault entry/exit retains the same chest ID and exposes notification feedback. Pets precedence is a focused state test, not real Pets-entry acceptance. Poisoned/blessed/unseen HUD-row fixtures are included in final clearance checks.
- **350 additional identity lifecycle regression assertions:** candidate190 / six cases and rebuilt160 / six cases repeat actual deed placement, autosave, fresh-context reload and exact-house chest retrieval. These are `house-clearance-id-regression` and `house-clearance-id-built-regression-final`.
- **2,034 accepted browser assertions total** for this final UI + identity regression closure; earlier exploratory runs are excluded.
- Restarted only tracked local preview8124 after the final build. `house-clearance-built-freshness.json` records HTTP200 and exact local-build bytes for all four HTML-linked local JS/CSS assets. Source audit and exact case joins: `house-clearance-acceptance.json`.
- Final built desktop/mobile/narrow/landscape sheets show all three headings, entire supplied multiline status and Close readable and separate from the fixed HUD controls. Existing item tooltips can cover scrolled rows; this does not establish an unobstructed inventory at every hover state.

Unless prefixed otherwise, evidence paths are under `art/verification/worldwide/`.

## Retained failures and review
- `house-clearance-before` reproduces the original overlap across all12 cases, with54 failed checks. In narrow portrait, the mini-map blocks the Close hit test. Its forced fixture cleanup afterward is **not** positive native-Close evidence; only final runs supply that proof.
- `house-clearance-candidate-v1` passes initial geometry but visual review finds a cramped landscape body and narrow truncated Bandage label. It is superseded by the responsive layout.
- `house-clearance-candidate-v2` reports a footer intersection using raw offscreen item rectangles. Final measurement intersects each item's rectangle with all overflow-clipping ancestors; real scroll/hit tests independently establish usable targets.
- `house-clearance-stress-v1` supplies more than the canonical eight chest slots, so the unchanged capacity rule rejects a new kind. Final fixtures derive `HOUSE_SLOTS`, stay within capacity, and explicitly test a real full-chest rejection.
- Read-only reviewer `subagent-summary-0-20260910_160957_334125.txt` identifies newly elevated chest stacking over other panels and hidden feedback behind Vault. `house-clearance-overlay-red` reproduces Settings precedence failure; shared visibility gating and five-panel actual-input coverage address it. Multiline/list/status-row test gaps are also covered in the final matrix.
- The combined clearance+ID built command timed out after the clearance run passed and five ID cases completed. `house-clearance-id-built-regression` is incomplete, not accepted. The separate final ID run completed all six cases with160 passing assertions.

## Boundaries
Disposable fixtures supply buildings, inventory, body position, long messages and status/ghost flags on existing terrain. They do not establish natural placement, walking, earned inventory, ghost transition or full-world acceptance. Identity regression uses its separately documented placement/save fixtures.

Scrollable rows can be partly clipped; some two-column labels truncate and ordinary hover tooltips can obscure rows. The fixed heading/status/Close guarantee is narrower than every-item/every-overlay clearance. Full transfer animation is not always simultaneously visible with scrolled lists. No complete animation, natural-world, performance, physical-phone, or automatic repair of already-duplicated saves is claimed.

Four fortifications, keep/remaining worldwide architecture, natural scenes, construction/collision and broader acceptance remain open. **Local preview updated; nothing committed, pushed or published. Production and public preview are unchanged.**
