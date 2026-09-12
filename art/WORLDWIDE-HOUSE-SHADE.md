# Deed preview and paused insertion — bounded local closure

## Delivered
- `placement-preview.ts` chooses `houseSiteError` for porch/hut/homestead and preserves ordinary `siteError` for every other kind. It is read-only; validators, placement commands, costs and ownership rules are unchanged.
- `GhostAt` subscribes to the current boolean result. Deed loss/restoration changes the shade while the pointer stays still: valid `#c9a36a`, invalid `#a85a42`, including footprint, volume, outline, doorway mark and voxel layer.
- `Buildings` additionally subscribes to mutable-array length. Newly placed bodies now mount while paused, without needing to walk first. No geometry or artwork edits.

## Fresh verification
- **916 tests pass** (250 script tests +666 source tests), including nine new preview/insertion regressions.
- Full typecheck, lint, build, auth invariant and diff checks pass. Logs: `.hermes/house-shade-final-{tests,build,ledger}.log`.
- **282 browser assertions**, programmatically reconciled to all three deed kinds × desktop/genuine touch in each accepted mode:
  - `house-shade-verified-candidate/results.json`:104 assertions, six cases.
  - `house-shade-verified-failure/results.json`:104 assertions, six cases, actual GLB request rejection and exact original outside voxel sets.
  - `house-shade-verified-built/results.json`:74 assertions, six cases, no browser source imports or private scene inspection.
- Evidence directories are under `art/verification/worldwide/`. `house-shade-acceptance.json` joins all18 case records and captures; no superseded passes or failures are included in the282 total.
- Actual Pack/deed selection and terrain press/release: no direct placement call. While held, remove the deed in the disposable fixture; the shade becomes invalid and release rejects with the canonical error, unchanged buildings/gold. Restore the deed at the stationary target, then actually press/release: exactly one new canonical owned building, one deed charged, no other items/gold changed, previous buildings and terrain preserved, mode cleared.
- Local scene proof checks the live canonical validator independently, nonzero canonical preview instance count, visible layers and all layer colours. Successful insertion mounts the authored body; failed-load insertion has the exact original voxel set.
- Built desktop/mobile comparison sheets were visually reviewed for all three kinds. Golden/cream versus reddish shade distinction and opaque placed roofs/wall portions are visible in every case. Foliage and construction labels obscure some geometry; this is not whole-body/unobstructed acceptance or animation proof.
- Fresh built HTML-linked assets were byte-compared after restarting only the stale tracked8124 preview. See `house-shade-built-freshness.json`. Current placed GLB responses match source hashes.
- `house-shade-source-before.json`:96 checkpointed GLB/editable-Blender assets unchanged. Only checkpointed `building-meshes.tsx` and `package.json` changed; the preview helper/test and browser script are new. No placement/input/save validator was edited.

## Fixture boundaries and retained failures
This is **controlled placement-display acceptance**, not ordinary-save housing acceptance. The browser loads the existing review save and keeps its terrain unchanged. It supplies deeds, pauses/normalizes the clock and relocates the body to a bounded eligible site on existing terrain. It does not prove walking to that site.

1. **Automatic free hut:** `snapshot()` calls `ensureLookHut()`. Simply removing an owned house recreates it, making the initial fixture invalid. Four explicit other-owner hut blockers at the canonical bootstrap candidate spots prevent that grant in the disposable world. No production bootstrap rule was disabled. Earlier `house-shade-red-browser`, `house-shade-candidate-v1` and `house-shade-candidate-diagnostic` are not acceptance evidence.
2. **True colour regression control:** `house-shade-review-original-red` strictly verifies the response override of the old generic predicate and explicitly passes the independent live canonical-valid assertion. Its only failing assertion is the expected shade colour: the old policy renders a visible red `a85a42` porch with114 instances and visible red sibling layers at that legal site. The earlier `house-shade-original-red-final` captured preview-helper validity but predates the independent live canonical assertion; it is not independent-validator red proof. `.hermes/house-shade-red.log` retains the unit red before the dispatch fix. A preceding `house-shade-original-policy-red` had a missed query-string override; it is not colour-regression proof. `house-shade-review-reconciliation.json` records the delayed review reconciliation; the expected failing control is excluded from the282 accepted assertion total, and application source hashes still match the final checkpoint.
3. **Separate inherited ID collision remains open:** in that low-tick loaded fixture, actual `placeHouse` generated `b-27`, already belonging to an original `rampartV`. Raw evidence is retained in `house-shade-original-policy-red/results.json` (before and placed records). The final QA fixture records raising its tick counter beyond existing numeric IDs to isolate display testing. **Runtime ID generation was not fixed**, and no save-wide uniqueness guarantee is claimed.
4. **Paused insertion red:** `house-shade-candidate-final` passed its initial assertions but its placed screenshot showed bare ground; it is superseded, not accepted. `house-shade-failure-final` exposed missing actual porch/homestead requests. `.hermes/house-shade-insert-red.log` retains the new insertion regression before the length subscription. The final accepted runs prove insertion without moving the player or advancing the paused clock.

## Remaining / release
- Low-tick loaded-save ID collision and general housing/bootstrap lifecycle.
- Fortifications, keep and remaining global building coverage.
- Natural-world breadth, complete construction animation, collision, performance and physical phones.
- All changes are local. Nothing published, no production changes, no committed/pushed release claimed.
