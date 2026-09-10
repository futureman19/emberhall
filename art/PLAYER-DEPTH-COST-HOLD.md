# Scenery-depth rendering cost — hold

Frozen local desktop-GPU renderer ABBA24samples/block with R3F automatic loop paused. gl.finish explicitly waits for GPU completion, so these are synchronized draw costs, NOT production FPS.

Desktop block medians original4.8/4.35ms vs effect24.6/19.85ms. Mobile viewport original4.75/4.4ms vs effect17.55/18.25ms. Both original cost fixtures restored exact pixels and had no page/shader errors; lint passed. This extra full scene pass is too costly to integrate in current form while performance remains open.

Follow-up suppressed shadow-map autoUpdate only during depth pass. No material gain: desktop4.9/4.5 vs23.3/23.2ms; mobile4.5/4.1 vs17.2/17.05ms. This follow-up also failed restoration acceptance; preserve raw result, do not treat it as safe. Not a production candidate.

No runtime changes or deployment. Motion/ghost gates deferred rather than implement atop an unaccepted rendering design. Next investigate a cheaper targeted mask/depth approach or explicit visibility marker; preserve approved scenery/camera/picking. Raw civic/player-scenery-depth-cost/results.json and player-depth-no-shadow-refresh/results.json.
