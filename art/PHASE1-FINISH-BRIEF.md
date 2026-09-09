# Phase 1 closeout — starting settlement

User authorization: “Can you finish phase 1”. Parent adfc02db9e78425deb1671fced0dae1b8a40660d, controller feature/emberhall-phase1-finish. Preserve all approved assets, unrelated backups/evidence and original workspace. Upstream fetched; parent ahead 5 / behind 0 origin/main. No production promotion or Phase2 work.

## Explicit scope
All eleven starting kinds: hall, dormitory, kitchen, yard, market, forge, tavern, notice, board, farm, bank. Previously approved exteriors remain unchanged. Close remaining boards/signage and original interior furniture surfaces. Logical bed state has no rendered bed model in this code; do not invent sleep mechanics or claim bed-interaction proof. Farm soil/crop identities stay authoritative, intentionally retained until landscape phase. Existing floor/wall cutaway surfaces remain original with explicit coverage disposition, not falsely called fully authored interiors.

## Ownership
- External Kimi: NEW notice/board Blender assets and contracts in emberhall-signage-ai; no renderer edits. Explicit execution message sent to AI group (79).
- External Grok: mobile HUD commit fad839fd3eaa34d54688db548b962890d86d797e in emberhall-mobile-hud-ai; controller review required. Independent review found short landscape/max-size edge case for controller correction.
- Interior author leaf: eight per-building prop groups + exact voxel replacement helper, editable Blender sources and measured tests; no central renderer edits.
- Baseline leaf: same fixture all11 kinds, per-state inventory, paired desktop/mobile captures and measurements BEFORE integration. Sole browser/GPU ownership during baseline.
- Controller: shared loader, rendering/picking integration, explicit test-list additions, ledger annotation, live verification and isolated deployment.

## Contracts
New interior groups load at [tx,groundY,ty], identity transform. The .5 floor elevation is baked where present. Only successfully loaded asset replacements hide exact original prop cells; original interaction voxels remain as invisible proxies. All decoration no-op raycasts with cached shared resources and dispose=null. Fallback shows original primitives. Building bounds, doors, walls, floors, roof cutaways, station actions, saves, inventories, camera and streaming unchanged. Notice/board keep non-enterable nonstation behavior; no new UI/quests. Ghosts retain original blueprint art.

## Acceptance
Per-kind explicit authored/retained/not-applicable state records; editable source reopen and real GLTFLoader checks; pointer and station actions on desktop/mobile; canonical tests/lint/typecheck/build/auth with exact baseline failures; independent source-spec then quality review; isolated Preview/Ready deployment with live UI and matching asset hashes. Frame sampling is serialized on actual RTX4060; proposed batch relative ceilings p95 1.20x, draws 1.10x, triangles 1.15x, geometry 1.10x, heap 1.20x. Failure is recorded, not retried away or converted into 60FPS proof. Prior global/hospitality performance failures are not automatically waived. Phase1 implementation completion and release acceptance are separate.
