# Walking rebuild/cache-miss attribution

Browser-only near-block timers, cumulative miss counter and RAF/observation timestamps on routes-BId7lFnB.js. One uncached then one cached controlled corridor walk; no CPU sampling. Both arrived,636/637 frames, p95~16.8ms; lint passed.

Exactly one near-ground rebuild event captured during each walk. Original81.6ms (25502.1..25583.7), candidate78.2ms (24525.7..24603.9). Candidate misses32,761: changing origin shifts every fixed vertex slot, so this is a full cold refill, not partial reuse. Slowest RAF intervals166.8/166.6ms overlap those events; observation.now occurs after callback work, while RAF timestamp starts before it. Origin at slow observations224,256; rebuild count4.

This paired capture does not reproduce or explain away the prior candidate183.3ms outlier; does not prove regression-free movement. It establishes an important limitation: current slot caching only saves unchanged-grid revisits, not movement rebuilds. The near block is only part of the streaming frame. Do not add its elapsed time to the whole RAF interval.

Raw civic/near-biome-walking-events.json includes all RAF timestamps, origins, rebuild counts and near events. Existing failed/worse evidence retained. No runtime change/deployment; source61de1cb remains local, public palette preview unchanged. Next decision: assess cold-path allocation/storage overhead with a bounded comparison, or park this cache if moving-window cost cannot be accepted. No full performance clearance.
