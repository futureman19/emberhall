# Courtyard oak and player facing preview

Preview: https://emberhall-vale-jqdd64bla-andrews-projects-ffe8a9fd.vercel.app
Deployment: dpl_HRmgFrqxhY8Fs41uZ49RYn8n3wJr. Independently inspected as Preview / Ready. No production promotion.
Branch: feature/emberhall-oaks-facing; retained prior dirty art work, no commit or push in this slice.

## Changes
- Player authored local front is -Z while simulation heading faces +Z. Initial and per-frame player visual root use facing + PI; no heading, movement or NPC change.
- Blender-authored oak kit replaces local canonical/planted oak visuals around COURT, not other species or the entire forest. Trunks, clustered crowns, saplings and decorative depleted stumps.
- Canonical harvest/growth/depletion data controls appearance; no simulation/schema/resource yield changes. Existing pick maps, fallback geometry and chunk-based refresh cadence retained.
- Source: art/blender/build_oaks.py and art/blender/oaks.blend; export public/art/lanternwood/oak.glb and oak-manifest.json. Regeneration overwrites authored source; preserve manual edits separately.

## Verification
- 515 game tests passed, lint/typecheck/build and auth invariant passed. Twelve previously established baseline script-suite failures are not cleared by this work.
- Local Playwright: actual rendered forward aligned with traveled displacement in four movement journeys (dot approximately 1); unit coverage checks eight headings. Real right-click on authored trunk selected expected tile. Harvest recovered two sound oak logs; tree depleted into dirt; exactly one stump rendered then disappeared on canonical regrowth. Acorn grew through stages 1 and 2 into oak.
- Deployed Playwright: oak GLB HTTP 200; movement journeys, harvest yield, depletion/regrowth and sapling maturation passed; no captured page or shader/WebGL errors. Bundled preview does not expose local renderer introspection, so direct live visual-yaw/stump-count assertions and projected oak-pick checks were unavailable. Local proof is not misrepresented as live transform proof.
- Independent deployed hall/pointer probe: hall entry and exit arrived, real mouse click moved player from [256,294] to [261,301], all five requested GLBs returned 200, no captured renderer/page errors.
- Deployed normal-camera desktop and mobile screenshots visually inspected: connected/grounded trees and intact hall; mobile canopy translucency is intentional. Known minimap/toolbar overlap remains.
- No old-hardware performance benchmark or exhaustive combat/equipment test claimed.

Evidence: profile telegram2/lanternwood-review/oak-local-release-result.json, oak-live-release-result.json, oak-live-walk-probe.json and matching PNGs. Harness: telegram2/emberhall-oak-facing-smoke.mjs. Build/test logs: oak-build.log and oak-tests.log.
