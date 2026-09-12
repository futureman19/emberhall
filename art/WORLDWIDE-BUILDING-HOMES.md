# Worldwide enterable building batch — controlled closure

## Delivered locally
Seven newly routed architecture kinds pass bounded visual and input acceptance: **shop, townhome, townhouse, cottage, porch, hut, homestead**. Approved-style exteriors render beyond the former court radius. Actual desktop/multitouch-capable Chromium inputs walk in and out; authored shells disappear on entry and restore on exit. The interiors remain the **original voxel interiors**, not new Blender furnishings.

Two existing chest UX issues reproduced and fixed:
- Touch hold near an ordinary house-ground tile opens the existing context menu. Its real **Open the chest** button opens the owned porch/hut/homestead chest. Short taps still walk. Mouse behavior and ghostwood-first handling remain unchanged.
- The chest panel subscribes to fresh snapshot identity instead of mutable nested bag references. Deposit and retrieve now update both UI columns while paused, with no clock advancement required.

The new predicate also preserves both rounded context-target priority and the existing 0.9-unit primary fauna/NPC priority. Read-only review found the fractional-position omission; two failing regression tests were added before fixing it. Ownership, range, ghost restrictions, transfer quantities, chest capacity, construction rules, artwork, camera implementation and simulation logic were not changed.

## Evidence and counts
Canonical gates on final source:
- **907 tests passed**: 250 script + 657 game/component, zero failed/skipped/cancelled. `.hermes/building-homes-priority-tests.log`.
- Typecheck, full lint, build, auth invariant against dev8123 and diff check pass. `.hermes/building-homes-priority-build.log`. DATABASE_URL empty, migration skipped; no database writes.
- Seven-kind accepted batch: `building-homes-ux-{candidate,control,failure,built}-final/results.json`: **244 / 258 / 258 / 174 = 934 assertions**, 56 exact mode/device/kind records.
- Final fractional-priority follow-up: `building-homes-priority-{candidate,control,failure,built}/results.json`: **146 / 152 / 152 / 116 = 566 assertions**, 24 records. This reruns **all three affected house kinds**, not all seven, on the final predicate. Includes actual arriving-NPC and till-armed cancellation.
- **1,500 accepted building assertions across those two batches**, not one simultaneous run. Earlier diagnostic/pre-fix/v1 runs are excluded from these totals.
- Ghostwood regression: `building-house-ghostwood-{candidate,built}/results.json`: **84 + 66 = 150** additional assertions. Real ghostwood hold/menu/Chop and lifecycle still pass. This ran after house-hook integration, before the final living-house entity-priority-only predicate adjustment; the ghost rejection itself is unchanged.
- `building-homes-evidence-audit.json` reconciles exact kinds, captures, checks, asset hashes, camera values and follow-up scope. `buildings-homes-acceptance.json` contains the seven per-kind ledger entries.

All evidence paths above are under `art/verification/worldwide/` unless explicitly prefixed `.hermes/`.

## What was actually exercised
Fixtures use isolated browser storage loaded from the existing review save. One building at a time is placed at (256,320), beyond the former court policy; unrelated entities are cleared and a bounded area is flattened to dirt. No production/user save is changed.

For each kind and viewport:
- Normal-camera exterior capture; development checks prove authored routing or original geometry control.
- Actual mouse/touch ground input from (256,325) to (256,320), normal fixed simulation substeps, path completion, interior capture, then actual exit and exterior restoration.
- Development scene records prove exact canonical original noncut voxel positions on entry and original visible/proxy positions restored on exit. Bundled browser checks deliberately do not import source or claim private scene introspection; built exterior/interior screenshots were visually reviewed.
- Owned porch/hut/homestead: real desktop right-click or real touch hold, real menu and transfer buttons, exact three-bandage round trip, correct paused UI columns and unchanged clock. Complete building records are compared, allowing only the intentional zero-valued bandage entry.
- Invalid house gestures: short-tap walking plus drag, pointercancel, second finger, ghost state, changed owner, changed target ID, phase, build/spell/till arming, and a newly arriving fractional-position NPC. Eligibility is checked at gesture callbacks; transient changes entirely between checks are not claimed latched. World replacement and blur/visibility cleanup are source-reviewed, not independently browser-certified here.
- Fresh-context actual architecture GLB HTTP503 rejection covers every requested kind on both viewports. Original outside geometry remains and inside/input/transfer checks pass. Original-art routing control is separate from network fallback.

Shop/townhome/townhouse/cottage are ordinary shells, not crafting stations or house chests. No imaginary shop service was added or tested.

## Artwork and built freshness
- All **414 checkpointed existing source/package/artwork files** were hash-compared. Only `package.json`, `src/components/game/terrain.tsx` and `src/components/game/house-gump.tsx` differ; the new house helper/hook/tests are separately listed in the audit. The ledger refresh is outside this checkpoint.
- No GLB or Blender source changed. All seven building GLBs were freshly fetched from the latest rebuilt preview and match baseline, source and built bytes.
- `building-homes-original-specs.json`: independently extracted current and HEAD canonical SPECS are identical for all seven kinds.
- `.hermes/building-homes-blender-verify.log`: Blender reopened the existing editable architecture source in **--verify** mode without regenerating. Named editable parts/materials/modifiers and upward roof surfaces passed. The verification also reads the four fortification sources; this does not grant them gameplay acceptance.
- Rebuilds exposed stale cached SSR HTML references on the tracked8124 preview. Only that process was restarted; exact fresh HTML-linked JS/CSS bytes were checked before built tests. See `building-homes-priority-built-freshness.json`; prior stale findings remain saved.

## Visual acceptance and retained limitations
Final seven-entry built desktop/mobile exterior sheets and mobile cutaway sheet were reviewed, alongside desktop cutaways, original/failure controls and native frames. Whole exterior silhouettes, visible roof seating and lower-wall/ground contact are coherent. All seven retain coherent original interiors on entry. Small seams, hidden rear faces, detailed animations and full-body clearance are not certified. Furniture still partly obscures the player in interiors.

Initial tight desktop crops clipped lower corners; final `building-homes-ux-built-final-desktop-outside-complete.jpg` includes every base. Earlier mobile gesture-negative drags legitimately panned MapControls, contaminating later captures. The final harness runs those drag tests after all normal-camera captures. Exact camera/projection values match across the four final seven-kind modes. No camera behavior was changed.

The original hut's rooftop detail looked detached in a tight crop; the full original frame shows no clear large separation. Its tiny connection remains unresolved, not a newly introduced defect. The chest's transient toast can overlap its transfer illustration/labels; tested inventory buttons and Close executed. This is not full HUD-clearance acceptance.

## Remaining / next
- Four fortifications (rampart, rampartV, tower, gatehouse), retained original keep stories and remaining worldwide checks for earlier approved kits.
- Existing deed-placement ghost uses ordinary `siteError`, so legal house deeds show invalid-colored preview shading. Actual placement uses the correct house policy. This inherited **construction-preview** defect is recorded, not fixed or waived by this interaction batch.
- Natural city/terrain placements, collision/body clearance, complete construction and ownership/ghost matrices, dense scenes, performance, physical phones and overall release gates remain open. Pathfinding uses terrain rather than building mesh colliders: an entry walk is not proof that every other wall blocks movement.

**No commit, push, public preview or production deployment.** Local built preview updated; production unchanged.
