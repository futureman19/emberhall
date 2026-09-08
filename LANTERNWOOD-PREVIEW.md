# Lanternwood starting-town art preview

## Handcrafted medieval hall sample
Latest review URL: https://emberhall-vale-p0ehdkcwa-andrews-projects-ffe8a9fd.vercel.app
Branch: feature/emberhall-handcrafted-hall; deployment dpl_2rFSjBwosz6kHq26MHDMSiT9yVBx verified preview / Ready. Not merged or promoted.
Replaced jade roof treatment with brown roof skins and individually varied shingles; stone crenellations replace pavilion caps; twin red/gold diamond banners, shallow stone courses and foundation ivy. Bevelled instanced decoration softens edges; local daytime fill and shadow radius improve readability. Existing courtyard ground pass retained. No gameplay/collision/world data changes. Still a procedural/blocky art-direction sample, not final Tiny Glade-level assets.
Verification: 502 game tests pass; lint/typecheck/build/auth invariant pass. Live desktop/day/dusk/mobile Playwright captures show no page/shader errors; both live desktop and mobile images inspected. Known mobile minimap-toolbar overlap remains. Baseline script failures below remain out of scope. No old-hardware performance parity claim.
Screenshots: profile lanternwood-review/handcrafted-live-*.png.

## Ground pass update
Branch: feature/lanternwood-ground-preview. Latest verified preview: https://emberhall-vale-qjhfeb2n0-andrews-projects-ffe8a9fd.vercel.app (dpl_FvURw1yhehooc3uttfLrpd2qpmU8, preview / Ready).
Added fragment-only low-frequency meadow patches, feathered worn-earth shoulders and staggered moss-jointed pavers restricted by world-coordinate town influence and existing terrain coverage. Sparse low grass/clover/flat pebbles use existing non-pickable art batches, grass-only verges, and exclude plots/building margins. No height, collision, world or gameplay writes.
Validation: lint, typecheck, build, auth invariant and 501 game tests passed. Live desktop/day/dusk/mobile Playwright renders had zero page or shader errors; desktop and mobile screenshots visually inspected. Existing 12 baseline script failures remain documented below; full release gate is not claimed green. Production untouched. Screenshots: lanternwood-review/ground-live-*.png in profile workspace.

## Previous town pass

Branch: feature/lanternwood-town-preview (base 5c9c457). Not merged or promoted to production.

Review URL: https://emberhall-vale-32jl51fgm-andrews-projects-ffe8a9fd.vercel.app
Deployment: dpl_33JbXRkpy7wPF3UQhVxHzUDtXTQ8; Vercel readback confirms preview / Ready; unauthenticated HTTP 200.

## Scope
World-coordinate presentation influence around COURT, full inside 13 units and smoothly feathered to zero at 32. Warmer local ground/building colors; seated jade ceramic roof skins on hall/bank; tower caps, lanterns, curtains, planters; grass-only garden accents; instanced soft canopy lobes and fireflies. Other settlements unchanged by the influence. No gameplay world/schema/pathfinding/collision/camera/streaming edits. Decorative meshes have no-op raycasts. Roof dressing hides when inside. Existing resource meshes/pick mappings remain.

## Verification
- Lint: pass.
- Typecheck: pass.
- Production build: pass (existing bundle-size warnings).
- Auth invariant with owned dev URL on port 8089: pass, sign-in off.
- Explicit game test list including six new art tests: 499 passed, zero failed.
- Script tests: 184 passed / 12 failed, EXACT same failing test names in original workspace. Eight share-card/template expectations and four Windows wrapper CLI expectations. These were previously silently skipped by npm's single-quoted glob under Windows; package test command now uses double quotes. Full canonical gate is NOT green; no claim of release readiness.
- Parent inspected same-save baseline/candidate day/dusk/mobile screenshots. Fixed floating-looking ridge trim and reduced additional canopy width.
- Live deployed Playwright journey: Continue with copied disposable QA save, playing state, desktop day/dusk and mobile captures; zero uncaught page errors.
- Extended live gathering-animation smoke timed out after 180 seconds; not verified, no fabricated pass.

## Review limitations
Existing mobile minimap overlaps bottom toolbar. Existing DEV_DAYLIGHT=true preserved: dusk captures demonstrate clock/sky state, not true night darkness. Dense forest can still obscure small figures. Lighting, character design and HUD overhaul intentionally deferred. This is a scoped art-direction prototype.

## Art files
src/components/game/lanternwood-art.ts: pure art influence, palettes, geometry recipes.
src/components/game/lanternwood-dressing.tsx: noninteractive instanced assemblies.
src/components/game/lanternwood-art.test.ts: locality, determinism, roof support, pick exclusion.
Integration: terrain.tsx, building-meshes.tsx, world-scene.tsx.

Screenshots and verification logs: C:/Users/futur/.hermes/profiles/telegram2/lanternwood-review/ ; workspace lanternwood-*.log.
Ignored build prerequisite .grok/app-env.json copied from original (auth and database off); .grok/skills/og copied for documentation contract tests. Correct canonical Vercel project link copied; no production flag used.
