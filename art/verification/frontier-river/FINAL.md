# Frontier river — local completion

Recovered and completed on `feature/emberhall-worldwide-art` in `C:/Users/futur/Desktop/emberhall-lanternwood-preview`. No commit, push, deployment, reset, stash, branch change or real-save access. Existing expansion and unrelated dirt retained.

## Result
- Continuous authored river corridor from Winter Crown snowmelt (738,258), through the Reedwake mill channel, to the southern boundary (1100,1144). Variable-width meanders, sand/marsh margins and graded valley banks replace the isolated mill channel.
- Level water uses tile height 3; water is not walkable. Three named raised stone fords at (750,268), (952,560), (940,820) use height 4 and canonical navigation. Roads do not randomly overwrite the river.
- Water and ford terrain retain their distinct palette/cover instead of inheriting desert sand or tundra snow blending. The rendering exception is scoped to this authored corridor and actual water/step tiles, excluding legacy terrain and dirt scars.
- All nine frontier sites remain reachable outward and back. Seed7 original 512-square terrain hash remains `4587ba9a206d892e12f896ec01f38a8516152c6cf5dd42701db270f2af40c6a4`.
- Tile-free v4 saves regenerate the river and preserve state, appearance and scars; all fixtures were disposable local-storage maps or fresh browser contexts.

## Verified
- RED evidence: `red.log` (original connectivity/water failures), `surface-red.log` (surface-identity test before implementation).
- Targeted GREEN: `green.log`, 11/11 river + expansion tests.
- Final full tests: `full-tests-final2.log`, 276/276 script tests and 781/781 application tests, zero failures.
- Changed-file ESLint: `changed-lint-final.log`, exit 0, zero warnings. TypeScript: `typecheck-final.log`, exit 0. Build: `build-final.log`, exit 0; database migration skipped because DATABASE_URL is unset.
- Renderer line changes required art-ledger refresh (`ledger-refresh.log`). An intermediate full run failed only its stale-location assertion; the refresh and final full rerun passed.
- Dev `dev-final3/results.json` and production output `built-final/results.json`: each 33/33 checks, 20 screenshots, zero page/console errors. Desktop mouse and emulated-mobile touch commanded all three bank-to-bank crossings both ways, followed by normal simulation ticks and exact arrival checks. Regional inspection uses actor repositioning, not a claim of walking the entire river manually.
- Both surfaces confirm save appearance/scar retention, no horizontal overflow and actual chart water pixels along the river.
- `built-provenance.json`: served entry and routes JS match emitted `.vercel/output/static` bytes by SHA256.
- Visual review: full chart shows mountain-to-south-edge course; desktop southern crossing has distinct dark water and continuous ford; built mobile Reedwake reviewed.

## Scope / limitations
- Full repository `npm run check` is NOT claimed green. The pre-existing expansion report records repository-wide lint blocked by 7,951 errors and 145 warnings in unrelated experiments (`../world-expansion/full-check.log`). This recovery ran narrow lint and the remaining relevant gates independently; it did not clean unrelated files or rerun that known broad lint blocker.
- Raised fords interrupt water-colored tiles with walkable stone. Connectivity tests explicitly include these crossings; there is no claim of water-only flood connectivity beneath them. No fluid simulation, boats, quests or hydraulic model.
- Fords use existing terrain step material and can read as simple causeways rather than individually modeled stones. Original authored flat mill/ferry pads remain visible. These are not new bridge assets or a whole-world art polish pass.
- Mobile means emulated touch viewport, not physical-phone performance. Native camera zoom was used to expose both banks. One harness defect was corrected: the initial widest-ford click landed on the minimap HUD; no navigation change was needed.
- Owned preview on 8138 was stopped and connection refusal checked. Pre-existing dev server on 8137 was left running and still returned HTTP 200.

## River task files
- `src/game/frontier-river.ts` — recovered river geometry/stamp, added scoped surface identity.
- `src/game/frontier-river.test.ts` — recovered contract tests plus surface-identity regression.
- `src/game/frontier.ts` — recovered final river stamping integration in place of isolated channel.
- `src/components/game/terrain.tsx` — three-line scoped rendering integration.
- `package.json` — appended river suite without replacing curated test list.
- `scripts/frontier-river-smoke.mjs` — new bounded disposable-save dev/built browser harness.
- `art/asset-ledger.json` — generated AST source-location refresh; prior reviewed records retained by refresher.
- `art/verification/frontier-river/` — progress, this report, logs, disposable fixtures, screenshots, JSON verification and provenance.

## Screenshot entry points
- `built-final/desktop-south-before.png`
- `built-final/mobile-south-returned.png`
- `built-final/mobile-reedwake-before.png`
- `built-final/desktop-mountain-source.png`
- `built-final/desktop-chart.png`
- `built-final/mobile-chart.png`

Next: parent reviews saved evidence and local diff. No publishing action is authorized or required.
