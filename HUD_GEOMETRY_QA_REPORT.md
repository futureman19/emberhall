# Emberhall bottom-HUD geometry QA — t_8765b104

Read-only visual QA against current `main` (`f083a96`), isolated worktree
`.worktrees/t_8765b104` (branch `wt/t_8765b104`). No UI edits, no deploy, no push.
Manager browser slot granted (decision `decision__1795341714.json`); runtime ran
on explicitly allocated port 5517, foreground, per-viewport splits; server killed
and port verified released afterwards.

## Method

- Harness: `scripts/hud-geometry-qa.mjs` (repo Playwright, cached Chromium,
  headless D3D11). React-fiber hydration gate, dispatched `el.click()` only,
  throwaway warmup page per viewport.
- Fixture: seed-41 world, 5000-HP sword veteran (swords/anatomy 100) — geometry
  fixture only, **not** a balance or physical-mobile acceptance. Speed 0 during
  measurement. Overworld staged at COURT; Emberdeep entered via the native
  "Enter the Emberdeep" button, then staged at Threshold Hall.
- Matrix: 1440×960 desktop + 390×844 touch; hotbar pin counts 6 / 2 / 0; map
  default / toggled / persisted-on-fresh-load; overworld + Emberdeep; plus a
  stair-proximity case (travel card present). 13 cases per viewport, 26 total,
  0 console/page errors.
- Evidence per case: DOM rects, `elementFromPoint` hit ownership at every
  interactive center, AABB overlap areas, full screenshot. Raw data:
  `screenshots/hud-geometry-qa/verdict-desktop.json`, `verdict-mobile.json`
  (gitignored dir; key screenshots attached to the kanban card).

Note on the parent screenshots: the "hotbar slots" visible in
`t_91686e7c/screenshots/emberdeep-playtest/mobile-victory.png` are the
**TechniqueBar chips** (that fixture pins no hotbar items, so `Hotbar` renders
null). Both surfaces are affected, depending on loadout — measured below.

## Verdict 1 — Mobile bottom-HUD overlap: CONFIRMED interaction defect

At 390×844 the centered `CombatCluster` and the right-anchored `CornerCluster`
share the same bottom band (`bottom: var(--corner-clear)`), and the combat
cluster is wide enough to reach under the corner cluster. Both lift together
when the map opens (`--corner-clear` 8px → 120px), so the overlap is identical
in **every** map state, in **both** regions, and on fresh load with a persisted
dock flag. 13/13 mobile cases show overlaps; 0/13 desktop cases do.

Measured at 390×844 (map collapsed; identical when open, shifted up 112px):

| Loadout | Combat cluster | Corner cluster | Covered / untappable |
|---|---|---|---|
| 6 pins | x 2–388, y 718–836 | x 236–382, y 782–836 | hotbar slots 5+6 fully (44×44 each), slot 4 edge 5px; mana orb 34/40px |
| 2 pins | same width (6-slot dock) | same | same as 6 pins |
| 0 pins (parent state) | x 66–324, y 778–836 | same | Cleave technique chip 37×48px; mana orb fully (40×40) |

Hit-target census (`elementFromPoint` at element centers):

- `hotbar-slot-4` "Cabbage (quick slot)" → hit lands on `corner-cluster` svg.
- `hotbar-slot-5` "Log (quick slot)" → hit lands on `corner-cluster` polygon.
- `technique-chip-2` "Cleave (technique)" → hit lands on the corner cluster's
  **"Resume time" button** (0-pin loadouts).
- `orb-mana` → hit lands on `corner-cluster` (MapToggle button or svg) in all
  13 cases; the blue orb is visually hidden beneath the panel.

These are stolen hits, not just paint order: the right-hand quick slots and the
right-hand technique chip **cannot be tapped** on a 390px viewport, and the mana
orb cannot be seen. The corner cluster paints later in DOM order and owns the
overlap region.

Bonus finding (stair proximity, map **open**, both regions): the lifted combat
cluster also covers the `EmberdeepTravel` card's button —
`travel-button` hit lands on `hotbar` / `technique-bar`. Near the stair with the
map open on mobile, **Enter/Leave the Emberdeep is untappable**. With the map
collapsed the card sits clear (bottom-32 = 128px > combat band).

Unaffected / preserved (measured, must stay so in any fix):

- Corner cluster buttons (Resume time, Faster time, MapToggle): 44×44, hits intact.
- Docked minimap when open: 112×112 block at x 278–390, y 732–844, fully inside
  the viewport; center tap-to-walk hit intact; hide button 44×44, hit intact.
- Hotbar slots 44×44, technique chips 48×48, health orb fully visible/tappable.
- Desktop layout: combat cluster x 507–933 vs corner cluster x 1286–1432 —
  353px apart, zero overlap in all 13 desktop cases.

## Verdict 2 — Desktop minimap "clipping": NOT a defect (by-design flush dock)

Runtime geometry at 1440×960 (map open, all pin counts, both regions):

- Block rect: x 1328–1440, y 848–960 — `right == viewport.w`, `bottom ==
  viewport.h` exactly; viewport-clip flags all false.
- Canvas 110×110 fully inside the 112×112 block (1px border); nothing renders
  outside the viewport. Center hit → `docked-minimap` (tap-to-walk works);
  hide button hit intact.
- Persisted collapsed flag honored on fresh load (desktop loads collapsed when
  stored '1'; mobile loads open when stored '0').

The parent screenshot's "clipped at lower/right edges" is the **intentional
edge-flush corner dock**: the block has no right/bottom margin, so it reads as
cut off, but no part of the block or canvas is actually outside the viewport.
Classification: working as designed. If the flush look is undesirable it is a
cosmetic product decision (e.g. a 2px inset), not a layout bug — out of scope
here.

## Recommendation (for a bounded implementation card — no edits made)

Root cause is one placement collision: in band mode (<768px) two fixed clusters
anchor to the same bottom offset while the centered one spans nearly the full
viewport width. Smallest fix that preserves every measured hit target:

1. **Relocate `CornerCluster` in band mode** out of the bottom band — e.g. stack
   it vertically under the top-right `UtilityCluster`, or anchor it above the
   combat band (`bottom: calc(var(--corner-clear) + <combat-band height>)`).
   One placement change in `chrome/corner-cluster.tsx`; desktop path untouched.
   Keep buttons ≥44×44.
2. **Travel card**: in band mode with the map open, lift `EmberdeepTravel`
   above the combat band (or move it top-center) so its button is never under
   the hotbar/orbs. One offset change in `emberdeep-travel.tsx`.
3. Acceptance: re-run `scripts/hud-geometry-qa.mjs` — zero `hit-stolen` and zero
   combat/corner AABB findings across the 26-case matrix; corner buttons and
   minimap hide stay ≥44×44; desktop census unchanged; minimap tap-to-walk and
   persisted dock flags still pass.

Alternative (more invasive, not recommended first): cap combat-cluster width in
band mode and left-align — the 6-slot dock is 292px fixed, so capping below
~300px would overflow or force slot shrinkage below 44px.

## Reproduce

```bash
cd C:/Users/futur/Desktop/emberhall/.worktrees/t_8765b104
node scripts/with-app-env.mjs node ./node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port <free 55xx> --strictPort
HUD_QA_DEVICE=desktop node --experimental-strip-types scripts/hud-geometry-qa.mjs http://127.0.0.1:<port>
HUD_QA_DEVICE=mobile  node --experimental-strip-types scripts/hud-geometry-qa.mjs http://127.0.0.1:<port>
```
