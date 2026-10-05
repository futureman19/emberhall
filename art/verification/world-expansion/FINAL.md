# Final verification

Implemented locally; no commit, push, deployment, or real save access.

## Area / compatibility
512 × 512 = 262,144 tiles -> 1,145 × 1,145 = 1,311,025 tiles: 5.001163482666016× total area. Nearest square rounding is +305 tiles against exactly 5×. Expansion is east/south to preserve nonnegative legacy coordinates, not a centered rescale. Legacy height/biomes and herb populations retained; eastern connecting road intentionally touches the existing Ironfold approach.
Existing tile-free v4 saves regenerate expanded terrain and reapply scars. No new-world requirement or new save key; load does not rewrite storage. Disposable regression covers state and optional Person.look. No real user save was accessed.

## Integration
Nine named chart/minimap sites: Twinward Gate (560,268), Winter Crown (720,268), Grimroot Warcamp (900,268), Mossveil Sanctuary (560,560), Hollowvein Diggings (760,560), Reedwake Landing (960,560), The Amber Rest (560,820), Ashfall Caldera (820,820), The Elder Circle (1020,1000).
Nine connecting road edges; bounded road-graph routing validates live cells, with outward and return route tests. Static collision footprints preserve gate entrances and a mill ford; reservation excludes field rocks and player houses. Terrain pads seat models. Art is non-pickable, has cached requests and collision-shaped fallback. Rendering queries 25 spatial buckets on chunk change rather than scanning the expanded map each movement frame.

## Inventory
37 authored prefab placements: landscape-kit 14, trails-kit 11, buildings-landmarks 8, orc-encampment 1, abandoned-mine 1, woodland-shrine 1, river-ferry 1. Exact asset ids, URLs, coordinates, bounds and collision rectangles: src/game/frontier-art-catalog.ts.

## Gates
- Targeted RED/GREEN coverage recorded in this directory.
- Full npm test final: both suites passed, 276/276 and 777/777; no failures.
- Typecheck passed; changed-file ESLint passed with zero warnings; build passed; auth invariant dev/build agrees sign-in off; AST art ledger refreshed.
- Full npm run check is NOT green: repository-wide lint stops with 7,951 errors and 145 warnings, including unrelated art experiments. This work did not attempt a repo-wide cleanup. Remaining gates were executed separately, not represented as a full check pass.
- Actual dev desktop/mobile, built-output desktop/mobile and rejected-download fallback: each 13/13 harness checks passed. Dev and built each have 22 screenshots and zero page/console errors. Fallback has 6 screenshots, zero page errors, two expected blocked-resource console errors.
- Native ground input and normal simulated movement through the camp gate passed on desktop and emulated mobile. Regional screenshots use disposable QA actor repositioning, not a claim of manually walking the entire frontier. All catalog assets were requested on both candidate surfaces.
- Visual review performed for built Twinward, Reedwake, mobile chart and failed-download fallback (and initial camp/shrine/caldera views).

## Limitations
Expansion increases eagerly generated tile memory/load cost; only rendering is spatially culled. No physical-phone performance benchmark. Mobile chart labels fit but touch targets are compact. Terrain pads can have abrupt exposed edges; mill water and stepping-stone crossing are functionally tested but visually subtle. Exterior buildings have no new interior/services; sealed mine, abandoned camp, wrecked ferry and lava are scenery, not quests, loot, transport or damage mechanics. No exact floating-point area equality was claimed for the square grid.

## Evidence
All paths under C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/world-expansion/:
- full-tests-final.log, changed-lint.log, typecheck-final.log, build-final.log, auth-final.log, full-check.log
- dev-final/results.json, built-final/results.json, fallback-final/results.json
- built-final/desktop-twinward.png, built-final/mobile-reedwake.png, built-final/mobile-chart.png
- fallback-final/desktop-gate-arrived.png

Preview server owned by QA was stopped after built verification; dev server may remain on isolated port 8137.
