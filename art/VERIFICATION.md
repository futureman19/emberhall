# Art verification — Phase 0 and first settlement batch

## Protected baseline
- Approved art checkpoint d78a631; tree-identical upstream merge 0fa7360. Fresh feature/emberhall-bank-forge-kits. Original workspace and production untouched.
- Full dirty preservation archive and SHA256 manifest outside repo: profile telegram2/lanternwood-review/settlement/. 44 reviewed explicit files checkpointed; backups, empty {} and generated route line endings preserved.

## Baseline gates
- lint/typecheck/build/auth invariant passed. Diagnostic game suite 515/515 passed.
- Full npm test: 184/196 script tests passed; 12 existing failures stop the && chain before game tests. Exact names in art/verification/gates/baseline-failures.json; full logs adjacent. Never described as full green.

## Reference machine and limits
- 13th Gen Intel(R) Core(TM) i5-13400F; 34164097024 bytes RAM. Chromium 151.0.7922.34.
- Actual renderer: ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002882) Direct3D11 vs_5_0 ps_5_0, D3D11).
- Default headless used SwiftShader: preserved separately under baseline/phase0; short 5–8-frame software samples are diagnostics, not performance certification. Native node.exe bypasses a background shell shim that failed with stdin-is-not-a-tty.
- GPU runs use --use-angle=d3d11 --enable-gpu. Samples have up to180 frames in a10-second bounded window. Paused deterministic fixture, noon/clear, unchanged gameplay camera, DPR1. Desktop1440x960 and mobile-size390x844; viewport emulation is not physical-phone testing.
- 60FPS is an unmet target, not a claim: baseline p95 already reaches33–50ms. No lower-end hardware certification. Graphics-quality settings and population/simulation remain unchanged.
- Scene relocation circuits measure retained render resources/heap on return; they do not establish unbounded leak freedom or real walking frame times. Heap counters are coarse and GC-dependent.
- Cold means new browser context against a running dev server; warm means same context/new page. Not a cold server boot. Load numbers include fixed1000ms settle.

## Baseline frame/cost measurements
| Scene | Frames | p50 ms | p95 ms | Draw calls | Triangles | GPU geometries | Heap bytes |
|---|---:|---:|---:|---:|---:|---:|---:|
| desktop-starting-town | 180 | 16.70 | 49.90 | 444 | 6948140 | 242 | 239000000 |
| desktop-dense-woodland | 180 | 16.70 | 33.30 | 133 | 10645760 | 280 | 239000000 |
| desktop-capital-interior | 180 | 16.70 | 33.40 | 554 | 6065992 | 647 | 239000000 |
| desktop-combat-arena | 180 | 16.70 | 49.90 | 423 | 6826116 | 648 | 239000000 |
| desktop-distant-biome | 180 | 16.70 | 33.30 | 160 | 4787228 | 705 | 239000000 |
| desktop-travel-return-town | 180 | 16.70 | 33.40 | 444 | 6948140 | 705 | 239000000 |
| mobile-starting-town | 180 | 16.70 | 33.40 | 412 | 6944792 | 705 | 239000000 |
| mobile-dense-woodland | 180 | 16.70 | 49.90 | 113 | 10645520 | 705 | 239000000 |
| mobile-capital-interior | 180 | 16.70 | 50.00 | 465 | 6035084 | 705 | 239000000 |
| mobile-combat-arena | 180 | 16.70 | 50.00 | 348 | 6824016 | 706 | 239000000 |
| mobile-distant-biome | 180 | 16.70 | 50.00 | 150 | 4787040 | 705 | 239000000 |
| mobile-travel-return-town | 180 | 16.70 | 50.00 | 412 | 6944792 | 705 | 239000000 |
| desktop-pilot-town-forge | 180 | 16.70 | 50.00 | 458 | 6951332 | 712 | 239000000 |
| mobile-pilot-town-forge | 180 | 16.70 | 50.00 | 426 | 6947984 | 712 | 239000000 |

## Pre-established candidate diagnostic budgets
Per same scene: p95 <= baseline*1.20; p99 <= baseline*1.25; drawcalls/GPUgeometry/material counts <=ceil(baseline*1.10); triangles <=ceil(baseline*1.15); heap <=ceil(baseline*1.20). These relative ceilings do not turn the baseline into smooth60FPS acceptance. Raw exact budgets are in every baseline sample.

- cold-new-context: 7454.3ms navigation-to-settled; 6049.5ms Continue-to-settled.
- warm-same-context-new-page: 5811.5ms navigation-to-settled; 4788.9ms Continue-to-settled.

## Event classification
Hardware baseline recorded PCFSoftShadowMap deprecation warnings. Its separate approved-reference capture hit a missing Continue button because save injection followed initial UI state evaluation; corrected harness now injects save before navigation. This failed capture is retained, not called a pass. Local baseline measurements completed independently.
Software run recorded ReadPixels GPU stalls/deprecation diagnostics. Do not treat a raw event count as page-error count.

## Known retained issues
- Mobile minimap/toolbar overlap; separate UI batch remains required before mobile-wide acceptance.
- Original capital cutaway/interior primitives and most world art are inventoried, not upgraded.
- Typed-only crafting readiness was reproduced: original baseline 44/46 checks passed, with disabled Smelt Make on desktop/mobile. Narrow UI correction delegates readiness to existing world-aware canMake; station/blade gates and simulation remain unchanged. Corrected baseline, authored candidate and deliberate GLB-failure candidate each passed 46/46 checks.
- Final controller rerun: 14/14 focused tests, lint, typecheck and build passed. Diagnostic game suite 529/529; full canonical script suite remains 184/196 with the same 12 baseline failures. Auth invariant passed.
- Independent source-quality review approved the bounded integration; this is not full performance acceptance.
- Bank/forge pilot save inserts forge(253,295), verified zero footprint overlaps. Production/default seeding is untouched.

## Candidate measured comparison
Candidate source art/verification/baseline/candidate-hardware/results.json.
- desktop-starting-town: within diagnostic budgets {"rafP95":true,"rafP99":true,"calls":true,"triangles":true,"geometries":true,"materials":true,"heap":true}
- desktop-dense-woodland: OUTSIDE budget / missing {"rafP95":false,"rafP99":true,"calls":true,"triangles":true,"geometries":true,"materials":true,"heap":true}
- desktop-capital-interior: OUTSIDE budget / missing {"rafP95":false,"rafP99":true,"calls":true,"triangles":true,"geometries":true,"materials":true,"heap":true}
- desktop-combat-arena: within diagnostic budgets {"rafP95":true,"rafP99":true,"calls":true,"triangles":true,"geometries":true,"materials":true,"heap":true}
- desktop-distant-biome: within diagnostic budgets {"rafP95":true,"rafP99":true,"calls":true,"triangles":true,"geometries":true,"materials":true,"heap":true}
- desktop-travel-return-town: within diagnostic budgets {"rafP95":true,"rafP99":true,"calls":true,"triangles":true,"geometries":true,"materials":true,"heap":true}
- mobile-starting-town: OUTSIDE budget / missing {"rafP95":false,"rafP99":true,"calls":true,"triangles":true,"geometries":true,"materials":true,"heap":true}
- mobile-dense-woodland: within diagnostic budgets {"rafP95":true,"rafP99":true,"calls":true,"triangles":true,"geometries":true,"materials":true,"heap":true}
- mobile-capital-interior: within diagnostic budgets {"rafP95":true,"rafP99":true,"calls":true,"triangles":true,"geometries":true,"materials":true,"heap":true}
- mobile-combat-arena: within diagnostic budgets {"rafP95":true,"rafP99":true,"calls":true,"triangles":true,"geometries":true,"materials":true,"heap":true}
- mobile-distant-biome: within diagnostic budgets {"rafP95":true,"rafP99":true,"calls":true,"triangles":true,"geometries":true,"materials":true,"heap":true}
- mobile-travel-return-town: within diagnostic budgets {"rafP95":true,"rafP99":true,"calls":true,"triangles":true,"geometries":true,"materials":true,"heap":true}
- desktop-pilot-town-forge: within diagnostic budgets {"rafP95":true,"rafP99":true,"calls":true,"triangles":true,"geometries":true,"materials":true,"heap":true}
- mobile-pilot-town-forge: within diagnostic budgets {"rafP95":true,"rafP99":true,"calls":true,"triangles":true,"geometries":true,"materials":true,"heap":true}

## Controlled follow-up and acceptance boundary
One sequential art-off/art-on comparison used intentional HTTP503 fallback versus enabled kits, with the same fixture and 14 samples each. All samples reached 180 frames. See `controlled-performance.json` and `baseline/controlled-art-{off,on}/results.json`.
Ten of fourteen p95 comparisons exceeded the 20% relative ceiling; both pilot-town-forge samples stayed around 50ms and within that ceiling. Several unchanged distant scenes had identical draw calls/triangles but higher p95. This does NOT prove harmless noise or identify the cause. Performance acceptance remains BLOCKED; do not claim unchanged performance, 60FPS, lower-end usability, or full batch acceptance. No more repeat loops were used to seek a passing run.

## Isolated deployed review preview
- URL: https://emberhall-vale-3liuqzdyi-andrews-projects-ffe8a9fd.vercel.app/art/settlement-preview.html
- Deployment: dpl_62gBgd9XgPdo4faWhnn5LoX7aQ4m. Independent `vercel inspect` read back target preview / Ready in existing project prj_BAsYtKt8l735E4Bwq4nrSLWYlC1u. Production was not promoted.
- `deployed-preview/results.json`: launcher backup/restore read back exact prior disposable sentinel; all seven requested runtime GLBs returned200; bank/forge/hall/character/oak headers independently parsed. Desktop/mobile visible, no captured page/shader errors.
- `live-gameplay/results.json`: 29/29 checks passed against that exact deployment. Real pointer bank/forge selection, exact gold and goods deposit/withdraw, desktop/mobile ordinary iron Make (one typed iron consumed, one ingot produced), rare stacks retained, doorway entry/exit and actual terrain-click movement. Live craft used actual RNG, not an injected successful outcome.
- Bundled scene-graph introspection was unavailable: failed attempts are preserved under smoke-baseline/deployed*. The separate live harness uses deployed camera/target coordinates and known tested voxel centers to project real pointer clicks, then checks actual UI/world effects. It imports no local game runtime into the deployment. It does not claim live mesh-count introspection.
- All four deployed desktop/mobile outside/inside screenshot pairs were visually inspected together in `live-gameplay/cutaway-comparison.png`: correct small-bank and forge shells disappear to expose interiors; the approved hall keeps its roof. Unchanged interior identity is supported by source/tests, not inferred from screenshots. Existing neighboring stepped hut and mobile minimap/toolbar overlap remain.
- Runtime artifact was built before deployment; subsequent edits only affect QA harnesses, ledger, and documentation. No later phase started. Ledger bank/forge remain integrated, NOT fully verified/approved. This is a reviewable diagnostic preview with an explicitly unresolved performance gate.
