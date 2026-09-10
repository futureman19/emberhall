# Ground update planner foundation — not integrated

Replaced proposed duplicated sampler direction with isolated planning-only helper. Snapshot tile presence/kind/height, bounded span, explicit exact dependency array; returns full/patch/skip and dirty tile coordinates. Existing terrain vertex math remains untouched. Caller must include world/seed, origins, destination arrays, sampled atlas coordinates and ColorManagement state; helper cannot infer omitted dependencies.

Prepare/commit split prevents failed writes from advancing cache. Stale plan commits rejected. Six tests passed covering unchanged/edit modes, each dependency invalidation, tile-array/span replacement, uncommitted retry/stale plans, batch fallback/missing tile and bounded-span rejection. Typecheck and lint passed.

This does NOT close Agent2 integration review by itself: no runtime caller yet, no final-source parity/performance. Snapshot allocations/scans are unmeasured. Needs vertex-neighborhood selection, audited dependency builder, authoritative vertex callbacks and exact buffer/pixel proof. Full regression suite not run for this unused foundation; no deployment. Next integration should avoid duplicated colors/cover/height implementations entirely.
