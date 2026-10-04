# VIS-U1-r1 — implemented, independent QA pending

Keep southeast stair occlusion and visual player seating changed; original exterior, simulation/story/camera/ownership/save rules preserved. New presentation helper plus building/player renderer integration. No keep GLB or new art model.

Quick checks:20 focused tests, typecheck, narrow lint, build;238 development +214 built browser assertions on desktop/touch.22 route legs per device include full descending stairs and direct south exit. Four built-linked assets byte-matched. Normal-size visual sanity passed; fine contact and all corner cases remain independent QA.

Frozen packet: `art/verification/releases/VIS-U1-r1/` with source.zip, built.zip, evidence.zip, manifest.json and TESTING-PROMPT.txt. Source includes current dirty/untracked code, not just HEAD. Archives were reopened and every member hash verified. Private runtime config/saves and dependency caches are excluded; public repository review fixtures retained for tests and screened for credential-bearing JSON fields.

No full-suite rerun or rejected-download matrix in this implementation batch. Tester should scrutinize fractional stair offset snapping, unusual history-dependent story entry, ghost/NPC behavior, cutaway boundaries, and full regression. Existing authored/original silhouette detail limits remain.

QA handoff is prepared for user forwarding to @grokhermesautobot; no group post/acknowledgement/testing start claimed. No publication. U2 starts with exact resource/plant catalog reconciliation, not a rerun of prior full-world QA.
