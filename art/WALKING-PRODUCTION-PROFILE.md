# Production-build movement check

npm run build passed; isolated npm run preview server on127.0.0.1:8094 returnedHTTP200. Two sequential mobile controlled-corridor walks using the same save/setup/pathfinding/speed and CDP1000us sampling as development diagnostics completed.1275 moving frames:638/637. p95 16.7/16.8ms; median16.7ms each. No page errors. Lint passed.

Profiles use compiled assets/routes-DFIjPVbC.js, with no sampled jsxDEV functions. Raw walking-production-profiles.json and walking-production-0/1.cpuprofile retained in art/verification/civic. Development p95 was33.5/50.0ms under the preceding same diagnostic. This is a build-mode comparison, not a new runtime optimization or proof of all town scenes/hardware. CDP sampling adds overhead; runs are sequential, not interleaved counterbalanced build modes.

Conclusion: production-built controlled walking was substantially smoother in this bounded test. Streaming has not been established as a failing bottleneck here. Do not change rendering from development overhead alone. No runtime/art changes or deployment; current isolated preview remains unchanged. Next acceptance work: production-built original mobile hall and hoe fixtures, with retained baseline/candidate methodology, rather than speculative corridor optimization. Global performance acceptance remains open.
