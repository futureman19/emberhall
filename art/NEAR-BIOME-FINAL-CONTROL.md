# Final near-cache controls — hold deployment

Production-built local8099, routes-BId7lFnB.js; original browser control replaces near S.sample with ea and removes S.begin. No CPU sampling/per-call timing. ABBA completion8 outcomes passed: original-a chop216.7/hoe166.7ms max RAF; cached-a133.4/100.0; cached-b166.6/133.3; original-b133.3/133.4. Ranges overlap, so final-source speedup is less clear than the earlier spike.

Four controlled corridor walks all reached destination:636/636/635/636 frames, p9516.7/16.7/16.8/16.7ms. Max frames original-a116.7, cached-a183.3, cached-b116.7, original-b133.3ms. Candidate first run has a larger isolated stall. Do not clear moving-window/cold-fill regression based on unchanged p95; current harness does not correlate slow frames with actual rebuilds, misses or origin transitions. Need event-aligned attribution before deployment, not another identical timing batch.

Lint passed. Raw actions-near-final-{original-a,cached-a,cached-b,original-b}/results.json and civic/near-biome-walking.json retained. Source remains locally integrated61de1cb. Public palette preview unchanged; no new deployment or production promotion. Next instrument origin/rebuild events and cache miss counts around walking stalls to determine whether the candidate's cold-fill allocation is causal.
