# Mobile bottom-HUD overlap fix (t_8907b99d)

Fixes the confirmed defects from investigation t_8765b104 (harness commit 496af9a,
cherry-picked here as c879fdb). Base f083a96. Local commit only — no push/deploy.

## Changes (2 components, band mode <768px only; desktop untouched)

1. `src/components/game/chrome/corner-cluster.tsx` — in band mode the time/map
   plate docks under the top-right utility plate: `max-md:top-[120px]
   max-md:right-3 max-md:bottom-auto` (120px = utility top-3 12px + 100px plate
   + 8px chrome gap; right-3 aligns with the utility plate). Desktop keeps
   `bottom-[var(--corner-clear)]` above the minimap corner.
2. `src/components/game/emberdeep-travel.tsx` — the stair card rides above the
   combat band on phones: `max-md:bottom-[calc(var(--corner-clear)+126px)]`
   (118px max combat band + 8px gap). Desktop keeps `bottom-32`.

No new components, no UI rewrite, no desktop layout change.

## Acceptance evidence (all re-run on the final code)

- Census harness `scripts/hud-geometry-qa.mjs` vs dev server 127.0.0.1:5517:
  - mobile 390x844: 13 cases, 0 errors, 0 findings (zero hit-stolen, zero AABB).
  - desktop 1440x960: 13 cases, 0 errors, 0 findings — layout unchanged
    (corner x1286-1432 y786-840 above minimap y848-960; combat centered x507-933).
  - Matrix: 6/2/0 hotbar pins x map default/toggled/persisted x overworld/Emberdeep
    + stair proximity with map open and collapsed.
- Mobile corner plate rect: {'x': 232, 'y': 120, 'w': 146, 'h': 54, 'right': 378, 'bottom': 174} — out of the bottom band.
- Corner hit targets: [('Resume time', 44, 44), ('Faster time', 44, 44), ('Show mini-map', 44, 44)] — all >=44x44.
- Stair card (map open): {'x': 67, 'y': 468, 'w': 256, 'h': 130, 'right': 323, 'bottom': 598} — Enter button fully clear of the
  combat band (technique top y606); map-collapsed case y580-710 clears hotbar y718.
- Mana orb: hit ownership intact in all 13 mobile cases (was occluded in all 13 before).
- `smoke:mobile-hud` (EMBERHALL_URL=5517): ok=true, 43/43 cases — assertCorner
  updated to the band-mode contract; desktop corner assertions unchanged.
- New lockdown test in `scripts/audit-ui-classic-frame.test.mjs` (band-mode anchors).

## Gates

- npm test: pass, fail 0 (incl. art-coverage + safety-test-registration audits).
- tsc --noEmit: exit 0. eslint --max-warnings 0: exit 0 (3 pre-existing unused-var
  warnings fixed in hud-geometry-qa.mjs / two-client-proof.mjs — no behavior change).
- npm run build: exit 0 (db:migrate skips without DATABASE_URL).
- check:auth --dev-url 5517: dev and build agree, sign-in off.
- art/asset-ledger.json: sanctioned `--refresh` (2-line diff: CornerCluster
  line-pins :12 -> :19 after the doc-comment addition).

## Known transient proximity (out of acceptance scope)

The fishing-status toast (top-36, pointer-events-none, only during an active
fishing minigame) can visually graze the docked plate's lower-left corner at
390px. It steals no taps and is not part of the census matrix.

## Reproduce

```bash
npm run dev -- --host 127.0.0.1 --port 5517   # wrapper-mediated; 8080 untouched
HUD_QA_DEVICE=mobile  node --experimental-strip-types scripts/hud-geometry-qa.mjs http://127.0.0.1:5517 > m.log 2>&1
HUD_QA_DEVICE=desktop node --experimental-strip-types scripts/hud-geometry-qa.mjs http://127.0.0.1:5517 > d.log 2>&1
EMBERHALL_URL=http://127.0.0.1:5517 node scripts/mobile-hud-overlap-smoke.mjs > s.log 2>&1
```

Redirect to file, never pipe: the shell shim kills piped node runs with
"stdin is not a tty" on this host.
