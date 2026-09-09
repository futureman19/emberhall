# Parked near-ground biome cache

Runtime integration removed after final completion timings overlapped and walking candidate had an unresolved183.3ms outlier. Event tracing showed every moved near-grid vertex misses (32,761 entries); later paired81.6/78.2ms rebuilds did not explain the retained warning. Decision: do not spend further repeated timing batches to justify this cache. No claim that cache overhead was proven causal.

Restored terrain.tsx and sharing regression from deployed palette runtime4564b1c; terrain differs only by terminal newline. Helper near-biome-cache.ts, its three canonical tests, all browser controls and raw evidence remain for future research. Palette conversion, per-vertex biome sharing, minimap cache and horizon exact-input cache retained.

Verification:210 script tests,562 game/component tests, typecheck, lint, production build, diff-check passed. Rebuilt routes-BfNKbK8R.js exactly equals downloaded bundle at current public palette preview. No new deployment needed: experimental cache was never public. Production untouched. Logs park-near-{ledger,tests,build}.log.

Current preview https://emberhall-vale-4hukuk6ze-andrews-projects-ffe8a9fd.vercel.app/art/phase1-preview.html . Phase2 action/streaming stalls remain. Future performance work should reduce cost of a cold rebuild rather than cache an entire stationary grid; investigate shared/redundant sampling or partial update architecture with explicit geometry/state parity, not reduced detail or cadence.
