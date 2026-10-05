# Expanded world checkpoint

Local review checkpoint only; not a production release or blanket QA approval.

Includes the 512 -> 1145 square map expansion (about 5x total area), deterministic frontier scenery and nine destinations, connected river and crossings, original editable Blender Reedwake bridge, and game-specific ferry/waterfront integration. Original coordinates and disposable-save appearance/scars are covered by tests. No real player saves were accessed.

## Evidence
Latest full test log records 280 script tests and 788 application tests passed. Typecheck, scoped lint and build passed. Parent completed final built-output waterfront browser acceptance: 41/41 desktop/emulated-mobile checks with no errors. Candidate dev and rejected-download runs passed 45/45 each; fallback errors are expected blocked asset requests. Parent independently reran geometry tests and checked served GLB hashes against source/build bytes.

Detailed historical reports are in art/verification/{world-expansion,frontier-river,river-bridge,reedwake-waterfront}/FINAL.md. Reports describe their respective stages; older bridge totals and source ZIPs are not the final waterfront asset revision. Selected compact JSON evidence is committed; raw logs, disposable saves, redundant ZIPs, bulk screenshots and Blender backups remain local. Current editable .blend files, generators, verification scripts and runtime manifests/GLBs are included.

## Explicit limitations
Repository-wide npm run check is NOT green: unrelated experimental-art lint blocks it. Individual tests, typecheck, scoped lint and build were executed separately. No physical-phone performance acceptance; expanded terrain still increases eager generation/memory. River water is not simulated. Decorative ferry/mine/landmarks do not add quests, transport or shops. Bridge approach edges remain angular. This checkpoint does not authorize push/deploy.

Unrelated art/lane3 changes, generated route formatting and prior character experiments are excluded.
