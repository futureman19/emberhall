# Fortifications — controlled render/input closure

## Accepted scope
All four already-integrated styles—`rampart`, `rampartV`, `tower`, `gatehouse`—pass the bounded candidate, original-policy, actual failed-download and built-output checks. No additional application or art changes were needed. All410 checkpointed source/package/art files, including114 GLB/Blend assets, remain byte-identical to the pre-slice checkpoint.

These are non-enterable structures. They do not provide a chest, crafting station, dedicated house hold, cutaway room, operable gate or moongate. Fortifications are absent from the player-facing build list; this does not claim the generic placement API rejects their kinds. Keep/story coverage remains separate and original.

## Evidence
- **808 accepted browser assertions:** candidate241, original-policy215, actual503 fallback215, built137. Exact joins cover32 fortification mode/device/kind cases plus8 loaded-city mode/device supplements.
- Accepted results: `fortifications-candidate-v3`, `fortifications-control-final`, `fortifications-failure-final`, `fortifications-built-final`, each with `results.json` under `art/verification/worldwide/`.
- Candidate retains exact original visible foundation/proxy coordinate **multisets**: rampart32/168, rampartV32/168, tower25/167, gatehouse45/298. Tower has163 unique proxy coordinates; its original duplicated crown corners were not deduplicated.
- Original-policy and failed-download runs restore the exact complete original visible voxel multisets. All four loader kinds are really rejected on both devices before caching;26 deliberate503 errors match26 injected requests. Original-policy module overrides are explicitly checked, not assumed.
- Actual desktop clicks and genuine touch taps dispatch ordinary ground walking through the original input layers. Captures occur both while a path is active and after arrival. Entering these footprints does not cut away the exterior or open house/station/gate UI. Flat-dirt traversal is **not wall collision evidence**.
- Candidate/control/failure/built building records and sampled movement tracks compare exactly, including the static gatehouse's X-running passage. Moving development captures retain the same visible/proxy geometry as their stationary captures.
- Node GLTF/spec tests verify all11 architecture files, measured bounds, materials, fixed door corridors, upward roofs, routing and retained keep logic: **4 focused architecture tests pass**. Exact scene-coordinate assertions are development evidence; built browser geometry inspection is null and is not promoted to equivalent proof.
- The final built desktop/mobile sheets show all four complete coherent exteriors clear of HUD clipping. Small masonry details and passage through-clearance are not fully readable from stills. The existing city gate can obscure part of the player; no whole-body/full-animation acceptance is claimed.
- `fortifications-built-freshness.json` verifies HTTP200 and exact final-build bytes for all HTML-linked local JS/CSS. Each relevant served GLB matches its source hash. The current tracked preview already served the identical build; no restart was needed.

## Unchanged-terrain city supplement
The loaded review world supplies the existing west gatehouse at `(152,336)` and adjacent wall. Only body placement and actor isolation are fixture changes; tiles/heights and all building records are hash-preserved.

Real desktop/touch input walks `(154,336)` to `(150,336)` through the existing passage. For `(154,332)` to `(150,332)`, the direct wall segment is invalid, the actual planned route detours through an existing gate opening, every smoothed segment passes canonical `lineWalkable`, and the player arrives. Candidate/control/failure/built planned routes and sampled tracks match exactly. This is one loaded-city policy probe—not all seeds, natural AI, or universal collision acceptance.

## Tests and separate generated-route failure
**The full canonical run passed950 tests (250 script +700 source)**, including that run's city tests. Typecheck, lint, build, auth invariant and diff checks pass. Logs are `.hermes/fortifications-{tests,build}.log`; final focused art log is `.hermes/fortifications-architecture-final.log`.

However, the earlier focused architecture+city run passed6 and failed1: the unseeded `city.test.ts` assertion for a route from the plaza `(176,336)` to `(140,336)` beyond the west gate. This failure is not erased by the later full pass.

A bounded deterministic probe found **seed2469134** reproduces a null route to that destination with search caps4000 and20000, while the local gate crossing still succeeds. The original failing random seed was not logged; this is a reproducible counterexample, not a claim to have recovered that seed. The generated destination is a tree tile at height7; surrounding terrain heights vary. **The broader route issue remains unresolved.** No test was weakened, no navigation rule relaxed and no terrain repainted to make this seed pass.

Diagnostics: `fortifications-city-seed-diagnostic.json`, `fortifications-city-bounded-seed-probe.json`, `fortifications-city-route-cap-diagnostic.json`, plus `.hermes/fortifications-focused.log`. This is a separate generated-terrain/pathfinding/test-contract follow-up, not a renderer regression: production source and art are unchanged.

## Retained harness iterations and review
- v1 candidate/control/failure passed controlled endpoint checks. Final runs add active-path captures, explicit cross-mode comparisons and the unchanged-city supplement.
- Candidate-v2 city segment validation assumed path points were `{x,z}`. Runtime records use `{tx,ty}`; the raw failing record is retained. Final validation explicitly maps these fields without changing the command/path itself.
- An unused copied `BUILD_SIZE` import initially failed the zero-warning lint gate; it was removed from the harness. No application fix was involved.
- Read-only review: `subagent-summary-0-20260910_165155_798265.txt`. Its multiset, non-enterable, tile-collision, X-passage, real-loader, moving-frame and built-scope cautions are incorporated.
- Aggregate audit: `fortifications-acceptance.json`; source checkpoint: `fortifications-source-before.json`.

## Remaining / publication
The generated-route counterexample, keep stories, earlier worldwide kits, broader natural placements/AI, construction/collision matrices, complete animation, performance and physical phones remain open. **Controlled fortification scope is closed; general world/release acceptance is not.**

No application/art edits, commits, pushes or publication in this slice. Local built preview verified; production/public preview unchanged.


## Later resolution of the seed-route finding

`WORLDWIDE-CITY-ROUTE.md` supersedes the pending classification above. The original endpoint140336 is an isolated off-road tree, not the Millcross road. Exact-seed positive/negative tests and native dev/built ground-out/mini-map-return checks resolve the assertion without runtime or terrain changes. Original failing evidence remains historical; general road continuity is still not accepted.
