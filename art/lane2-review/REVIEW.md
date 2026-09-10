# Controller review of Lane2 7cb0879

Reviewed exact helper and proposal, independently reran six submitted tests: all passed. Additional negative reproductions against helper confirmed two integration gaps:

1. candidate() snapshot only tracks tile kind/height and origin, not destination buffer identity. Swapping to fresh output arrays returns skip with340843 differing components versus full fill. Integration must guarantee immutable buffer lifetime or invalidate on each attribute-array identity change.
2. biome anchor mutation (ridgewatch moved to sample origin, restored in finally) returns skip with168921 differing components versus full fill. Tile snapshot cannot represent biomeWeights or lanternwood/ColorManagement dependencies. Integration must invalidate sampler-input changes or enforce/test their immutability. Existing project permits mutable atlas coordinates, so silently assuming immutability is unsafe.

These are prototype API/integration risks, not deployed regressions. Browser/gl performance not measured. Proposed raw helper integration remains HELD. Prefer snapshot/dirty-index-only helper using existing terrain vertex body, explicit resource/sampler validity keys, then independent final-source buffer/pixel parity and bounded ABBA. Existing tests compare candidate to the helper's own duplicated full-fill implementation; they do not independently establish exact terrain.tsx parity.

Evidence scripts/lane2-review-invalidation.mjs (imports sibling worktree explicitly), reproduced-gaps.json. Successful negative-repro run means defects were reproduced, NOT candidate acceptance. Other agent worktree untouched. No GPU use/runtime changes/deployment.
