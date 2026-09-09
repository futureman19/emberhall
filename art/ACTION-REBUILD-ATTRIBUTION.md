# Terrain rebuild trigger attribution

Existing production QA probe __emberTerrain exposes getOrigin/getRebuildCount. Added read-only per-RAF origin/count/position observations to bounded mobile hatchet/hoe action CPU harness; extended capture four completed-action frames instead of ending immediately on intent none. Both outcomes passed; lint passed. Raw results and CPU profiles in art/verification/tools/actions-production-action-rebuilds. No runtime source changes.

Hatchet origin224,256 stays fixed, count3 through action, then4 at landRev10->11 on completion. Hoe origin256,256 fixed, count5 then6 at landRev12->13. Exactly one observed rebuild each, completion revision driven; no streaming-origin changes or repeated active-action rebuilds observed.

Long frames also occur without count increments. Hatchet83.3ms while chopping count3; after completion199.9 and116.7ms with count4 unchanged. Hoe183.2 and100ms after completion with count6 unchanged. Main-thread RAF observations do not locate GPU completion or React work within frame boundaries; no causal attribution of all delayed frames to terrain callback alone. Profiling overhead included.

Important coverage correction: previous action harness stopped on first none state and missed delayed completion frames. This extension exposes a larger completion-time hitch and preserves earlier evidence. Short action traces are not sustained performance benchmarks. Next attribution needs CPU/React/GPU post-completion work rather than presumed repeated terrain rebuilding. Production preview unchanged; performance gate remains open.
