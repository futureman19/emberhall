# Settlement interaction smoke — handoff

## Status

**Browser execution intentionally deferred** at the parent's request to avoid contaminating Phase 0 performance captures. No screenshot or interaction result is claimed here. The harness is authored and syntax/preflight checked, but its browser path has not yet been exercised.

Files owned by this slice: `scripts/settlement-smoke.mjs` and this `smoke-baseline/` subtree only. No runtime, package, branch, commit, or deployment changes.

## Executed, browser-free checks

- `node --check scripts/settlement-smoke.mjs`: passed.
- `node scripts/settlement-smoke.mjs http://127.0.0.1:8093 original-preflight --preflight-only`: passed canonical footprint preflight, `browserExercised:false`.
- Rejected original proposal `(249,295)` in `rejected-249-295/results.json`: overlaps yard `(248,291)`; hut `(250,298)` only touches the forge boundary. No fixture was inserted and no browser was launched.
- Parent-approved replacement `(253,295)` is now the default. Bounds X `[251.5,255]`, Z `[293.5,297]`; all saved-building overlap comparisons are in `original-preflight/results.json`.
- Existing repo Playwright module imports successfully. Import verification did not launch Chromium.

## Run after parent clears performance capture

From the named repo:

```bash
node scripts/settlement-smoke.mjs http://127.0.0.1:8093 original
node scripts/settlement-smoke.mjs http://127.0.0.1:8093 candidate --authored
node scripts/settlement-smoke.mjs 'https://EXACT-PREVIEW-URL/?qa=1' live-candidate --authored
```

Do not call a changed server `original`. Run the first command only against the original bank/forge renderer before candidate integration. Labels control independent evidence directories. `--out=DIR` and `--save=PATH` are optional; `--forge=X,Z` explicitly overrides the parent-approved fixture coordinate, still collision-gated. All fixtures exist only in a fresh browser context loaded from the source save.

## Browser path acceptance

The harness writes JSON incrementally and uses bounded Playwright waits. It is designed to exercise:

- Exact local Fiber `_roots` camera/scene, imported from the exact Vite dependency URL used by `world-scene.tsx`. Bundled targets attempt their own React/R3F ancestor objects, and fail explicitly when the target scene cannot be accessed. No local proof is substituted for live proof.
- Actual mouse selection at projected original voxel instance centres: bank selects Pell, forge opens `openCraft`. Camera matrices, projection points, instance IDs, and selected state are saved.
- UI Bank gold / Take 10 / boards deposit and withdrawal, with exact state assertions.
- Simulation `useTile` entry/exit through the positive-Z entrance, using 240 fixed `.05` ticks. These are explicitly distinct from the separate terrain mouse-walking assertion.
- Original voxel counts before/inside/after; inside shows original visible voxels, removes cut voxels, and removes authored exterior group. `--authored` requires `blender-bank-exterior` and `blender-forge-exterior` outside on the actual target scene.
- Desktop 1440×960 and mobile-size 390×844 CDP screenshots outside/inside/crafting. Mobile-size is viewport layout proof, not a physical phone test.
- Typed-only iron smelt via the recipe-row UI Make button; unchanged rare highland/ruby/redwood sentinels.

## Known source-level baseline issue (awaiting runtime proof)

`craft-gump.tsx:138` computes `ready` with `haveNeed(pack,rec)`. `craft.ts:200` checks only legacy pack quantities, whereas the engine's generic iron requirement and `maxCraftable` count typed resources. Typed-only Smelt ore is therefore expected to have a disabled UI Make button. The harness records this as a failure/blocker with row text, exact inventory, and screenshot; it does **not** inject legacy ore or invoke crafting directly to fake UI success. It continues other smoke checks after that known blocker.

Smithing 100 still has only 95% success (`skills.ts:19–21`). If the UI is enabled, the harness explicitly installs a disposable `.5` Math.random roll only around the actual UI click and restores the original function in `finally`; this is recorded in JSON. No mock is installed when the UI is disabled.

## Remaining validation

The parent must run and, if necessary, debug the browser path after performance capture. Scene discovery, click candidate visibility, route arrival, composed screenshots, and production React/R3F traversal are not validated by the browser-free checks. Do not report the full interaction harness as passed from preflight output.
