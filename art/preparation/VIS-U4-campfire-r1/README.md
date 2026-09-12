# U4 campfire offline preparation
Two centered script-authored parts: faceted stone within original .09 radius envelope, tapered log within original .05 radius/.5 length envelope. Six stones and two log placements shown in editable source; GLB only exports the two shared centered parts. Actual GLTFLoader finite vertices/normals and bounds checks pass; editable .blend reopened.

NOT integrated. No flames, lights, gameplay or public/src changes. Source render omits flame intentionally. Existing log rotations retained with explicit Three XYZ matrix convention converted to Blender coordinates. The original rotations make logs read nearly parallel/upright rather than a clear crossed stack; visual reviewer flagged this. Do not claim the silhouette is polished or silently rotate them during geometry-only integration. Compare the original live campfire from the same camera before deciding whether a separate placement correction is justified.

Retain original stone/log runtime colors, six stone centers, flame group refs/flicker timing, point light and campfire IDs/lifetime. Preserve proxy picking and failed-download fallback if integrated. No draw-call/performance improvement claimed.

Regeneration overwrites these offline files. Both frozen QA candidates remain untouched; runtime integration paused pending a QA slot.
