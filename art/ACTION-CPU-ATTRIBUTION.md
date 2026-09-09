# Action-aligned production CPU profiles

Bounded mobile hatchet/hoe profiles at100us requested sampling, after8500ms setup settle. Both gameplay outcomes passed; lint passed. Raw results/timelines and mobile-hatchet.cpuprofile/mobile-hoe.cpuprofile retained under art/verification/tools/actions-production-action-cpu.

Hatchet RAF trace has83.3ms early interval and approximately50–66.7ms intervals before completion. landRev stays10 until final sample11. Hoe starts50ms then approximately16.7ms; landRev12 until completion13. Stalls therefore are not exclusively after the recorded completion revision. CPU profile also includes doVerb and final work before CDP stop; do not assign aggregate CPU self-time to a particular RAF interval without timestamp alignment.

Compiled source inspected directly at recorded callFrame locations in routes-DFIjPVbC.js: Qr is sine-based coordinate noise; Sq scans plots/buildings for occupied terrain; anonymous4286 is terrain callback with seed, streaming-origin and landRev rebuild checks. Sampled self-time: noise222.46ms hatchet/121.52ms hoe; occupied-terrain scan139.39/17.52ms; terrain callback73.78/13.21ms. These are approximate profiled costs, not GPU timing; program time remains unattributed. No causal claim of repeated terrain rebuilds yet. Need rebuild counters/trigger reasons and frame-aligned events to distinguish setup, initiation and completion.

No runtime change/deployment. Prior short unprofiled frame stalls retained; full performance and animation acceptance remain open. Next implementation candidate only after trigger attribution: deterministic bounded reuse of repeated terrain occupancy/noise work with exact world/revision keys and output parity, not lower scenery density.
