# Action-aligned browser task trace

Two bounded mobile actions with CDP timeline plus CPU sampling, tool-start/tool-complete/tool-capture-end marks and terrain probe retained. Both outcomes passed; lint passed. Raw traces under art/verification/tools/actions-production-action-timeline. Instrumentation overhead included; not unprofiled benchmark.

Hatchet: main-thread FunctionCall beginning6.1ms after completion mark lasted89.9ms, within98.9ms FireAnimationFrame. Hoe: FunctionCall beginning83.7ms before completion mark lasted78.9ms. Both recorded callFrame assets/index-CaXg9tZa.js line9 column123529. Direct compiled-source inspection identifies React scheduling callback `Qd(function(){Fl&6?fe(_e,od):sd()})`, not a terrain callback entrypoint. This establishes substantial React scheduled main-thread work around completion in addition to previously sampled terrain work. Does not identify the affected React component or exclude GPU work.

Next focused attribution: React reconciliation/component allocation beneath this scheduler callback, rather than repeated land-rebuild hypotheses. No optimization or performance clearance yet. No runtime changes or deployment; previous raw failed frame evidence retained.
