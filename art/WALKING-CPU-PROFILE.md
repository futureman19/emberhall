# Moving CPU attribution — diagnostic only

Two sequential cached mobile corridor walks completed with CDP CPU sampling at1000us. Both arrived;482/487 moving frames, p95 33.5/50.0ms. Lint passed. Raw evidence: walking-cpu-profiles.json and walking-0.cpuprofile / walking-1.cpuprofile in art/verification/civic. No runtime changes or deployment.

Largest named JavaScript self-time was development JSX creation: exports.jsxDEV1870.34/1734.61ms and jsxDEVImpl945.34/977.50ms. Other costs include R3F diffProps288.16/292.29ms, updateMatrixWorld213.02/246.26ms and BlockLayer128.61/129.01ms. Sampling is approximate and includes profiler overhead; idle/program entries are not GPU attribution.

Conclusion: this does not establish streaming rebuilds as the long-frame cause. Development React overhead materially confounds current local movement measurements. Do not optimize gameplay or lower scenery from these profiles. Next compare the same corridor on a production-built local server, then attribute long-frame intervals there. No global performance clearance and no speedup claimed. Prior local walking results remain valid as development diagnostics, not production performance benchmarks.
