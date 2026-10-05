# Local review-blocker closure

No push, main merge, deployment, or remote write was performed. Isolated branch: `review/emberhall-merge-fixes`; path: `C:/Users/futur/Desktop/emberhall-review-fixes`.

Parents: reviewed source `4fa90664ee226347e22a6ca394c3ee80dc1c1878`, fetched main `8bfa2703ea9711070b88b6e90900b386efb24b89`. Both histories retained by a local merge commit on the review branch. Conflict decisions: MERGE-MAP.md.

## Fixed
- Ordinary buildings and generated farm-bed extents reject Reedwake deck/approach/rail reservations before gold, plots or terrain mutate. Adjacent legal farm placement still succeeds. River-bank generation retains its pre-reservation behavior.
- Chart-scale arbitrary road destinations use sampled road connectors selected by actual bounded searches, not exact named markers. Reverse journeys and an inaccessible nearest named connector are covered.
- Live obstruction validation permits bounded local detours around hydrated legacy regrowth; sealed destinations still reject. Each approach/exit remains capped at the caller's cap, local detours at 2048 expansions, with an explicit aggregate assistance budget of twice caller cap plus 8192. This is bounded assistance, not a performance/optimality claim.
- Integrated main's TanStack Start 1.168.60 patch and matching lock; npm ci succeeded. No claim of zero unrelated dependency advisories.
- Fixed committed first-party unused bindings. Excluded only eight explicitly listed upstream Three.js vendor subtrees from first-party ESLint. Kept gallery/application code linted.
- Retained review frontier/river/bridge, seating, keep stair lip, and main Hearthwright, spells, touch/a11y, UI chrome, resources, and Rowan updates. Tests import main's shared SPECS while preserving review-specific keep physics tests. Retired only main-deleted minimap registration; all existing source tests plus new regressions registered exactly once.
- Regenerated art inventory from merged sources after unioning evidence; all 88 non-inventoried parent state records preserved (count includes records appearing in both parents), no missing evidence records.

## Executed evidence
- `red.log`: all three original gameplay regressions failed for the expected defect before fixes.
- `targeted-final.log`: four regression cases pass, including negative controls.
- `check-verified.log`: actual `npm run check`, CHECK_EXIT=0; ESLint with max-warnings 0, 473 script tests + 1080 application tests, TypeScript, production build, auth invariant sign-in off all pass.
- `built/results.json`: 10/10 browser checks; native minimap click to non-marker destination starts movement on both clean and hydrated saves; local hydrated rock detour reaches its destination; ordinary construction API refuses bridge and accepts adjacent farm; mobile overflow and console/page error checks pass.
- `dev-final/results.json`: same 10/10 checks against dev source.
- `rowan-built/results.json`: 15/15 checks for creator, persisted appearance, unchanged approved asset hash, equipment, action, poison death/healer resurrection, and rejected-model fallback. Names inherited as 'native-walk/action/equip' in this older harness invoke game-store handlers, not physical pointer input.
- `build-smoke.log`: separately successful build used for built browser smoke. Final canonical check rebuilt the same source successfully.

## Review and boundaries
Reviewed whitespace-insensitive per-parent diffs and conflict blocks; source/type/full tests and runtime support both sides. Local self-review, not a claim of independent external QA acceptance. Screenshots and browser JSON are evidence, not proof of long-distance end-to-end traversal or frame-rate performance. The native chart test proves dispatch and initial movement; CPU tests validate every returned segment. The short hydrated obstruction test proves arrival. Bridge stills relocate the actor only for visual capture. No deployed verification, wallet transactions or external writes performed.

Unresolved requested blockers: none. Nonblocking inherited whitespace: main's digging.test.ts and placeables/legacy-buildings.ts contain blank lines at EOF; no unrelated whitespace churn performed. Initial/abandoned gate logs are retained and superseded only by `check-verified.log`. Database migration skipped automatically because this isolated checkout has no DATABASE_URL; PGLite fallback remains the app default.

Final post-check production reruns: `built-final/results.json` passes 10/10 checks and `rowan-final/results.json` passes 15/15, both with empty error lists. Selected built screenshots are committed beside the results. Owned isolated-worktree Vite processes were stopped; an unrelated original `Desktop/emberhall` server on 8080 was left untouched. Original review worktree remains at `4fa90664ee226347e22a6ca394c3ee80dc1c1878` with its same three tracked dirty paths.

Implementation merge commit: `d4baadbe9ec68f5286e2cc6aa3f60c743c28e5bf`. Next: parent may inspect the local commits and evidence before pushing the existing review branch. No push or deployed verification was performed.
