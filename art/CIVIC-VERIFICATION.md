# Controller takeover — civic visual pilot and test repair

Base eeba65bc9a3cf6360d7aff366a6e58fa8391b1dc. Branch feature/emberhall-controller-next-batch. User requested controller own all three lanes. External stop message96 sent; external worktrees preserved. Performance-support d8d2049a3791338869f1eb33f7a3aeea5476bde7 inspected read-only, not merged.

## Phase 2 first visual batch
Starting banker Old Pell(p-8), provisioner Brann Wain(p-9), healer Ione Hale(p-10) now reuse the already-approved Blender character geometry/face/tunic. This is existing editable character.blend/character.glb reuse, not newly sculpted NPC assets. Original class colors, healer hood/cloak, animation refs, scale, identity, home, simulation and equipment rules remain. A home-based COURT18 radius limits this to the starting civic trio; distant NPCs and other roles retain their original renderer. Both initial/live yaw use one PI correction for the authored negative-Z front, with original NPC yaw untouched outside scope. No tools/equipment art rollout yet.

New helper/integration tests red->green. Earlier source tests' player-only expectations updated to the authorized bounded civic scope, while original fallback, non-picking face, resource sharing and player-facing assertions remain. Canonical explicit test list appended, not regenerated.

Same-fixture baseline captured BEFORE integration:13 checks/six180-frame samples; candidate13 checks/six samples. Separate candidate-contracts:31 checks, authored geometry/yaw and actual talk/heal command effects for all3 roles on desktop/mobile, NPC records and pack preserved. This is direct real store-command interaction proof, not pointer-input proof. Phase1 deployed pointer regression suite remains separate. Contact sheets inspected at gameplay scale: more rounded heads and separated faces, no obvious detached/floating parts; buildings/trees still obscure NPCs, not every fine contact is visible.

## Test reliability
Windows wrapper incorrectly used cmd.exe for native executable paths, splitting C:/Program Files/nodejs/node.exe and interpreting arguments. Native .exe/.com now bypass shell; extensionless package/.cmd shims retain existing behavior. Added exact argv regression for spaces, quotes, metacharacters and empty argument. Focused wrapper13/13 passed, existing env override/exit/symlink/signal checks retained. Bare extensionless commands still use the pre-existing Windows shell path; this is not a universal shell-escaping rewrite.

Eight platform-chrome tests inherited the actual game's site.json/public og.jpg, overriding generic title and placeholder-card expectations. Test-only empty temporary cwd defaults isolate these unit cases; explicit fixtures still override and a new real-filesystem regression proves custom title/image precedence. No platform chrome production code changed or assertions weakened. Focused combined61/61 passed. Full canonical run before civic changes passed198 script tests and557 game tests. Final post-civic gates recorded separately.

## Performance: measured, not cleared
The external report's classification of failed p95 as definitively noise is not established by equal medians or lower draw calls. Its market export-merge proposal is contradicted by actual market.glb:1 mesh,1 primitive,1 material,1 node; a scene-level geometry delta cannot be assigned to unmerged market parts. No report-based waiver or speculative renderer fix applied.

New civic baseline/candidate relative p95:5/6 pass; desktop banker33.4->49.9ms fails. Candidate scene calls rise about21 (new face/tunic details on trio), geometries decrease16 from shared character reuse. These are visual pilot costs, not performance improvement claims.

Independent bounded mobile hall ABBA diagnostic:off/on/on/off,300 frames each, fixed fixture/noon/clear/current civic renderer in BOTH arms; off only aborts Phase1 interior/sign GLBs. Observed p95:16.8/33.4/49.9/33.4ms. CPU render-submission p95:6.0/5.9/6.1/5.9ms. Frames over25ms:14/24/26/25. Correct furnishing presence checked each arm. This supports substantial variability, but does not prove no real total CPU/GPU cost or erase original failed gates. Submission timing is not GPU execution time. Raw frame arrays retained; no thresholds changed, no best-run selection. Original Phase1/hospitality/global gates and civic banker gate remain open. No physical-phone/60FPS certification.

## Final gates and independent deployment
Final canonical npm test passed198/198 script tests and560/560 game/component tests. Lint,typecheck,build,auth and ledger audit all exit0; final lint after live harness addition also exit0. No baseline failures waived.

Exact updated isolated preview: https://emberhall-vale-ooa02kc7h-andrews-projects-ffe8a9fd.vercel.app/art/phase1-preview.html . Deployment dpl_2mzuQZgp5BWQDmbFeq7fiPeUDfod independently inspected Preview/Ready. The existing Phase1 launcher is reused to load the same settlement fixture; the new civic visuals are in this deployed bundle.

Exact URL:19 civic live checks (real Talk button clicks on desktop/mobile after explicit nearby positioning/selection, dialogue text and unchanged NPC/pack),82 settlement pointer/walking/station checks,36 HUD checks. All23 live GLB hashes match local assets. Live mobile screenshot inspected; faces remain too small for fine-detail certification, existing occlusion persists. No production promotion. Reproducible evidence under art/verification/civic and art/verification/phase1/civic-deployed,civic-hud.

## Scope remaining
This is the first bounded Phase2 civic visual reuse pilot, not full Phase2 completion. Tools, equipment and other NPC families are next. Original workspace/production remain untouched. Preserve .blend1 backups and unrelated generated route file. All reported performance limitations remain open; no performance acceptance inferred from the green code gates.
