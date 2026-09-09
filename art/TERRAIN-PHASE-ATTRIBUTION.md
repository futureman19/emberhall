# Terrain phase attribution after shared biome delivery

Browser-only AST instrumentation separates ground near/far rebuild blocks, scenery rescan and minimap. Current deployed routes-DihN2Dqi.js, settled controlled mobile hoe action, no CPU sampling profiler. Labelled run outcome passed; lint passed. Raw actions-terrain-phases-labelled/results.json includes event timestamps, WebGL CPU submissions and completion RAFs.

Labelled completion costs: near ground101.7ms, far ground14.4ms, scenery rescan42.8ms, minimap15.6ms. Earlier action-start scenery rescan56.4ms. Maximum RAF interval166.6ms. Near ground is the largest captured individual phase; GPU execution remains unmeasured, method CPU timings include instrumentation.

Initial broad AST selector matched2 scenery candidates and correctly failed2!==1; narrowed to plantedTimber-bearing terrain scan, not arbitrary instance work. First scoped run had combined ground labels:15.6/93.1ms and scenery50.2ms at completion. Final labels distinguish near via existing rebuild-count increment, with exactly one near/far/scenery/minimap selection asserted. Both successful captures retained, no failed evidence overwritten.

No runtime change/deployment or acceptance clearance. Next focus near-ground height/color/cover vertex loop versus normals/bounds, rather than revisit minimap/footprint/distance hypotheses. Preserve vertex density, refresh timing, and exact buffer output.
