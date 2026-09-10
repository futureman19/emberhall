# Non-depth-writing transparency guard

Red regression: disposable invisible transparent box (opacity0, depthWrite false) between camera/player. Depth override treated it as solid: desktop/mobile isolated negative controls both failed, while removal restored pixels. This is actual prototype behavior, not a gameplay scene change.

Green browser prototype temporarily excludes ordinary single-material meshes with source depthWrite false from extra depth pass; restores visibility in finally. All4 desktop/mobile isolated/tavern checks passed: no false highlight, occluded positive remains, exact removal restoration, no page/shader errors. Lint passed.

No runtime integration or deployment. This covers depthWrite false only; alpha-tested/cutout, mixed-material, transparent depth-writing and custom-discard behavior remain separate gates. Motion/ghost/equipment and final performance not yet accepted; prior cost does not include this new visibility scan. Next moving transform/ghost lifecycle harness. Raw civic/player-depth-transparent-{red,green}/results.json.
