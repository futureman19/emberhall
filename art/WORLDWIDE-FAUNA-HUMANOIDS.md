# Humanoid monster batch — local controlled acceptance

## Outcome
Brine troll, orc marauder, tomb sentinel, blackbriar hag, fen ghoul, drowned reaver, ossuary knight and ash demon pass controlled desktop/mobile gameplay, original-body controls, actual failed-download fallback and built-output checks. All eight gameplay crop pairs and final built sheets reviewed. This is an acceptance-only batch: no new model or gameplay edits, no commit/push/deploy, public preview and production unchanged.

Coverage: 24/52 species checked in controlled arenas, 28 remain. All10 humanoid-family species now have scoped checks when including prior ogre/lich. This does not certify natural fights, every attack, habitat traversal, whole-world visuals or performance.

## Fresh evidence
All result paths below are under `art/verification/worldwide/`:
- humanoids-candidate-v1/results.json:90 assertions,16 cases,pass.
- humanoids-baseline-v1/results.json:90 assertions,16 original-body cases,pass.
- humanoids-failure-v1/results.json:90 assertions,16 HTTP503-fallback cases,pass; each selected species had actual rejected asset requests.
- humanoids-built-v2/results.json:34 assertions,16 captures,pass. Every selected GLB HTTP200/SHA256 checked against local; real mouse/touch targeting on both viewports.
- Total accepted browser assertions:304. No unexpected console/page/shader errors in accepted runs. Injected503 errors retained.
- `.hermes/worldwide-humanoids-tests.log`:877 tests pass,0 fail. Same foreground command ran typecheck,lint,build,auth invariant and diff check with exit0.
- `.hermes/worldwide-humanoids-build.log`:fresh build passes,DATABASE_URL unset,migration skipped. Auth invariant dev/build agree,sign-in off.
- All52 fauna asset hashes unchanged versus humanoids-source-hashes.json.

## Retained built-output failure
humanoids-built-v1 failed the first GLB check with HTTP404 while the build was still regenerating its output. Result mtime17:06:24.172544Z; build log last write17:06:27.220977Z. Initial failure is retained, not reclassified as a pass. After build completion, explicit dev/built HTTP200 and SHA256 checks matched local brine_troll and blackbriar_hag. Sequenced full built retry v2 passed all34. Do not run built QA concurrently with a build writing the same output directory.

## Visual findings and limits
- Eight desktop/mobile gameplay crops: no demonstrated gross disconnected head/limb, floating weapon or duplicated anatomy. Tiny grips, hidden joints and dark overlaps cannot all be resolved at native mobile scale.
- Initial mobile reviewer questioned hag's pale staff top and ghoul's reddish foot-side detail. Same-state old/new mobile comparison (`humanoids-attachments-comparison.jpg`) shows the staff head/shaft meeting and the red mark existing in the original too. Source confirms the red shape is the preserved DARK_MONSTER_KINDS ground ring at fauna-meshes.tsx:1035–1039, outside the authored-body wrapper. Not a detached body part.
- Armored enemies share their kit; distinction relies partly on palette/chest/head details. No claim of unique weapon/stance for every variant.
- Final built desktop/mobile sheets reviewed. Native mobile demon and desktop hag are present, coherent and UI-unobstructed. Demon wing contrast and dark hag staff/grip remain small-scale readability limitations, not proven connection failures.
- Full frames retained in each run. Lineup images are enlarged crops, not full-viewport or FPS proof.

## Next
Bounded dark-creature batch: wight, greybarrow_wightling, ashen_banshee, rime_revenant, barrow_hound, ridgeback_warg, deepmaw_basilisk, stonecrawl_spider. Then remaining species variants. Trees/building cutaways/keep upgrade/character recaptures/frame-time comparisons/public preview remain open. No automatic implementation process continues from this checkpoint.
