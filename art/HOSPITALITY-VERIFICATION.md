# Hospitality batch verification

## Scope and preserved work
Kitchen, tavern and market exterior kits only, built on approved bank/forge checkpoint8423a8d. Same existing project, no production promotion. Existing source backups and diagnostic captures preserved; no original-workspace source edits, simulation/schema/default-seed/camera/streaming changes. Art routing is bounded to18 units from COURT. Interiors and original picking remain authoritative. Market/tavern retain non-station behavior; no trade feature invented.

## Source and geometry
Editable `art/blender/hospitality-kit.blend`; generator `build_hospitality.py`. Independent Blender5.2.1 reopen confirms named editable parts/live modifiers and upward roof normals. Regeneration overwrites manual edits; preserve edits separately.
Actual GLTFLoader measurement and geometry contracts pass for all3. Shared vertex-color export replaces separate diffuse materials while preserving a separate emissive material where present. `art/verification/hospitality/pre-batching/comparison.json` compares triangle corners: maximum observed position, normal, effective color, emission and surface-property errors were all0. Mesh groups reduced9→2 kitchen,9→2 tavern,5→1 market. Triangle counts unchanged; bytes increased because vertex colors are stored, all remain under600KB. No texture or dynamic-light additions.

## Local gameplay and visual checks
Original renderer baseline, first candidate and optimized candidate each passed73 checks; each recorded6 GPU samples,180 frames each. Fixture SHA256 is unchanged across comparisons. Same original footprints and clear approach points; approaching a resource/plot via useTile is an action, not plain walking, so QA selects an actual clear approach without relocating buildings or changing world rules.
Checks include actual original-mesh kitchen pointer selection, Make/roast-meat cost/output, desktop/mobile doorway entry/exit, shell cutaway/restoration, retained market counter and tavern interior, and no spurious crafting for non-stations. Local cooking uses an explicitly recorded temporary .5 RNG roll in the disposable UI test; live QA must label its own RNG behavior.
Normal-camera screenshots show coherent kitchen, inn and curved striped stall. Existing forest occlusion obscures some signs/entrances; approved trees and resource identity were not changed to beautify a showcase. Existing mobile minimap/toolbar overlap remains separate.

## Measured performance: NOT fully accepted
Raw baseline, candidate, optimized measurements and both comparisons are under `art/verification/hospitality/`. Hardware is RTX4060 viaANGLE D3D11; portrait viewport is not a physical phone. Prior global bank/forge performance gate remains unresolved, not waived by user visual approval.
After vertex-color batching all6 sampled draw-call, triangle and heap checks meet the existing relative ceilings. Five of6 p95 and geometry checks meet their ceilings. Remaining failures:
- Desktop tavern p95:33.3→49.9ms, exceeds20% ceiling.
- Desktop market renderer geometries:308→347, exceeds10% ceiling.
The other samples' p95 is around50ms. No60FPS, unchanged-performance or low-end-hardware claim. Do not repeat runs until one happens to pass.

## Gates and deployment
535 game tests passed; full typecheck, build, lint and auth invariant passed. Initial lint caught one unused harness variable (removed); initial auth command used default8080 rather than8093 (rerun with --dev-url passed). Raw failed attempts are retained. Full npm test has exactly the same12 named baseline script failures; programmatic set comparison passed. Source-spec and subsequent bounded runtime/launcher quality review passed with no blockers; that review excluded the export optimization and does not clear performance.

Deployed isolated Preview/Ready: https://emberhall-vale-im01t0obl-andrews-projects-ffe8a9fd.vercel.app/art/hospitality-preview.html . Independent Vercel inspection and launcher backup/restore probe passed.39 live gameplay checks passed on that exact deployment, including pointer walking, original kitchen selection and successful normal cooking on desktop/mobile with actual runtime RNG (no injected roll; at most3 normal attempts permitted). Desktop/mobile outside/inside image pairs for all3 buildings were visually inspected: each shell/canopy cuts away to retained interiors/counter. Existing tree occlusion obscures portions of rooms; screenshots do not prove exact mesh identities, which are covered locally. No camera/forest changes were made to hide that limitation.8 live asset SHA256 values match local approved/current files. No production promotion or later phase.

Ledger refresh:3114 assets,4982 states, zero audit errors. Bank/forge visual approval is recorded separately from performance acceptance. Hospitality remains integrated/review-pending, not fully accepted.
