# Exact water-survival replay verification

Task: `t_5465ed80` (controller-completed after the worker preserved commit `7424045`). Local-only, deterministic backend, zero paid/provider calls.

## Result

Two independent full-day runs used seed `20261124`, isolated ports `5701`/`5702`, separate shard data, and separate output directories. Each recorded 8,642 observations, six decisions/attempts, three acknowledged drinks, one acknowledged eat, and zero rejections, interventions, or errors. Both acceptance reports passed.

- Live report: `../replay-exact-live/report.json`
- Replay report: `../replay-exact-replay/report.json`
- Shared strict trace hash: `9699cf7d16358569a9081e61e974cec1f5f3a592aa9c8d1c1db900f232311ee3`
- Verdict: `verdict.json` — **23/23 hard checks and 24/24 total checks PASS**; `strictExact=true`, `safetyIdentical=true`, `harmlessAmbientOnly=false`.

The runs' reports name simulation-code revision `7424045eea47ff7b7fdd0a2ea84a108666707cec`. The controller's subsequent changes add configuration negative controls, repeatable npm commands, gzip-preservation support, tests, and documentation; they do not alter simulation behavior.

## Reproduce

In a fresh worktree, run `npm ci` first so direct-path tests and proof scripts use the locked local dependencies.

```sh
npm run proof:water-survival -- --out evidence/replay-exact-live --port 5701 --seed 20261124 --name exacta --key proof-water-exact-a --agent water-exact-a
npm run proof:water-survival -- --out evidence/replay-exact-replay --port 5702 --seed 20261124 --name exactb --key proof-water-exact-b --agent water-exact-b
npm run proof:water-survival:replay -- --live evidence/replay-exact-live --replay evidence/replay-exact-replay --out evidence/replay-exact-check/verdict.json
```

The live-proof script refuses to overwrite an existing output directory. Use fresh directories/ports for another run. Names, attempt IDs, ports, paths, and wall-clock timings may differ; the canonical simulation/action trace must match exactly.

## Lossless evidence preservation

The original raw logs were 226,386,165 and 226,386,145 bytes. Every file under each run's `raw/` directory is stored as gzip; stored sizes are 3,485,627 and 3,485,462 bytes. `../replay-exact-live/preservation.json` and `../replay-exact-replay/preservation.json` bind:

- original path and byte count;
- SHA-256 of the original uncompressed bytes;
- SHA-256 and byte count of the stored gzip file.

Before compression, all six SHA-bound raw artifacts in each report were checked against their original bytes. After compression, every gzip was decompressed and checked against the original SHA-256 again. The replay oracle transparently reads either raw files or `.gz` files and recomputes the strict hash from the original observation/decision content. No observations, decisions, attempts, trace events, shard state, or safety fields were dropped.

## Safety behavior

The strict hash remains a hard requirement. The oracle separately checks vitals, position, water/drowning, day/night, action/intent decisions, outcomes, triggers, counters, budget guard, exposure fields, acceptance, scheduler configuration, and zero-tariff price configuration. Negative tests prove divergent actions, vitals, positions, water exposure, counters, budget values, acceptance, scheduler config, and price config fail even when an attacker recomputes a hash. Ambient-only multiplicity is still a strict failure; it is classified separately only to explain historical pre-fix evidence, never to bless it as exact.
