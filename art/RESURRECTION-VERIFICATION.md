# Resurrection material repair

Base76cfc6f; isolated preview only. Real disposable flow: position near healer, inject HP0 injury, execute normal simulation tick (dieAsGhost), select healer, click actual Return me button (resurrect). Red reproduced living HP with opacity0/depthWrite0 on body materials. This is not merely the earlier direct ghost-flag fixture issue.

Fix: normal Mat explicitly restores opacity1, transparent=false, depthWrite=true, emissive black/intensity1, roughness. Ghost0.58 styling unchanged. No gameplay, inventory, death penalty, geometry or animation changes. R3F reuses the material: previously omitted scalar props returned as0 rather than the required living defaults.

Local desktop/mobile red->green. Every inspected root body material matches pre-death opaque properties exactly after the healer return; HP>0 and ghost=false. Material test is source-contract guard backed by actual runtime reproduction, not claimed as standalone integration proof.

Final lint/typecheck/build pass; canonical199/199 scripts and562/562 game/components pass after refreshing stale AST coverage ledger and restoring prior annotations. Initial stale-ledger failure retained. Final lint after extra diagnostic screenshot harness also passes.

Exact deployed preview https://emberhall-vale-ohhfcdd6o-andrews-projects-ffe8a9fd.vercel.app/art/phase1-preview.html inspected Preview/Ready dpl_HLhHVZfp2UTnFLSZoFGnPqvz7syE. Both desktop/mobile healer death/return flows pass, plus82 existing settlement live checks. Bundled material introspection unavailable: live health/state and screenshots are separate evidence, not live opacity assertions. Original live scene roof/restore FX obscured the player. Additional explicitly relocated diagnostic screenshots show solid exposed player portions but nearby authored trees still occlude limbs; no all-limb normal-camera visual clearance claimed. Local material data is the direct opacity proof.

Evidence art/verification/resurrection/{red,green,deployed,deployed-clear} and phase1/resurrection-live. Existing tool readability/full-cycle/performance gaps remain. No new asset batch, no production promotion; unrelated routeTree and backups preserved.
