# Distance-first scenery predicate spike — not integrated

Updated deployed CPU traces (actions-shared-ground-cpu) still show blocked scan and biomeAt/noise in scenery update. Direct minified source mapping verified biomeAt and original blocked predicate. Proposed browser-only condition reorder performs identical distance cutoff before pure blocked scan. Does not change thresholds or output conditions; no source/runtime edit.

Four same-build original/distance-first/distance-first/original runs, mobile hatchet then hoe, no CPU profiler. All8 outcomes passed; lint passed. Summary distance-control-summary.json and raw actions-distance-* retained.

Worst frames(ms): original hatchet216.6/166.7, hoe183.3/166.6. Candidate hatchet216.7/233.3, hoe200.1/166.6. No consistent improvement; candidate not integrated/deployed. Functional success is not a performance pass. Source condition remains unchanged; current shared-ground preview remains latest.

This closes another bounded hypothesis. Do not repeat near-identical timings; remaining work needs phase-level cost reduction with a demonstrable local CPU benefit and composed frame validation, not more heuristic condition reordering. Global performance acceptance remains open.
