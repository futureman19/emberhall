# Preconverted tile-palette browser candidate

Same deployed routes-DihN2Dqi.js, browser interception only. Fixed KIND_COLOR strings converted once using the runtime Color constructor through clone/set, then copied into the original scratch colors. Blend order, live tile reads, local Lanternwood color conversion, density and revision triggers unchanged. Runtime source not modified or deployed.

Exact output check executes candidate and original colorAt per invocation and compares all RGB components using Object.is. Final cumulative counter 212,172 comparisons across setup, near/far rebuilding and controlled hatchet/hoe actions; no mismatch or page error. Not independent final-buffer/pixel parity, exhaustive biome/state coverage or dynamic ColorManagement-change coverage.

Separate no-per-call-instrumentation ABBA results (max RAF ms): original-a hatchet216.7/hoe216.7; cached-a183.3/150.0; cached-b166.6/166.6; original-b233.4/200.0. Both candidate arms lower for both tools, but substantial hitches remain. Mobile viewport on desktop GPU, controlled RNG/max skills, settled disposable fixture, four completion frames. Eight timing outcomes plus two parity outcomes passed; npm run lint passed. Raw results retained under art/verification/tools/actions-palette-*.

Conclusion: promising candidate, not integrated. Next source integration must preserve working-color-space/enabled semantics, run exact numeric and rendered-buffer/pixel parity plus canonical tests/typecheck/build, and independently verify any isolated deployment. No global performance or physical-mobile acceptance.
