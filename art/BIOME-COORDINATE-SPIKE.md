# Shared noise-coordinate spike — rejected

Browser runtime unchanged. Candidate transpiled in an isolated Node module from biome.ts: compute coarse/fine lattice coordinates and fade weights once per biomeWeights call, reuse across five seeded noise layers. No retained cache; same expression order and fixed seeds.

294,905 exact object comparisons passed: all512x512 integer positions plus181x181 fractional near-ground grid. ABBA single-grid microbenchmark original28.09/26.94ms; prepared33.91/28.17ms, identical accumulated outputs. No consistent improvement, candidate not integrated. Node microbenchmark is not browser/GPU/frame evidence; avoid interpreting equal values as whole-game coverage. Lint passed.

Evidence civic/biome-coordinate-spike.json and biome-coordinate-lint.log; scripts/biome-coordinate-spike.mjs preserves candidate. This rejects this object-based implementation, not all possible coordinate sharing. Further arithmetic micro-spikes are not justified by this result. Prefer investigating the remaining non-ground portion of streaming stalls before another implementation change; prior near-block timing accounted for only part of the frame.
