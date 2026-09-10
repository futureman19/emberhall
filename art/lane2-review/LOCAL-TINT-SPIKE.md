# Local tint conversion spike — not integrated

Hypothesis: repeatedly parsing the three Lanternwood ground tint colors wastes full-grid rebuild time even after base kind palette optimization. Browser-only candidate memoizes exact colors with ColorManagement enabled/working-space invalidation; no ground math, density or scenery changes.

Four desktop/mobile buffer/pixel comparisons matched forced original full rebuild exactly. Production-built ABBA walking all4 arrived; no errors; lint passed. Near rebuild original72.8/69.5ms vs cached85.1/57.1ms; maximum frames original116.6/100.0ms vs cached116.7/83.4ms. Overlap and variance do not establish improvement. No runtime source edit and no deployment. Keep this experiment parked rather than add caching complexity on weak evidence.

Raw civic/local-tint-palette-parity.json and local-tint-walking-control.json. Next prioritize unresolved player visibility acceptance; further terrain micro-optimizations need a stronger measured hypothesis.
