# Rowan player-character integration — verified local implementation

Repository: `C:/Users/futur/Desktop/emberhall-lanternwood-preview`
Branch retained: `feature/emberhall-worldwide-art`

## Result

Rowan is integrated into the existing player renderer and character-creator mirror. Existing authored NPCs are unchanged. The adapter reads the approved Rowan GLB unchanged, bakes source transforms into existing mesh-local anchors, keeps separate left/right anatomy, and preserves existing root/shoulder/tool/action/equipment transforms and material ownership. Creator skin, hair, garb and style controls remain functional. Rowan-load rejection falls back to the previous authored character without suspending the game. No silhouette/outline renderer was integrated.

No commit, push or deployment was performed. No gameplay rules, economy, save schema, approved GLB/Blender source, or other Hermes profile was modified. Pre-existing lane3 JSON, routeTree and experiment-art dirt was not manually edited or cleaned. The only procedural-memory update was in the active telegram2 profile's Blender skill.

## Exact implementation/documentation files changed

All paths below are relative to the repository path above; the JSON change manifest contains their absolute paths and SHA-256 hashes.

Modified:
- `src/components/game/authored-character.test.ts`
- `src/components/game/authored-character.tsx`
- `src/components/game/look-preview.tsx`
- `src/components/game/people-meshes.tsx`
- `art/asset-ledger.json`

Added:
- `src/components/game/rowan-character-data.ts`
- `src/components/game/rowan-character-context.ts`
- `src/components/game/rowan-character.tsx`
- `scripts/rowan-character-smoke.mjs`
- `scripts/rowan-built-smoke.mjs`
- `art/ROWAN-INTEGRATION.md`

Evidence additionally created: `art/verification/rowan-red.txt`, this report, `change-manifest.json`, five gate logs, and candidate/failure/built results plus 16 screenshots under `art/verification/rowan-integration/`. Exact screenshot/evidence paths are enumerated in `change-manifest.json` and the three browser reports. Standard ignored `.vercel/output/` build output was regenerated, not deployed.

The ledger refresh adds only the three Rowan source files and four Rowan renderer/helper IDs, removes no IDs and changes no existing status. Other ledger diffs are derived source-location/consumer updates.

## Commands and actual results

Executed from the repository above. On this Windows host the native executable was `C:/Program Files/nodejs/node.exe`; npm was invoked through `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js` where needed.

1. `node --experimental-strip-types --test src/components/game/authored-character.test.ts`
   - Red integration run: 4 passed, 1 failed because player/mirror provider wiring was not yet present.
   - Preserved log: `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/rowan-red.txt`.
2. `node --experimental-strip-types --test src/components/game/authored-character.test.ts src/components/game/character-facing.test.ts src/game/look/figure.test.ts src/game/look/save-roundtrip.test.ts`
   - 12 passed, 0 failed. Real GLB parsing, hand/shoulder anchors, grounded soles, finite geometry, original asset extraction, player-only wiring, heading correction, figure anchors and appearance save roundtrip.
3. `node node_modules/typescript/bin/tsc --noEmit`
   - Exit 0.
4. `node node_modules/eslint/bin/eslint.js src/components/game/rowan-character*.ts* src/components/game/authored-character.tsx src/components/game/authored-character.test.ts src/components/game/people-meshes.tsx src/components/game/look-preview.tsx scripts/rowan-character-smoke.mjs scripts/rowan-built-smoke.mjs --max-warnings 0`
   - Exit 0 on final changed source/harness set.
5. `node scripts/audit-art-coverage.mjs --refresh`
   - Exit 0, zero audit errors; preserved existing acceptance statuses.
6. `npm run check`
   - Exit 1 at repository-wide lint: 7,951 errors and 145 warnings in unrelated existing experiment/vendor and other files. No Rowan file was listed. No cleanup scope expansion was undertaken.
7. Remaining broad gates executed once separately because `check` short-circuited:
   - `npm test`: exit 0; 276 script tests plus 768 source tests = 1,044 passed, 0 failed.
   - `npm run typecheck`: exit 0.
   - `npm run build`: exit 0. DATABASE_URL was absent; migration step explicitly skipped. No deploy command ran.
   - `npm run check:auth`: exit 0; dev/build agree sign-in is off.
8. `npm run dev -- --strictPort`
   - Owned local server at port 8080, HTTP 200, used for actual browser acceptance.
9. `node scripts/rowan-character-smoke.mjs http://127.0.0.1:8080 candidate-v1`
   - Exit 0; 16 checks passed, 6 screenshots.
10. `node scripts/rowan-character-smoke.mjs http://127.0.0.1:8080 failure-v1`
    - Exit 0; 13 checks passed, 6 screenshots. Intercepted and rejected the actual Rowan GLB request; previous character, creator and actions remained functional.
11. After build completion: `npm run preview -- --host 127.0.0.1 --port 8137 --strictPort`
    - Owned fresh built-preview server, HTTP 200.
12. `node scripts/rowan-built-smoke.mjs http://127.0.0.1:8137`
    - Exit 0; 5 checks passed, 4 screenshots. Bundled entry scripts; actual renderer Rowan request; served GLB SHA-256 identical to local approved asset; creator finish/save; zero page or console errors.
13. `git diff --check -- src/components/game/authored-character.tsx src/components/game/authored-character.test.ts src/components/game/look-preview.tsx src/components/game/people-meshes.tsx art/asset-ledger.json`
    - Exit 0. Git emitted line-ending notices, not diff errors.

Both owned servers were stopped after acceptance. Socket probes returned Windows connection-refused code 10061 on ports 8080 and 8137.

## Browser evidence and scope

The candidate/fallback scripts use isolated browser contexts and a disposable loaded-save fixture. The local scene proof checks actual player geometry, NPC exclusion, original shoulder and grip anchors, creator geometry, all five existing hair-style switches, creator-to-world skin/garb/hair material parity and saving. Walking uses the real useTile command plus normal fixed simulation substeps; measured displacement and visual yaw agree. Walking shoulder rotations are nonzero. A real hunt command with a durable fixture deer reaches a different action shoulder pose while the held-equipment subtree remains present. This is command-level gameplay input; creator interactions are real UI clicks, not claimed as pointer-to-ground movement coverage.

The built test separately verifies the actual bundled app, creator UI, delivered approved GLB bytes and clean browser console. It does not use dev-source/Fiber introspection.

Visually inspected desktop creator, desktop action, mobile game, built mobile creator and built desktop world screenshots. Rowan is assembled with visible face, hair, clothing, hands and boots; no clear detached body parts were observed. Built mobile creator controls fit at 390x844. The character is small at the normal gameplay camera. The fixture action selection panel overlaps the minimap on mobile; this is outside the character patch and remains unresolved.

## Absolute report and screenshot paths

Primary report:
`C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/rowan-integration/REPORT.md`

Exact file/evidence manifest:
`C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/rowan-integration/change-manifest.json`

Browser reports:
- `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/rowan-integration/candidate-v1/results.json`
- `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/rowan-integration/failure-v1/results.json`
- `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/rowan-integration/built-v1/results.json`

Representative screenshots:
- `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/rowan-integration/candidate-v1/desktop-creator.png`
- `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/rowan-integration/candidate-v1/desktop-walk.png`
- `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/rowan-integration/candidate-v1/desktop-action.png`
- `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/rowan-integration/failure-v1/desktop-creator.png`
- `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/rowan-integration/built-v1/mobile-creator.png`
- `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/rowan-integration/built-v1/desktop-world.png`

## Remaining blockers / limits

- Repository-wide lint prevents claiming `npm run check` is green. Changed-file lint, all tests, typecheck, build and auth check pass.
- No full all-equipment/all-action collision matrix, death/resurrection/ghost lifecycle browser run, new-world onboarding, prolonged leak/performance test, physical-phone test, or deployment acceptance was performed. Ghost materials and equipment/action ownership are preserved in code; do not translate that into untested lifecycle acceptance.
- Shag/Tail/Long are the existing additive variants over Rowan's fitted crown, not newly authored alternate Rowan hairstyles.
- No performance/no-slowdown claim: the adapter merges by body/detail role, but this was not a benchmark.
- Mobile selection-panel/minimap overlap remains outside scope.

Recommended next step: review the local Rowan screenshots, then address the repository lint backlog separately before any requested commit/deploy. No additional speculative art/performance study is needed to review this bounded integration.
