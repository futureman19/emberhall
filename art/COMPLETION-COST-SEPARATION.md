# Completion cost separation

Read-only browser instrumentation of current deployed bundle, AST-selected exact terrain callback and minimap paint function (one each asserted), plus WebGL buffer/upload/draw methods. Settled mobile hoe real-time controlled action, four post-completion frames. No CDP CPU profiler. Outcome passed, lint passed. Raw actions-completion-costs/results.json preserves call timestamps, durations and RAF timeline.

Measured terrain callback total288.3ms across32calls, including66.0ms early call and222.1ms completion call. Other calls nearly zero. Completion call performance.now14011.2..14233.3ms falls within RAF interval13994..14244ms (250ms). Minimap repaint follows at14263.6ms, duration9.7ms. This is direct temporal evidence that completion terrain callback dominates this captured250ms interval, not cached minimap repaint.

WebGL method CPU totals: bufferSubData3.8ms/166calls, bufferData0.2ms/80, drawElements3.4ms/6786, drawElementsInstanced0.9ms/1376, drawArraysInstanced0.2ms/288. Timing includes instrumentation and browser driver behavior; these are CPU submission costs, not GPU execution times. GPU time remains unmeasured, no general hardware claim.

No runtime change/deployment. Prior potential cache regression not statistically cleared, but the captured remaining hitch is now localized to terrain CPU rebuilding. Next optimization target: repeated occupancy/biome/height calculations inside that single revision rebuild, with exact parity and action-time validation; do not lower density or frequency.
