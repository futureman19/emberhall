# Horizon exact-input cache

Skip only the distant-tree per-frame rewrite when world identity, tiles identity, landRev, seed, exact player X/Z, rebuilt stock identity, mesh identity, graphics limit and matrix/color buffer identities match the prior update. Stock/ground rebuild still executes before guard. Existing ground height inputs use world terrain; runtime terrain mutations rely on landRev as existing streaming renderer does. No instance capacity trimming, camera/LOD/scenery reduction, simulation or appearance change. Previous active-count optimization remains parked.

201 script tests +562 game/component tests pass. Lint/typecheck/build pass. Six desktop/mobile synchronous current-versus-forced-rebuild cases have exact matrix/color/count and PNG equality, including fractional position and new streaming origin with landRev changes. Key tests invalidate every captured input individually.82 local settlement checks pass including pointer walking. These are not all graphics-setting runtime transitions or full performance acceptance.

Same paused mobile-hall600-frame instrumented CPU probe: horizon callback507.6ms total before vs2.8ms cached, max1.7ms vs0.1ms. This measures callback CPU work, not whole-frame/GPU timing, and does not clear historical p95 gates. Raw files hall-cpu-callbacks.json, hall-horizon-cached.json, hall-horizon-parity.json. Isolated preview deployed and independently inspected Ready/preview: https://emberhall-vale-3bg3p2n8n-andrews-projects-ffe8a9fd.vercel.app/art/phase1-preview.html (dpl_BMYnk9JRnE8vm58gV2A33zsjH3bZ).82 deployed settlement checks passed. Runtime source commit8491178. Production untouched.

No frame-time speedup claimed.
