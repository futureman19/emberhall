# City-route assertion — resolved, test-only

## Decision
The reported `2469134` failure was an incorrect test destination, not a broken gate or pathfinder. No runtime, terrain, collision, save or art change was required. This supersedes the pending generated-route finding in the fortification report; it does not certify arbitrary terrain or every road pixel as reachable.

## Exact cause and retained red
- The assertion named `(140,336)` as the Millcross road. The approach heads northwest from `(152,336)` toward `(96,300)`; the actual road at x=140 is `(140,328)`.
- On the original failing seed, `(140,336)` is a tree at height7. All eight neighbors are height3–5 and none is a step. Every canonical edge is illegal; its connected component contains only that tile. A larger A* budget cannot connect it.
- The city component contains250849 tiles. The actual road `(140,328)` and Millcross `(96,300)` are reachable at the original4000 cap. This is not proof that all approach-road cells form a continuously traversable strip; the diagnostic records isolated road cells and the Ford's separate long-search limit.
- `.hermes/city-route-red.log` retains the original assertion failing on this exact seed (2pass/1fail). `city-route-root-cause.json` records full canonical connectivity and route diagnostics. The independent read-only review agrees.

## Change
Only `src/game/city.test.ts` changed among the410 checkpointed source/package/art files. The route fixture uses the original failing seed, restored synchronous RNG binding, a verified road destination, exact endpoints, legal smoothed segments and explicit west-gate crossing. Additional tests cover the Millcross round trip and retain `(140,336)` as an expected A*/command rejection with no movement. Existing4000/2000 caps, wall/climb/corner rules and other city tests remain intact.

## Browser acceptance
`scripts/worldwide-city-route.mjs` makes a fresh exact-seed world, uses canonical `setWorld`/`writeSave`/`loadSave`, and asserts successful serialization instead of inventing save contents. Separate browser contexts load it normally. Other actors are removed for input isolation and the body starts at the plaza; no terrain is repainted.

- Desktop1440×960 and browser-touch390×844, development and fresh built output:156 assertions,4 exact cases and32 input legs.
- Seven native ground-command legs reach actual road `(140,328)`; one native mini-map Kingsford tap returns to the plaza using its existing place snap/48000 cap. CPU route tests retain4000; the browser map's budget was not changed.
- Every planned segment is legal, each commanded destination is reached, active movement is sampled, and hydrated local terrain/building records remain identical. Dev/built positions, paths, intents and context match. Early weather-toast timing differs and is not whole-UI parity.
- The first ground-only return run remains failed: a projected ground click intercepted tree149336 and dispatched Chop. No harvesting was advanced. The passing run uses the existing mini-map instead; it is not a claim that occluded ground clicks were repaired.
- Built images render coherent road/forest/city views. The road-arrival player is visible; the gate sample partially hides the player. Fine visibility, full animation, natural AI, arbitrary routes, performance and physical phones remain unaccepted.

## Gates and artifacts
- 952 full tests (250script +702game),5 focused city tests; typecheck/lint/build/auth/diff pass.
- All114 GLB/Blend checkpoint assets unchanged; application code/package unchanged. Existing dirty worldwide edits preserved.
- Four HTML-linked built assets matched `.vercel/output/static` bytes. Nothing published; no runtime visual change.
- Evidence: `art/verification/worldwide/city-route-acceptance.json`, `city-route-source-before.json`, `city-route-built-freshness.json`, `city-route-dev-v2/`, `city-route-built-final/`; failed `city-route-dev-v1/` retained.
- Final logs: `.hermes/city-route-tests-final.log`, `.hermes/city-route-build-final.log`, `.hermes/city-route-focused.log`.

Next bounded art acceptance: retained keep stories. Broader-world gates remain separate.
