# Haze invalidation diagnosis

Production bundle routes-gLKhOyib.js, disposable local browser. Normal real-time chop and till each produced full mode: only key indices56/57/58 changed, the final three skyTone.haze RGB dependencies. Dirty count0 in full mode does not mean tiles did not change: planner only collects dirty tiles when the key matches.

Negative control replaced only these three key values with constant zero in the intercepted bundle, without changing the actual haze color or terrain math. Both actions then produced patch mode with exactly one dirty tile. Four action checks passed across both runs; lint passed. This isolates the cause of full invalidation for these fixtures. Instrumented timings are not speed acceptance.

The control is UNSAFE for general shipping because off-map vertex colors consume haze. It is a diagnostic script only; runtime source unchanged. Next safe implementation must preserve off-map updates (or prove the whole sampled grid contains tiles before omitting haze dependence), with boundary/hole/time-change parity tests, then remeasure production performance. Public preview remains unchanged.

Raw results: art/verification/tools/actions-planner-mode-diagnostic/results.json and actions-planner-haze-control/results.json.
