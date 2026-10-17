# Paperdoll equipment interactions — local verification

Branch: `feature/paperdoll-equipment-interactions` (based on `b71cadd05fe69de3106d8efe766131e0d71a668d`). No push or deployment.

## Behavior

- Native desktop drag from backpack to the compatible paperdoll slot, including occupied-slot swaps; drag worn gear into the backpack to stow.
- Green solid valid targets, red dashed invalid targets and stronger hovered-target outlines.
- Double-click and right-click Equip/Stow for ordinary and rare equipment. Single click selects; the explicit sticky Equip/Stow button provides phone and keyboard access without accidental double execution.
- The existing equip/equipRare/unequip store commands remain the only transfer mechanism. Source identity is rechecked before commit. Stowing never creates a ground pile. Equipped rares no longer appear simultaneously in backpack cells; their full records remain in the rare inventory.
- Existing item inspection, non-equipment selection/actions, resources, pinning and Forged Oak styling are retained. Guide copy now describes the new selection behavior.

## Executed gates

- RED: new `equipment-transfer.test.ts` failed because the transfer module did not yet exist.
- Targeted transfer, paperdoll accessibility and art-coverage tests passed after implementation.
- `npm run check`: exit 0; **482 script tests and 1162 source tests passed**, lint, typecheck, production build and auth invariant passed (`sign-in off`).
- The art ledger was refreshed only after typecheck. A programmatic comparison preserved all **4821 existing asset statuses and 7373 existing state statuses**; 18 new inventory entries remain unapproved. Test-generated placement/route output is excluded from the change.
- Final smoke-script lint also passed after expanding its native keyboard and menu coverage.

Full check log: `C:/Users/futur/.hermes/profiles/telegram2/cache/scratch/paperdoll-check.log`.

## Native browser verification

Commands:

```sh
node scripts/equipment-interactions-smoke.mjs
node scripts/equipment-interactions-smoke.mjs http://127.0.0.1:8081/ screenshots/equipment-interactions-built
```

Both dev and built output passed in isolated Chromium contexts: desktop 1280×1000 and touch-emulated phone 390×844. Every context entered through the native Godmode launcher, then used the existing debug bridge solely to establish/read a paused, bounded inventory fixture. All tested transfers used native mouse, drag, keyboard or touch input—not store-triggered transfers.

Coverage: ordinary and rare drag in both directions; occupied ordinary/rare swaps; incompatible drop; Escape cancellation; both item kinds' double-click and context-menu equip/stow; real Tab/Shift+Tab/Enter/Space traversal; phone tap fallback and native CDP scroll; ghost rejection; outside-menu dismissal without world input; unchanged ordinary totals, full rare records, ground piles and player path/task. Console/page errors: none.

Artifacts (local, ignored by Git):

- `screenshots/equipment-interactions/verdict.json`
- `screenshots/equipment-interactions-built/verdict.json`
- Each directory contains `1280-paperdoll.png`, `390-paperdoll.png`, `desktop-drop-feedback.png`, and `desktop-stow-menu.png`.

Screenshots were visually inspected. Equipment controls, slots, occupied backpack row and Stow menu are visible and usable; the surrounding phone header remains crowded, outside this equipment change. Built gameplay asset `routes-CPR7nYbR.js` was byte-compared with the locally served file: SHA-256 `4438e82d6ead0c32579655cf06d64059e5d244aa6819deaf19224c3b5e3ef651`.

## Limits and resolved verification issues

- Chromium desktop and phone emulation, not physical iOS/Android or Firefox/Safari. Phone support is the explicit tap fallback, not a custom touch-drag gesture.
- Four harness setup mistakes were corrected: initial Guide timing, toggling an already-open drawer, treating the store speed action as a value, and restoring only one of the two ghost flags. They were not counted as product failures. Browser QA also caught and removed a real click-suppression latch that could survive removal of a drag source.
- Initial regression failures were the obsolete one-click Unequip label assertion and stale AST art inventory; both were updated, and the complete check subsequently passed.
- Rebuilt previews require an actual owned Vite child-process restart on Windows; killing only its shell can leave it listening. Final built QA ran after stopping the old listener and confirming the replacement was ready.
- No catalog/balance changes; crafting balance gate was not needed. No user's saved game or hosted deployment was modified.

## Final self-audit

- **Incomplete work:** no stale equipment callers or old one-click guide text found in the source/reference search; acceptance paths above are implemented.
- **Untested:** physical phones and non-Chromium engines remain unverified; no hosted QA because deployment was explicitly excluded.
- **Pattern issues:** no new dependencies or state schema. The equipment-only menu is local to the existing paperdoll; world context actions are unchanged.
- **Hidden concerns:** the crowded surrounding phone header is visible in screenshots and was not redesigned. The bounded QA fixture is disclosed above rather than represented as an unmodified player save.
- **Cleanup:** owned Vite listeners were stopped and both IPv4 URLs refused connections; generated placement and route files were restored. Only feature files, tests, this report and the required ledger refresh remain.
