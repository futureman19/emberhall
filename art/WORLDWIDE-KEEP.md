# Retained keep — ceiling cutaway fixed; broader acceptance partial

**Later update:** `WORLDWIDE-KEEP-PICKING.md` supersedes the raised-floor picking defect below: visible surface targets now dispatch correctly. Lower-stair occlusion and floor seating remain open. Counts and ground-projected routes in this document describe the earlier ceiling-only checkpoint, not the current pointer contract.

## Changed
The existing keep retained the next timber floor overhead: stories 0/1/2/3 used caps 5/9/13/17, including timber decks at voxel Y4/8/12/16. Original-policy screenshots hide the player on ground and upper-story landings despite successful traversal.

`src/components/game/building-meshes.tsx` now cuts only inside-keep timber decks on story-height multiples above the rounded occupied story. The existing cap, walls, stairs, current/lower floors, exterior, floor geometry, simulation, ground picking, camera and saved data remain unchanged. The three added lines are the only renderer delta from this slice's dirty-workspace checkpoint.

A new regression in the already-registered `architecture-kit.test.ts` executes the actual renderer layer loop. It verifies ten integer/fractional story samples, four exact exterior-restoration states, and unchanged solid voxels for all other canonical building kinds with authored furnishings disabled. This is not equivalent to rerunning every other building's authored interaction.

## Evidence
- Original screenshot/runtime baseline: `art/verification/worldwide/keep-dev-v1/` (its 212 checks proved the original geometry and traversal, not acceptable player visibility).
- Expected red: `.hermes/keep-ceiling-red.log`, four passed / one failed at the story-0 ceiling assertion. Final focused architecture + keep-story + city run: **14 passed**.
- Full canonical suite: **953 tests** (250 script + 703 remaining); typecheck, full lint, build, auth invariant and diff checks pass. Logs: `.hermes/keep-{focused,tests,build}-final.log` and `.hermes/keep-ledger.log`.
- Accepted runtime artifacts: candidate `keep-candidate-final2` **212** checks; original-policy `keep-control-v3` **214**; actual art-download rejection `keep-failure-final` **214**; fresh built `keep-built-final` **188**. **828 assertions, eight mode/device cases, 160 route legs**. Earlier/superseded runs are not added to this total.
- Each mode covers desktop1440x960 and native touch-enabled Chromium390x844: south entry, ground floor, east stair base, ascent through stories1/2/3, lateral landings, reverse descent and exit. Input is actual mouse/touch at ground-projected coordinates; simulation uses normal fixed substeps, never floor teleports.
- Exact seed2469134 uses canonical generation/save/load and unchanged city terrain. Other actors are cleared and the initial body is placed in the bailey solely for input isolation. This is not natural AI or full onboarding acceptance.
- All accepted runs have identical per-leg X/Z/story/facing/path tracks and exact before/after terrain/building records. Diagnostic floor-tap commands are separately recorded while paused and replaced by the next real route input; full transient UI/intent parity is not claimed.
- Development scene geometry matches exact expected voxel multisets. Original exterior/restoration is **11,658** instances. Candidate inside counts are ground **2,106**, story1 **3,784**, story2 **5,444**, story3 **6,933**. Built output has no private scene inspection; its evidence is fresh linked bytes, actual runtime input/state and screenshots.
- The keep is intentionally original and has no GLB. Rejected-load mode rejects actual surrounding/character GLBs and verifies the keep remains functional; this is not a fictional keep-asset fallback test.
- Final built screenshots were reviewed for all four story plateaus and an active stair sample. The player is exposed on the landings. Feet/step contact and some lower body detail remain obscured or too small to assess; normal-camera mobile framing crops the large keep.
- Four mobile before/after comparisons: `art/verification/worldwide/keep-{ground,floor1,floor2,floor3}-before-after.jpg`.
- Of **410** checkpointed source/package/art files, only `building-meshes.tsx` and `architecture-kit.test.ts` changed. All **114 GLB/Blend** files are unchanged. Independently removing the three renderer lines reproduces the prior hash. Review found no scoped must-fix.
- Long-lived preview initially referenced a removed old chunk after rebuilding. Only the tracked preview was restarted. All four current HTML-linked JS/CSS assets then returned200 and matched `.vercel/output/static` bytes. Evidence: `keep-built-freshness.json`; old condition retained in `keep-stale-preview.json`.

Audit: `art/verification/worldwide/keep-acceptance.json`.

## Still open — not hidden by passing traversal
1. **Raised-floor picking is displaced.** In final development desktop/touch, a scene ray confirms the visible story3 surface at `(181,320,7.11)`, but actual clicks command `(175,314)`. The rebuilt desktop/touch run repeats that command. Keep events fall through to underlying terrain. Ground-projected traversal does not prove that tapping the visible upper floor walks to that same point. The older control/failure diagnostic used a different point and is not direct same-point parity evidence for this final diagnostic.
2. **Floor seating is not repaired.** Existing player elevation omits the original slab-top offset; the floor extends above the character's root. Ceiling removal improves visibility without changing that alignment. No physical floor-contact or stair-contact claim.
3. This does not certify all camera angles, full animation, construction, general collision, natural actors, performance, physical phones, earlier worldwide kits or release readiness.

**Local ceiling-only fix verified. Full keep acceptance remains partial.** Local built preview visibly changes inside the keep; its outside appearance is preserved. No commit, push, public preview or production publication. Next bounded work: accurate raised-floor picking, then floor/stair seating.
