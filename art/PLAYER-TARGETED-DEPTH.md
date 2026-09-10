# Targeted depth prototype

Browser-only depth-material override and player-screen scissor, with shadow refresh suppressed only inside extra pass and original material/state restored. First scissor attempt failed positive controls because generic group Box3 yielded nonfinite bounds. Depth-only/no-scissor control passed. Final bounds enumerate visible player mesh vertices, reject nonfinite values and exclude hidden ancestors; four desktop/mobile isolated/occluded controls pass with exact restoration and no page/shader errors. Failed attempts retained.

ABBA24frames/block with R3F automatic rendering paused and gl.finish: desktop median original4.45/4.60ms vs effect6.80/6.70ms; mobile viewport original4.65/3.85 vs effect6.25/5.65ms. Both restored exact pixels. This is substantially cheaper than prior full-material second pass, but remains added rendering cost. Synchronized local draw cost, NOT production FPS or physical-phone acceptance.

No runtime integration/deployment. Ordinary depth override has not established alpha/transparent/custom-discard equivalence; moving bounds, equipment/ghost states and picking cleanup still need gates. Next motion/ghost lifecycle before integration. Raw civic/player-{targeted-depth-spike,depth-only-control,scissor-diagnostic,targeted-depth-finite,targeted-depth-cost}/results.json.
