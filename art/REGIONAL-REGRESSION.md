# Regional deployed regression batch

Current flora preview1hq8nnatn; no runtime/deploy changes. North tool fixtures tx80..134, mobilety100/desktopty120; southeasttx420..474, mobilety400/desktopty420. Actual chop/mine/till/fish, controlled max skills/RNG/disposable local clearings; eight outcomes per region,16 total passed, no page errors. These do not establish natural spawn/resource availability or pointer-selection behavior.

Two mobile-viewport real useTile walks: north80,100 to104,100 arrived734frames,p95~16.7ms,max133.3ms; southeast420,400 to444,400 arrived637frames,p95~16.8ms,max100ms. Corridor tile kinds set to grass; heights/buildings not reset. Actual positions captured show routed motion; not an untouched-world path test. Desktop GPU, not physical phone. No CPU profiler in these runs.

Raw regional-walk-{north,southeast}.json inherited stale scope text mentioning two cached CPU-profiled runs; source description corrected afterward. The cached=true field is also inherited, not evidence near-biome cache was reintroduced. Raw timing/positions preserved unchanged. All16 actions +two walks passed; lint passed before scope-only wording correction.

Evidence tools/actions-flora-{north,southeast}/results.json; civic/regional-walk-*.json, regional-lint.log. Remaining: natural-world routes and gameplay-camera/occlusion acceptance, global performance. No claim the observed100–133ms stalls are solved.
