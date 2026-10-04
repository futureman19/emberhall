# Classic GUI release verification

## Scope
Shared nonmodal DrawerShell for You, Guide, Journal, Roster, Vale chart and Hold; stone/brass L-frame, parchment reading surfaces, Cinzel display font, bevel buttons, tokenized Health/Mana, and reduced-motion entrances. Renderer and world simulation unchanged.

## Verification
- Test-first classic-frame regressions observed failing before implementation.
- Final targeted classic/a11y audits: 10 passed, zero failed.
- Full `npm run check`: completed exit 0 (lint, full tests, typecheck, production build, auth invariant).
- Gate log: `C:/Users/futur/.hermes/profiles/telegram2/cache/scratch/emberhall-gui-ship-check.log`.
- Browser report: `after.json`, 43 cases, zero console/page errors, desktop 1440x960 and mobile 390x844.
- Screenshots: `after-desktop.png`, `after-mobile.png`, `after-desktop-drawer.png`, `after-mobile-drawer.png`, `after-desktop-map-hidden.png`, `after-mobile-map.png`, `after-desktop-parchment.png`, `after-mobile-parchment.png`, `after-desktop-spellbook.png`, `after-mobile-spellbook.png`, `after-desktop-map-open-parchment.png`, `after-desktop-map-open-spellbook.png`.
- Screenshot inspection caught mobile vitals painting above drawers; removed the unnecessary z-index and verified unobscured tabs. Integration also checks rail control occlusion and parchment material specificity.
- Existing panel-a11y source audit deliberately repointed from the old SidePanel hook location to DrawerShell, retaining role and callback assertions.
- Asset ledger refreshed after successful typecheck. No generated texture assets.

## Reproduction
Run `npm run dev`, then `EMBERHALL_URL=http://127.0.0.1:8080/ node scripts/mobile-hud-overlap-smoke.mjs`. Stop the owned server afterwards. The smoke initializes a real world, pauses simulation, and uses explicit temporary state for selected/ghost surfaces.

## Release boundary
This committed report records pre-push verification. Deployment status, exact commit and live asset-marker evidence are recorded separately after push; this document does not claim deployment success.
