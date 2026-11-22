# Emberdeep full-chain playtest

LANE: telegram2 / t_91686e7c
BASE SHA: baa10bb08df33b948af527698ac776a5666d80d0
BRANCH: wt/t_91686e7c
WORKTREE: C:/Users/futur/Desktop/emberhall/.worktrees/t_91686e7c

## Results
Desktop 1440x960 and touch-emulated mobile 390x844 both passed: 15 real combat kills each (14 authored monsters plus Warden), all six rooms cleared, gate opens then seals on encounter then reopens on victory, exactly one Furnace Heart collected, save/reload retains reward and clears, return to entrance (650,565). No console/page errors or horizontal overflow. Final victory screenshots visually inspected.

Fixture limitation: seed 41 veteran, 5000 initial/max HP, sword, swords/anatomy 100; positioned at entry once. Monsters retain original HP and active AI. Movement/combat use real commands and full simulation, not teleporting between rooms or setting dead/cleared flags. This is progression/integration proof, NOT normal-character balance or physical-mobile acceptance.

## Bugs found and fixed
- CSS screen rain continued inside Emberdeep although audio already respected underground state. ScreenRain now excludes only Emberdeep in addition to its existing Greybarrow rule. Browser regression forces rain outdoors and asserts inactive immediately after entry. RED: screenshots/emberdeep-playtest-red/verdict.json, true !== false. GREEN: final verdict.
- Generic combat death note and Warden completion note repeated the boss death phrase in the same toast. Completion note now starts with liberation/reward copy; combat retains its original death line. Existing combat regression logs tickPlayer return values as the real sim does, then asserts one death phrase. RED: emberdeep-warden-red.log, 2 !== 1; GREEN: focused seven tests plus full suite.

Harness-development correction: initial duplicate-note assertion falsely passed because the existing unit fixture discarded tickPlayer return values and compared case-sensitively. Corrected before production change; the revised test failed first. No hidden assertion weakening.

## Verification
- `npm test` final post-fix run exit 0. Summary below.
- `npx tsc --noEmit` exit 0.
- `node.exe --experimental-strip-types --test src/game/furnace-warden.test.ts`: 7 passed, 0 failed.
- `node.exe --test scripts/audit-safety-test-registration.test.mjs`: 1 passed, 0 failed. No new source test file, existing registration unchanged.
- Scoped ESLint on both new scripts and three modified source/test files: exit 0.
- `node.exe scripts/audit-art-coverage.mjs --refresh`: exit 0; only art/asset-ledger.json committed, seven shifted ScreenRain pins.
- `node.exe --experimental-strip-types scripts/emberdeep-playtest-smoke.mjs http://127.0.0.1:8196`: exit 0, both viewports passed.

Final npm summary:
```
ℹ tests 497
ℹ pass 497
ℹ fail 0
ℹ duration_ms 418279.9824
ℹ tests 1416
ℹ pass 1416
ℹ fail 0
ℹ duration_ms 189134.9982
```

## Evidence and rerun
`emberdeep-npm-test-final.log`, `emberdeep-browser.log`, `emberdeep-art.log`, `emberdeep-warden-red.log`, `screenshots/emberdeep-playtest/verdict.json`, and desktop/mobile entry/unsealed/victory/exit PNGs are retained in this worktree. Run the smoke with an explicitly allocated dev-server URL (no default shared port); outputs default to screenshots/emberdeep-playtest. Driver is scripts/emberdeep-playtest-driver.mjs.

Controller granted headless slot in decision__1795338788.json (archived to done). Port 8196 was verified free before launch, owned server terminated after QA, and connection refused with Windows code 10061 afterward. Browser closed in harness finally. Slot released. No push, deploy, chain operations, auth changes, or UI rewrite.

BLOCKERS: none for this scoped chain.
NOTES_FOR_CONTROLLER: screenshot-only shared-HUD observations (mobile bottom-right controls overlap hotbar; desktop minimap edge clipping) routed to independent reproduction task t_8765b104 assigned qwen. They are not confirmed interaction defects and were not changed here. Review/cherry-pick local commit before integration; no production claim.
