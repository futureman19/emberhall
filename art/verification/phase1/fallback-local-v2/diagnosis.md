# Fallback harness diagnosis

- Retained failed evidence: ../fallback-local-v1/results.json (19 checks, last failed).
- Actual v1 failure was NOT group remount: outside and inside UUID both 9a649e95-9b74-4e87-a5d7-e2a49935f292; sameOriginalGroupAndHandlerSlots and noncutPresent true, floorPresent false.
- Source building-meshes.tsx:95-99 markRoof marks perimeter cells cut without excluding y=0. Lines 1001 and 1081-1095 put cut cells into a layer rendered only outside. Requiring every y=0 cell inside therefore contradicts the original cutaway renderer.
- Harness only: preserved full outside original-cell/proxy/floor/wall checks, exact noncut identification, group UUID and handler-slot requirements, furniture visibility, approved exterior checks, and exact ghost checks. Added noncutFloorPresent, missingFloorCells, missingOnlyCutCells evidence; inside now requires every noncut floor and that every absent original cell is cut. Original floorPresent diagnostic retained.
- No remount assumption relaxed: corrected run recorded zero outside/inside UUID changes across all 11 kinds.

## Executed verification

Command: "C:/Program Files/nodejs/node.exe" scripts/phase1-fallback-smoke.mjs http://127.0.0.1:8093 fallback-local-v2

One runtime attempt during this correction; existing 120-second watchdog retained. Duration 28774ms. Exit 2: partial-valid-placement-unreachable, acceptanceComplete false. 103 checks, zero failed; 11 fallback records; 11 invalid ghost passes; 11 valid states honestly unreachable in unchanged singleton-kind fixture. 11 expected blocked-resource console errors, zero unexpected errors. Fixture/building/interior/site source hashes identical to v1; mutation/restoration checks passed.

Evidence: results.json; representative-hall-fallback.png; representative-hall-original-invalid-ghost.png. Screenshots are captured supporting artifacts, not a visual-quality claim. This verifies local disposable fixture renderer state only, not pointer interaction, walking, placement commit, mobile, deployment, or performance.

Only scripts/phase1-fallback-smoke.mjs and this new evidence directory were changed by this correction. No app edits, deployment, or Git operations.
