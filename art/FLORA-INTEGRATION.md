# Flora eligibility local integration

Pure floraRollEligible checks necessary seeded-roll maximum before occupancy/biome queries: wooded<0.14 using seed+51; open<0.05 using seed+41. Original biome-specific selection and transforms unchanged; no retained cache, reduced population, changed seed, or active-count behavior. Trees/rocks unaffected by the flora-only guard.

Real missing-helper RED then GREEN test. Regression extracts actual terrain flora selection and checks all six biome names, five relevant tile kinds, wooded/open branches and below/equal/above every listed selection threshold (plus0/1). Every positive flora result remains eligible; strict maximum boundaries checked. This protects existing thresholds; tests must expand their boundary list if future selector thresholds change.

211 script tests and562 game/component tests passed; lint/typecheck/build passed. Four final-source desktop/mobile exact geometry/instance-buffer and rendered-pixel comparisons passed, no page errors. Logs flora-integrated-{tests,build,lint,ledger}.log and civic/flora-integrated-parity.json. Browser candidate walking scenery45–58ms to21–22ms remains prior evidence, not final-build performance proof.

Source integrated locally only; public palette preview unchanged. Next run final production-built walking/action/settlement verification, then isolated deployment and independent live checks. No whole-game or physical-mobile performance acceptance; other parked experiments remain parked.
