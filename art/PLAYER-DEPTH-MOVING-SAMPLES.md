# Sampled normal-speed route visibility

Desktop and mobile QA useTile route256,298 ->262,302 completed on unchanged terrain. Six samples/device with overlay rebuilt from currently visible source meshes at each sample. All12 source/copy matrix checks exact and removal restores canvas pixels. No page/shader errors; lint passed. First mobile sample has no pixel change; no requirement that overlay show when unoccluded. Remaining samples changed canvas.

Mobile sample3 candidate visually reviewed: gold cue identifies approximate screen position over roof, not exact ground position or detailed facing/action. No continuous animation inference. Diagnostic retains temporary invisible non-depth-writing occluder to preserve transparency regression.

Important boundary: clones are reconstructed per sample, NOT a persistent per-frame overlay. This verifies sampled transforms and route arrival, not live-frame synchronization, equipment replacement or ghost lifecycle. No runtime integration/deployment/performance claim. Next persistent lifecycle prototype with explicit ghost/invisibility suppression and cleanup; alpha-cutout gate remains. Raw civic/player-depth-moving-samples/results.json plus12 before/candidate image pairs.
