# Walking planner attribution

Final build routes-C6ElWMy9.js on fresh local8102; ABBA full/candidate/candidate/full. Added exactly one start/end timer per candidate planner call, preserving final source behavior and prior near/far/scenery block timers. All4 routes arrived with no page errors; lint passed.

Candidate boundary planner cost0.4/0.3ms, both full mode as expected for moved origin. Inclusive near-ground block81.1/64.3ms; full control68.2/75.9ms. Max frame candidate100/83.2ms vs full83.3/100ms, p95~16.7–16.8ms. Planner time is INCLUDED in near block, do not add them. This localizes sampled boundary cost to the existing full ground rebuild, not a large planner scan. It does not prove the earlier149.9ms outlier cannot recur or clear whole-game/physical-mobile performance.

No runtime edits/deployment. Preserve action improvement and current isolated preview; stop repeating identical walking comparisons. Next meaningful performance work needs a correctness-preserving full-grid calculation improvement, while remaining player-occlusion visual work is independent and still open. Raw evidence civic/haze-walking-planner-cost.json.
