# Unprofiled deployed completion ABBA

Four sequential runs parent/cache/cache/parent, each mobile hatchet+hoe and4 completion frames. Parent https://emberhall-vale-3bg3p2n8n-andrews-projects-ffe8a9fd.vercel.app ; cache https://emberhall-vale-axyd9urzh-andrews-projects-ffe8a9fd.vercel.app. No CDP CPU profiler/trace. Existing read-only terrain probe/RAF instrumentation remains. All8 controlled gameplay outcomes passed; lint passed. Raw per-run results retained and completion-abba-summary.json aggregated.

Post-completion maximum frames(ms):
- Hatchet parent283.4/300.1; cache200.0/200.0.
- Hoe parent166.7/183.3; cache250.0/200.1.

Mixed result: chopping lower worst frames in both candidate runs, hoe worse than both parent runs. Potential hoe regression retained as blocker; cannot claim overall action-performance improvement from isolated minimap CPU savings. Small sample and short action window do not establish sustained p95 or statistical significance, but they do show large stalls without profiling overhead. No thresholds relaxed. No further deployment or production promotion.

Next: isolate why hoe completion differs (world/UI work vs GPU submission) with same-state unprofiled attribution or bounded negative control. Current cache preview must not be marked performance accepted. Do not rely on repeated passing outcomes to erase timing evidence.
