# Loaded-save entity IDs — bounded local closure

## Delivered
`src/game/world.ts` now checks exact live entity IDs before returning a generated ID. An occupied candidate advances the existing module counter and retries. The saved `tickCount`, existing IDs, entity records, ownership, placement validators, charges and save format are unchanged. Current collections are read on each allocation, including after mutable insertion or array replacement; pending allocations still advance the module counter before insertion.

This prevents **new collisions with existing live entities**. It does not repair a save that already contains duplicates or infer which old references should be renamed. No obsolete-save migration was added.

## Evidence
- **Actual browser red:** `house-id-red/results.json` retains real desktop Pack/deed placement producing a porch with `b-27`, already used by a `rampartV`. The loaded fixture counter remained 25 before/after setup. The explicit uniqueness assertion failed; no artificial counter reset was needed.
- **Unit red:** `.hermes/house-id-unit-red.log`: 11 failures, one pass before the allocator change. The later defensive-collection red is separately retained as `.hermes/house-id-defensive-red.log`.
- **21 focused regressions:** actual allocator destinations, additional live entity collections, player identity before body insertion, consecutive collisions, pending allocations, partial bootstrap worlds, mutable replacement, world switching/tick rollback, literal ID comparisons, all three deed kinds with exact chest targeting, and ordinary dormitory cost/bed preservation.
- **937 full tests pass:** 250 script tests and 687 source tests. Typecheck, lint, build, auth invariant and diff checks pass. Logs: `.hermes/house-id-{focused,tests,build,ledger}-final.log`.
- **540 accepted browser assertions / 18 cases**, programmatically joined by mode/device/kind:
  - `house-id-lifecycle-candidate-final`: 190 assertions; porch/hut/homestead × desktop/genuine touch.
  - `house-id-lifecycle-failure-final`: 190 assertions; actual architecture GLB rejection, original rendered fallback, placement and reload/chest checks.
  - `house-id-lifecycle-built-lowtick`: 160 assertions; source-free bundled browser, exact placement and save/reload/chest flow.
- Candidate/failure fixtures retained tick 24; final built fixtures retained tick 23. No tick-counter normalization occurred. Houses received unique `b-58`, `b-59`, `b-60`; all preceding building records remained intact. Startup after fresh reload naturally advances the clock/counter; no whole-world timing parity is claimed.
- Real mouse/touch opens the ordinary context menu and `Open the chest`. Three bandages are deposited, canonical autosave is observed in localStorage, and a **fresh isolated browser context** loads that actual storage state through Continue. All saved building records and pack/owner/bank data are preserved; real input retrieves the three bandages from the exact new house ID.
- All 96 checkpointed GLB/editable-Blender assets match the previous checkpoint. The only application-code change in this slice is the shared allocator; test registration and QA scripts also changed. `house-id-source-before.json` / `house-id-final-source.json` record the scope.
- `house-id-built-freshness.json` records HTTP 200 and exact local-build hashes for all HTML-linked JS/CSS after restarting only the tracked stale preview process.
- Audit: `house-id-acceptance.json`. Read-only reviewer: `subagent-summary-0-20260910_151851_417205.txt`.

All evidence paths above are under `art/verification/worldwide/` unless otherwise specified.

## Fixtures, superseded runs and visual limits
- The real review save supplies loaded records and existing terrain. Disposable setup removes owned houses and adds other-owner blockers at the four automatic free-hut sites, supplies the canonical starter pack plus deeds, pauses the game, and relocates the player to an eligible site. Before chest input the body is relocated within reach. **No walking or general bootstrap-lifecycle acceptance is claimed.** Terrain remains unchanged throughout the placement/chest flow; ordinary save loading regenerates terrain as designed.
- `house-id-lifecycle-candidate` failed an overly strict sparse-pack reload comparison: hydration fills omitted inventory keys. The corrected fixture supplies the canonical full starter pack before exact comparisons. This was a harness defect; save behavior was not changed. `emptyPack()` contains starter items despite its name; those supplied items are fixture data, not placement rewards.
- `house-id-lifecycle-built-final` passed the flow but paused only after network idle, allowing startup ticks beyond the collision range. It is superseded for low-tick acceptance by `built-lowtick`, which pauses immediately at playing and never writes the tick counter.
- Built captures show an opaque homestead near the player and open chest panels. Foliage and notifications obscure portions of the body. The mobile screenshots show the scrollable Pack's first rows, not its offscreen bandage row; exact amounts are established by runtime state and real transfer input, not inferred from those stills.
- The initial desktop comparison crop omitted most of the chest UI; it is not UI acceptance evidence. Corrected left-side crops are `house-id-built-desktop-panels.jpg`; mobile full frames are combined in `house-id-built-mobile-reloaded-chests.jpg`.
- Header/control and toast overlap was observed in chest screenshots. This is retained as a separate UI-clarity follow-up, not hidden by the passing identity checks. No unobstructed-panel or complete-animation claim.

## Remaining
- Already-corrupted duplicate-ID saves are not automatically rewritten.
- Chest header/toast clarity, broader natural housing/bootstrap behavior, full construction/collision/animation, performance and physical-phone coverage remain separate.
- Four fortifications, keep and remaining worldwide architecture acceptance are still open.
- **Local only. Nothing committed/pushed/published by this slice; production and public preview are unchanged.**
