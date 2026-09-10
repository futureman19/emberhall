# Conditional haze candidate held

Added conservative missingTileDependencies option: snapshot tile span first, retain haze dependencies if any tile is absent. Seven focused tests passed, typecheck and lint passed. New test was red before implementation.

Browser exact comparison: desktop interior matched, desktop world edge x4 failed both buffers and pixels. No page errors. Batch halted before mobile; no four-case acceptance claim. Diagnostic directly changes skyTone.haze before near prepare; shared color mutation or an actual candidate issue has not yet been isolated. Keep failed raw evidence.

Candidate runtime files archived under haze-candidate/*.txt and restored to HEAD; public preview unchanged. The added conditional-haze test is retained separately as a candidate specification, not in the canonical test file. Next isolate edge failure against unchanged runtime before attempting integration again. No speed claim or deployment.

Baseline control after restoring both runtime files reproduces the same desktop-edge buffer/pixel failure (civic/ground-planner-haze-baseline.json). Therefore this test failure does not establish a candidate regression. Boundary harness must be diagnosed before it can gate the optimization.
