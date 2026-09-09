# Scenery query attribution

Current palette bundle routes-BfNKbK8R.js, browser-only timers in module-scope Tq(occupancy), ta(biomeAt), rL(groundY), HK(resource lookup), active only inside scenery grid. Initial selector included a nested same-name function and failed5!==4 before capture; module-scope restriction fixed instrumentation. No failed performance measurement was interpreted.

Across two scenery scans: occupancy37,878calls/69.5ms; biome23,450/72.4ms; resource1,971/11.5ms; height2,840/2.4ms. Enclosing grids94.0/96.8ms include timer overhead; these are diagnostic ranks, not uninstrumented costs or additive to grid timing. Queries can also contain nested work, so no independent cost-sum claim.

Walk arrived633frames,p95~16.8ms,no page errors; lint passed. Biome classification and occupancy dominate the selected queries. Prior footprint-preparation experiment remains rejected; these measurements do not reverse its controlled result. Next inspect whether repeated biome/occupancy queries can be eliminated within the same scan without retained caches or semantic reordering, and test any candidate uninstrumented before integration.

Evidence civic/walking-query-costs.json and walking-query-lint.log. No runtime/deploy changes. Public preview unchanged; physical-mobile and whole-game acceptance remain open.
