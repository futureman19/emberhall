# Reedwake bridge — local completion

Implemented on `feature/emberhall-worldwide-art`, repository `C:/Users/futur/Desktop/emberhall-lanternwood-preview`. No commit, push, deployment, reset, stash, branch switch or real-save access. Existing expansion/river work and unrelated dirt retained.

## Result
- Bounded road-shoulder sand/marsh taper at the three existing crossings; original legacy terrain hash remains covered and unchanged.
- Original script-authored timber bridge at (952,560), replacing the old stepping-stone placement (old GLB itself untouched). Warm planks, bearers, crossed rail braces, capped posts, iron pegs, stone abutments and graded approach wedges.
- Blender 5.2.1 source retains **122 named editable meshes**. Runtime export is **4 meshes/materials, 5,304 triangles, 285,160 bytes**, no textures. GLB SHA256 `e52bb2b03b5069feefb5091cae633a8f9f082af9a9f4ccfedb39079f5e562c95`.
- Waterline world Y=0.6, deck world Y=1.2; top geometry and canonical actor ground agree. Approaches descend to Y=0.8. Side rail tiles blocked; decorative mesh cannot steal input. A canonical elevated picking plane uses existing terrain input handlers.
- Terrain is lowered to the visible stream **only beneath this bridge**, rather than globally changing water or placing a model above a solid ford. Primitive fallback retains usable deck, rails, supports and ramps when the actual request fails.
- Existing mill/ferry art and other asset exports not regenerated. Source ZIP has 8 files, 212,571 bytes; reopened ZIP members match source SHA256s, no `.blend1` backups.

## Verification
Commands below ran from repository root. `node` was the native `C:/Program Files/nodejs/node.exe` where invoked directly.

| Verification | Result / evidence |
|---|---|
| `node --experimental-strip-types --test src/game/river-bridge.test.ts` initial | 0/3 RED, expected missing deck height, rail blocks and asset: `red.log` |
| Render bed regression / ramp geometry / bank join RED | `surface-red.log`, `ramp-red.log`, `bank-red.log`; failures observed before implementation |
| Bridge + river + expansion targeted tests | 16/16 in `targeted-green2.log` (before final ramp mesh improvement); final full suite below includes final source |
| Blender author/export, `--background --factory-startup --python-exit-code 1 --python art/blender/river-bridge/author_bridge.py` | `blender-export-final.log`, successful real export |
| Independent new Blender process, same flags, `verify_source.py` | `source-reopen-final.log`, 122 meshes, 2,896 evaluated source vertices; names/deck tops/nondegenerate triangles verified |
| `node scripts/measure-river-bridge.mjs` | `measure.log`, `source-export-parity.json`; actual GLTFLoader matches 2,864 unique evaluated source positions at 0.0001-unit quantization |
| `node --test scripts/river-bridge-geometry.test.mjs` | `geometry-final.log`: actual GLTFLoader finite/nondegenerate triangles, deck and ramp ray heights, bounds and material budget pass |
| Changed-file ESLint `--max-warnings 0` | `scoped-lint.log`, exit 0. Final harness formatting/wait edit separately linted: `harness-lint-final.log`, exit 0 |
| `npm run typecheck` | `typecheck-final.log`, exit 0 |
| `node scripts/audit-art-coverage.mjs --refresh` | `ledger-refresh.log`; normal AST refresh retains prior reviewed records |
| `npm test` | `full-tests.log`: **277/277 script tests + 786/786 application tests**, zero failures |
| `npm run build` | `build.log`, exit 0. DATABASE_URL absent: migration intentionally skipped |
| `node scripts/check-auth-invariant.mjs --dev-url http://127.0.0.1:8137` | `auth.log`: dev/build agree, sign-in off |
| `git diff --check` | exit 0; existing LF/CRLF notices only |
| Final native desktop/emulated-mobile dev | `node --experimental-strip-types scripts/river-bridge-smoke.mjs http://127.0.0.1:8137 dev-final`: **41/41**, 24 screenshots, zero page/console errors |
| Actual rejected bridge GLB | Same command with `fallback-final fallback`: **41/41**, 24 screenshots, desktop+mobile request rejection recorded; zero page errors, exactly two expected `net::ERR_FAILED` console errors |
| Fresh production output | Same command with `http://127.0.0.1:8138 built-final2`: **39/39**, 24 screenshots, zero page/console errors |
| Production provenance | `built-provenance.json`: served entry/runtime/routes JS and bridge GLB exactly match current `.vercel/output/static` bytes |
| Source package | `zip-inventory.json`, `emberhall-river-bridge-source.zip`, per-member hash readback passed |

Browser matrix uses disposable seed7 tile-free saves preserving `Person.look` and a legacy dirt scar. Native mouse/touch selects the bridge centre and crosses both banks in both directions, then normal small simulation ticks produce exact arrival. It also rechecks both other fords, chart pixels and overflow. Dev candidate/fallback read **actual player root Y=1.2**, bridge origin Y=0.6 and pick-plane Y=1.2; built evidence deliberately omits those two dev-only R3F assertions and uses input/arrival/screenshots. Regional visits reposition the actor; they are not manual travel of the entire river. Normal camera captures precede native zoom-out used for full-bank input.

## Retained failures and boundaries
- `targeted-green.log` initially caught obsolete stepping-stone scenery seated on the raised deck. Removed that placement rather than moving its old asset; `targeted-green2.log` passed.
- First built attempt (`built-final/`) stopped after 21 checks because the mobile GLB had not completed after a fixed short delay. Its screenshot shows the legitimate temporary fallback, with no console errors. The harness now waits up to 30 seconds for the **actual request outcome** before capturing; `built-final2/` passes and visibly contains authored planks/posts/braces. No application or asset changes followed the full build/test gates—only the harness wait correction.
- Broad repository `npm run check` is NOT claimed green. Prior expansion evidence records unrelated experimental-art lint blockers (7,951 errors, 145 warnings). This task ran scoped lint and remaining gates separately, not a repository-wide cleanup.
- Visual review passed normal desktop and portrait deck continuity, player footing and complete on-deck bridge readability. Stone approach edges remain deliberately angular/light and could blend more naturally into the bank. Existing rectangular ferry display remains unchanged and conspicuous; no whole-region terrain makeover is claimed.
- Mobile is emulated touch, not physical-phone or performance certification. No fluid/boat simulation, quests or new ferry interactions.
- Preview cleanup: owned preview session `proc_f64f83684530` on 8138; process-manage kill timed out. HTTP readback still returned 200. Exact listener is PID **18944**, command `node .../vite/bin/vite.js preview --host 127.0.0.1 --port 8138 --strictPort`. Scoped `Stop-Process -Id 18944 -Force` is **pending approval**, not claimed executed. Parent may resolve cleanup. Existing dev8137 was left intact and returned 200. No restart/deploy required.

## Task files
New:
- `src/game/river-bridge.ts`, `src/game/river-bridge.test.ts`
- `src/components/game/river-bridge.tsx`
- `scripts/river-bridge-geometry.test.mjs`, `scripts/measure-river-bridge.mjs`, `scripts/river-bridge-smoke.mjs`
- `art/blender/river-bridge/{author_bridge.py,verify_source.py,reedwake-bridge.blend,README.md}`
- `public/art/river-bridge/{reedwake-bridge.glb,manifest.json}`
- `art/verification/river-bridge/` logs, disposable fixtures, reports, screenshots, ZIP

Modified for this slice:
- `src/game/frontier-river.ts` and `.test.ts`: bounded crossing-bank joins.
- `src/game/frontier.ts`: bridge stamp/rail blocking, updated Reedwake blurb.
- `src/game/frontier-art-catalog.ts`: remove replaced stepping-stone placement.
- `src/game/height.ts`: scoped canonical deck/ramp ground height.
- `src/components/game/terrain.tsx`: scoped visible bed and elevated native deck input.
- `src/components/game/frontier-scenery.tsx`: chunk-bounded bridge render, obsolete stepping-stone offset removed.
- `package.json`: new app suite appended to curated list; new script test discovered by existing glob.
- `art/asset-ledger.json`: normal AST refresh.

## Actual reviewed screenshot paths
- `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/river-bridge/built-final2/desktop-bridge-on-deck.png`
- `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/river-bridge/built-final2/mobile-bridge-on-deck.png`
- `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/river-bridge/fallback-final/mobile-bridge-on-deck.png`
- `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/river-bridge/dev-final/desktop-bridge-on-deck.png`
- `C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/verification/river-bridge/dev-final/mobile-bridge-on-deck.png`

Local implementation and bounded acceptance complete; independent parent review remains. No automatic publishing action.
