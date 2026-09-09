# Normal-camera tool projection audit

Verification only, no runtime/art changes. Current fixture player256,304, facingPI; unchanged desktop1440x960 and mobile390x844 cameras. tool-art-smoke records each authored geometry local bounding box's eight corners transformed through actual mesh matrixWorld and camera into CSS pixels. These are projected bounding rectangles, NOT counted visible pixels: empty silhouette space, occlusion and depth are not measured.

All eight tool/device cases render both authored parts,17 checks passed;16 part measurements reconciled in pixel-audit.json. Lint passed. Mobile projected heads:hatchet5.998x4.677px, pick7.117x4.367px, hoe6.884x4.611px, reel6.494x4.864px. Rod projected shaft rectangle8.321x19.666px; its diagonal rectangle width is not shaft thickness. Desktop heads also small: roughly7–8px wide and5px tall.

Conclusion: very small projected tool heads limit readable fine detail even without trees. This does not exonerate occlusion or establish perceptual recognition. Adding fine geometry alone is unlikely to solve the issue. Next art experiment should compare restrained head/shaft contrast and silhouette separation at existing grips/camera; any envelope/scale change requires revising and testing original-bound contracts rather than silently bypassing them. No normal-camera visual acceptance, no performance clearance, no new deployment.
