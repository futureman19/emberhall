# Near-ground biome slot-cache browser proof

Current deployed routes-BfNKbK8R.js, only the near-ground biomeWeights call intercepted. Fixed32,761-slot array stores exact x/z and frozen weight object. Object.is coordinate match reuses; changed slot coordinates recompute; no retained heights/colors/tiles and no scenery/density/update timing change. Browser experiment only, not runtime integration.

Source biome.ts confirms weights use x/y, five atlas place coordinates, COURT coordinates and fixed noise seeds, not World or landRev. atlas.ts exports mutable COURT/PLACES objects; production integration must explicitly invalidate on those sampled coordinate changes (or prove immutability), and own cache per mounted terrain instance. Current browser proof assumes unchanged atlas, so it is NOT complete invalidation acceptance.

One parity run recomputes all six weight fields and Object.is compares every returned value. Cumulative final65,522 hits +131,044 misses, no mismatches, two outcomes passed. Setup relocations and action land revisions included, not all world/atlas transitions or rendered buffer/pixel equality.

Separate ABBA maximum RAF ms: original-a chop216.7/hoe116.7; cached-a116.6/83.4; cached-b133.3/100.0; original-b233.3/149.9. Eight timing outcomes passed; lint passed. Candidate lower in both arms for both tools, still substantial hitches. Counters add some candidate overhead, no per-call clock instrumentation; mobile viewport on desktop GPU, not physical mobile. Cold-fill/movement streaming performance is not established by settled completion timing.

Raw actions-near-biome-{parity,original-a,cached-a,cached-b,original-b}/results.json retained. Next: production helper with complete atlas dependency key, bounded/per-instance storage, coordinate/world/atlas invalidation tests, then exact buffers/pixels and final-source timing before isolated deploy. Public preview and production unchanged.
