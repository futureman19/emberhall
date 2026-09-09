# Tool work-time cycle parity

Verification-only follow-up on f66b5e4. scripts/tool-pose-smoke.mjs --cycle samples workT from0 through0.72 seconds in0.03 increments (25 samples), plus idle, ghost and restored for each of hatchet/pick/hoe/fishing_rod. EXTRACTION_BEAT/WORK_BEAT source is0.72; fishing cast envelope completes at0.6. Existing real useFrame callbacks consume controlled workT. These are local isolated-renderer diagnostic samples, not continuous normal gameplay or full event-driven extraction/gathering FX coverage.

Candidate-cycle and forced asset-failure fallback-cycle each produced112 unique tool/pose records, no page errors. Python reconciled all112 keys: every mesh world matrix, visibility and opacity matches candidate versus fallback (only geometry part identifier omitted). All four restored records equal their original idle records, confirming the corrected material state across tool changes after ghost. Body/matrix equality does not certify contact with every terrain target or every animation event branch.

Raw screenshots/results retained under art/verification/tools/poses-{candidate,fallback}-cycle. Aggregated assertions in art/verification/tools/cycle-parity.json. Lint passed. No application code, assets, save rules or deployment changed. Existing preview remains the resurrection fix. Normal-camera tool readability and performance acceptance remain open.
