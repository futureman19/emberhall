# Terrain active-count implementation — local checkpoint

One runtime line: hideRest sets mesh.count=from. Existing tail matrix writes retained to minimize behavior differences; no buffer reallocation, active matrix reordering or tile-map changes. Fixed capacity remains reusable as active prefix grows. Original art/materials/camera/shadows unchanged.

Red regression captured in active-count-red.log. New scripts/terrain-active-count.test.mjs executes actual source helper through shrink/empty/grow/full/null and verifies active slot identities/buffer reuse. Green. Initial full test failed because source-line coverage ledger became stale; refreshed and reapplied annotations. Final200 scripts +562 game/component tests pass; lint/typecheck/build pass. Browser tool actions8checks and settlement desktop/mobile82 checks pass, including actual terrain pointer walking.

Post-change hall census4357823 triangles compared to prior6986023 (slightly different animated scene counts). Prior synchronous count-trim proof had exact pixel equality and37.6% triangle reduction. Do not substitute it for broad post-change pixel parity. Four new performance arms remain p95 approximately33.3–33.4ms: no demonstrated timing speedup, original acceptance remains open.

Local implementation checkpoint only; no deployment. Remaining before preview shipping: extended cross-chunk streaming/active-prefix growth, resource pointer identity and representative same-state desktop/mobile visual comparisons. All failed logs retained. src/routeTree.gen.ts unrelated dirt preserved.
