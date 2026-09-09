# Near-ground sampler attribution

Browser-only production-bundle interception of routes-DihN2Dqi.js; settled mobile viewport on desktop GPU; controlled real-time tilling and four post-completion RAF observations. Exact near-block call strings asserted once each; no runtime source edits or deployment.

Raw evidence: art/verification/tools/actions-terrain-sampler-costs/results.json. One action passed, no page errors, npm run lint passed. Each sampler called 32,761 times: height 12.4ms, weights 50.2ms, color 50.8ms, cover 9.2ms. Inclusive vertex loop 154.3ms; finalization 9.5ms; max frame interval 266.6ms. Per-call performance.now/dispatch instrumentation adds material overhead (prior coarse loop was 95.9ms); do not claim an application regression or sum these with enclosing phase durations. These totals locate candidates, not exact uninstrumented savings.

Source check terrain.tsx colorAt: four Color.set calls from KIND_COLOR per vertex, plus LW_GROUND.set(localColor) when applicable. Candidate next experiment: preconvert the fixed palette to THREE.Color values and copy them, preserving ColorManagement semantics, blend order and live tile reads. First establish exact numeric/buffer/pixel parity and then same-build uninstrumented action control. Biome weights are another substantial target; no persistent cache adopted here. No whole-game/physical-mobile acceptance.
