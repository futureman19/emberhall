# Phase 1 starting-settlement closeout

## Scope and acceptance
Phase 1 art coverage is implemented for hall, dormitory, kitchen, yard, market, forge, tavern, notice, board, farm and bank. This is an isolated preview, not production promotion, Phase 2 authorization, global visual approval or performance acceptance.

Approved parent adfc02db9e78425deb1671fced0dae1b8a40660d retained. All13 parent-committed GLBs were independently compared against Git blob hashes and match exactly. The earlier21-file snapshot also included8 newly authored interior GLBs, so it is not a count of approved parent assets. Prior exterior batches remain. Eight interior kits replace exact existing furniture cells only after successful loading; original floor/walls, cutaways, pick proxies, world generation and mechanics remain. Dormitory sleeping capacity is logical save data: no invented bed/rest mechanic. Farm beds remain for later landscape work. Notice/board are non-enterable signage, not new quest stations. Original construction ghosts remain intentionally procedural.

## Assets and local proof
Editable interiors-kit.blend and signage-kit.blend, deterministic Blender scripts, actual GLBs and measured manifests are included. Regeneration overwrites manual source edits. Notice: 83576 bytes,1439 triangles,1 material; board:126368 bytes,1947 triangles,1 material. Independent source-reopen evidence and actual GLTFLoader tests retained. Six new canonical test files were verified registered exactly once; 11 focused tests passed in the independent source review.

Same-fixture original baseline:197 checks/14 samples; integrated candidate:305 checks/14 samples. All11 kinds explicitly enumerated in PHASE1-COVERAGE.json, including original per-cell furniture selection and retained geometry. Local production-compatible pointer/action harness:82 checks. HUD independent local browser:36 checks/12 cases, including short landscape844x390 with map size capped above the dock and normal-sized44px controls.

Paired desktop/mobile contact sheets inspected: main footprints, open-room cutaways and visible floors remain; original tree occlusion persists. Changed board silhouettes and smaller/shaped furnishings are intended replacements, not equal-appearance promises. Downsampled sheets do not prove small contact points or hidden details. Individual hall/notice/landscape screenshots were also reviewed.

## Measured performance
RTX4060/ANGLE D3D11,180 frames per sample, same fixture/camera/noon/clear. Inherited commons relative ceilings (p95/heap+20%,draw/geometries+10%,triangles+15%) pass13/14 comparisons; mobile hall-interior p95 fails. Raw baseline/candidate and performance-comparison.json retained. No60FPS, physical low-end phone, memory-leak or global performance acceptance. Earlier hospitality/global failures are not waived by this batch.

## Gates and outstanding verification
Lint,typecheck,build,auth invariant on actual8093 passed; lint rerun after final harness corrections also passed. Canonical npm test:184/196 script tests; exact same12 named baseline failures, no new script failures. Initial game subset:556/557, with stale ledger inventory failure. After evidence-preserving ledger refresh, the full game subset passed557/557. Ledger audit:3121 assets/5016 states, zero errors. Historical city assertion passed this aggregate run but intermittency is not claimed fixed.

Fallback runtime attempt fallback-local-v1 retained. Diagnosis: original markRoof also marks perimeter floor cells as cut, so requiring every y=0 cell inside was incorrect. Same building UUID/handlers were intact. The corrected harness retains strict group, exact-cell and noncut-floor checks; fallback-local-v2 produced103 passing checks for11 fallback kinds and11 invalid placement ghosts. All11 valid placement states remain unreachable under unchanged original rules, so the harness honestly exits2 with acceptanceComplete:false. No application code changed to satisfy it.

## Independent isolated deployment
https://emberhall-vale-euyahys5k-andrews-projects-ffe8a9fd.vercel.app/art/phase1-preview.html
Deployment dpl_3Rr6FoR1wprJeVJTx4QL2567m1ow independently inspected as Preview/Ready. Exact deployed URL passed82 live gameplay/pointer checks,36 HUD checks/12 cases and24 launcher/probe checks. All23 deployed GLB SHA256 hashes match local files; all13 approved parent GLBs also match Git parent blobs. Live board and landscape screenshots inspected; board parchment detail is not legible at distant tactical scale. HUD toolbar and expanded map remain separated at844x390; map occupies substantial gameplay area by design. Live harness recorded no errors. Save backup/restore verified by probe.

The delivered Phase1 art implementation is reviewable, but full plan acceptance is NOT complete: mobile hall-interior p95 fails its relative budget (33.4ms baseline→49.9ms candidate), historical global/hospitality performance gates remain, full canonical script suite has12 existing failures, and legal starting-kind placement previews cannot be exercised in this unchanged fixture. Existing tree occlusion and intentionally retained floors/walls/soil are disclosed. No production promotion.

Next plan phase, only after review: Phase2 people/equipment, starting banker/provisioner/healer, then tools. No Phase2 work started.
