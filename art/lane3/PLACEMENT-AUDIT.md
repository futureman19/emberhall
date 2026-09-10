# Lane 3 takeover — placement contract audit

Hermes owns lane3; external Agent3 assignment superseded. Base7e110dddc1302fe68af06e3b69c0a19964aeb057. Agent2 commit7cb0879955f04179c3d866b8d7106ad5c36fa773 exists and file stat matches handoff, but not reviewed/integrated.

Executed scripts/lane3-placement-contract.test.mjs with native Node --experimental-strip-types --test:22 passed,0 failed. Eleven unchanged-fixture rejections,2 unconditional hall/bank prohibitions,9 positive missing-kind unit controls. Import executes real siteError, no copied implementation.

Correction: the historical11 'unreachable valid placements' are not established navigation failures. siteError rejects existing singleton kinds before footing/path checks; hall/bank are categorically unplaceable through this API. The all11 review fixture cannot exercise a valid placement ghost. Nine other kinds accept the synthetic missing-kind unit fixture. This is NOT gameplay proof: synthetic tile array is test-local, never persisted, no terrain mutated in review save.

Acceptance ledger:
- Placement rejection contract: PASS (11 kinds).
- Hall/bank positive placement through siteError: NOT APPLICABLE by explicit API contract, not silently passed.
- Other9 positive placement predicates: UNIT PASS only.
- Other9 real-world valid ghost rendering: BLOCKED pending dedicated missing-kind disposable fixtures with original generated terrain.
- Navigation, placement commit, construction completion: NOT TESTED by this batch; keep separate.
- Existing authored/fallback rendering claims: unchanged; no browser run in this lane.
- Tool/effect coverage:112 sampled cycle poses historically are not complete transition/effect coverage; ghost/resurrection, tool swaps, occlusion and physical-mobile readability need separately named checks. Controller owns visual changes.

No runtime/package/lockfile/save/asset changes. No GPU work or deployment. Next: build explicit acceptance report aggregation and bounded per-kind fixtures; preserve original failure evidence and do not lower thresholds.
