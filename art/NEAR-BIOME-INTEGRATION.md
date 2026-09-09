# Near-biome cache local integration

One useMemo-owned cache per near Terrain mount; capacity VERT_COUNT (32,761). Every synchronous rebuild calls begin(world), invalidating for world identity, sampler identity, COURT tx/ty and all tx/ty coordinates sampled by biomeWeights from ridgewatch/wolfhollow/hearthfen/brinegate/southmere. Slots compare exact finite x/z via Object.is, replacing on coordinate change; frozen weight values only. No landRev invalidation is needed for this static sampler; live heights/tile colors/cover are still recalculated. Atlas mutation is checked on next scheduled rebuild, not a new rebuild trigger. Far ground remains unchanged.

Tests: real missing-module RED preserved near-biome-red.log, then3 helper tests passed. Full32,761-grid equality/reuse, bounds, fractional/nonfinite rejection, world and coordinate invalidation, all12 mutable atlas coordinate transitions/restoration and independent instances. Updated existing sharing source regression to retain one shared sample per near/far vertex.

Gates:210 script and562 game/component tests, typecheck, lint, build passed. Four same-state desktop/mobile exact geometry/instance buffer and pixel comparisons passed, no page errors. Evidence near-biome-tests.log, near-biome-build.log, near-biome-final-lint.log and near-biome-integrated-parity.json. These do not establish cold-fill/moving-window timing or physical-mobile performance.

Local source integration only; not deployed. Next verification must include final-source completion controls AND movement/cold-fill performance before isolated delivery. Prior browser candidate timings are not final-source acceptance. Public palette preview remains current; production unchanged.
