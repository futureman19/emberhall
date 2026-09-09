# Flora roll eligibility browser spike

Source inspection: wooded flora requires hash2(seed+51)<0.14 at most; open-tile flora requires hash2(seed+41)<0.05 at most. All biome-specific thresholds are lower/equal. Candidate checks this necessary condition before occupancy/biome classification for flora only. It does not skip tree/rock placement or any eligible flora; no retained state. Actual source integration still needs exhaustive threshold-contract regression coverage to prevent future thresholds outgrowing the guard.

Browser-only gate in routes-BfNKbK8R.js. Four desktop/mobile exact geometry/instance buffer and pixel comparisons passed via current dev source interception. Eight controlled action outcomes and lint passed.

Same-build ABBA max RAF ms: original-a chop149.9/hoe150.0; gated-a150.0/100.0; gated-b116.7/116.6; original-b199.9/116.6. Overlapping samples: do not claim consistent overall improvement. No per-call profiler; mobile viewport on desktop GPU. Next measure scenery callback/query reduction and moving-window behavior before considering integration; preserve thresholds, equality boundary, seeded outcome and geometry parity.

Evidence civic/flora-roll-parity.json, flora-roll-lint.log and tools/actions-flora-{original-a,gated-a,gated-b,original-b}/results.json. No runtime source edit/deploy; public palette preview unchanged. Earlier footprint, distance-first, active-count, near-biome cache and noise-coordinate experiments remain parked/rejected.
