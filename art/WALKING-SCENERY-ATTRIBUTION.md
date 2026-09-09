# Walking scenery grid versus finalization

Browser-only nested timers in current palette bundle routes-BfNKbK8R.js. Exactly one top-level counted grid loop selected inside scenery block. No geometry/runtime edits. One controlled real walk,635 frames, p95~16.8ms, max149.9ms, arrived/no page errors; lint passed.

At boundary: scenery grid70.8ms, finalization6.1ms, enclosing76.9ms. Near ground70.8ms, far6.4ms. Earlier action-start scenery grid61.6/finalization5.8ms is separate. Nested loop and enclosing timings overlap and must not be summed. Compared with earlier45ms scenery capture, absolute phase time is variable; these timings identify internal work, not a regression.

Grid timer includes tile traversal, biome/resource/occupancy calculations AND active instance matrix/color writes. Finalization includes hideRest, counts, dirty flags and bounds clearing. Thus removing unused-tail handling is not justified as the dominant fix by this capture; active-count experiment remains parked. Need next attribution inside grid for calculations versus active writes before choosing implementation.

Evidence civic/walking-scenery-events.json and walking-scenery-lint.log. Public preview and production unchanged. This is one mobile viewport on desktop GPU, not physical mobile/global performance acceptance.
