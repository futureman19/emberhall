# Starting-settlement bank + forge — first review batch

## Scope and reference
Approved hall, player and courtyard oak: https://emberhall-vale-jqdd64bla-andrews-projects-ffe8a9fd.vercel.app . Preserve those assets verbatim. No later phase or production promotion.

Bank: a compact welcoming stone counting-house, softened limestone courses, walnut structural frame, bowed chestnut roof, warm barred arched windows, a readable gold coin/scales sign and small crimson civic accent. Not another twin-tower hall. Forge: open-front timber shelter around the original work contents, low shaped chestnut roof, substantial tapered masonry hood/chimney, restrained warm ember accent. No added point lights, simulated smoke or collision.

## Original geometric contracts
`BUILD_SIZE` uses half-unit voxels. World origin remains `(b.tx, groundY(world,b.tx,b.ty), b.ty)`. Voxel centres use `(v + .5) * .5`.
- Bank footprint X [-1.5,2], Z [-1,1.5]. Door is original x=-1,w=2,h=2 at z=2: open X [-.5,.5], positive-Z entrance. Preserve floor, counter, gold contents, original banker selection and bank range.
- Forge footprint X [-1.5,2], Z [-1.5,2]. Original front z=3 is open; keep the central front clear. Preserve original floor/hearth/coal/gold work contents and station action/reach.
- Keep `occupant` cutaway bounds and its +.45 front allowance unchanged. Exterior only while `!inside`; show original voxel interior inside. Keep original roof/cut picking geometry outdoors invisible with colorWrite/depthWrite/shadows off. Decoration never raycasts.
- Bank custom routing only at EMBERHALL_BANK's exact canonical coordinates. Forge routing only within the starting COURT radius (12 world units), not capital or other settlements. No new default buildings or changes to building placement rules.
- The approved disposable save has no local forge (capital forge only). A clearly labeled disposable review fixture may contain a local forge at (253,295), verified with `buildingBox`/`boxesOverlap` against every source-save building (zero overlaps). The initially considered (249,295) overlaps the yard and is rejected. This is QA/demo state, not a world-seeding change.

## Source/export and cost contracts
Source `.blend` retains named independently editable parts and live bevel/curve modifiers; export joins copies by material. Native Windows installed Blender only, headless with `--python-exit-code 1`. Regeneration warns before overwriting manual edits.
World X/Y-up/Z maps to Blender `(x,-z,y)`, standard Y-up GLB export. Ground pivot near zero. Roof top source normals must point +Blender-Z. Verify actual GLBs using GLTFLoader and independent source reopen.

Initial hard per-asset ceilings: 12,000 triangles, 30,000 exported vertices, 10 material batches, 600,000 bytes; prefer substantially below these. These are geometry ceilings, NOT frame-rate evidence. Same-state measured scene budgets in VERIFICATION.md remain the performance gate. No extra dynamic lights or runtime procedural fragment effects in this batch. Reuse existing shared GPU loader with per-placement hierarchy clones and `dispose={null}`.

## Acceptance
Failing settlement contract tests were executed before implementation (missing settlement-kit.ts). Verify actual bounds/finite geometry/materials/manifest measurements, open door/front rays, preserved canonical geometry constants, cutaway routing and interior-content policy. Append test to existing package list.

Real Playwright mouse/DOM actions: walk, select bank via original pick proxies, deposit/withdraw gold and goods, select forge, make existing ordinary iron recipe from disposable typed inventory, verify debit/result and rare-resource preservation. Inside/outside, desktop/mobile, same-save performance, errors and asset failures. Review screenshot quality separately from unit-test success.

Known baseline: lint/typecheck/build/auth pass; 515 game tests pass; 12 canonical script failures (184/196 pass). Missing local `.grok/skills/building-games` and `design-ui` guidance was searched; only og guidance exists. Windows/Hermes/user scope supersedes stale Linux sandbox deployment text in AGENTS.md. Mobile HUD overlap is a retained baseline issue, not mixed into this art batch.
