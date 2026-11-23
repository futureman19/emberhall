# Phase 3.6 live proof methodology

## Scope

One fresh dedicated character on a dedicated **local** authoritative shard, real Jev provider, unchanged production scheduler and $0.50 per-agent UTC-day guard. No Fly/Vercel, push, chain operation, planner, manual gameplay, pause, speed change, director-presence override, or saved-world mutation. Local host seed 20261121, port 5594. `src/server/main.ts` owns the normal 100-ms interval; `tickWorld` retains its existing elapsed-time clamp. The fresh registry/body receives only the ordinary host bootstrap inventory. Preflight connects/disconnects before controller activation and is excluded from enabled time.

The key is read from the shared Hermes `.env` by a local Node `run-with-key.mjs` wrapper modeled on the approved reference. Neither shell credential assignment nor credentials in command arguments are used. The host subprocess explicitly removes the provider key from its environment. Character credentials and host state stay under ignored `raw/`, never committed or attached.

## Recorder

`scripts/phase36-live.mjs` composes the same `createReflexAutopilot` and `createMeteredReflexBackend` used by the production host adapter. It supplies no policy overrides. `scripts/phase36-recorder.mjs` snapshots and redacts each observation before ingest; every observation has one survival sample and actual guard snapshot with identical wall milliseconds. The recorder refuses redaction that would invalidate replay.

Backend entry, metered begin ID, normalized response, intent/verb submission, host acknowledgment, and decision row are correlated with the actual append-only attempt record. Raw provider probabilities and the full authoritative request observation are retained. Request context keeps the scheduler's numeric ID separately from the meter's string ID. Retries/errors remain visible and cannot silently become a passing single-flight proof.

Stop occurs after >=24 cumulative vale hours, on an observed boundary without in-flight work. The controller is stopped synchronously with that boundary. Transport shutdown and serialization are excluded from enabled elapsed time. The recorded final observation and stop share a timestamp. Host timing and gameplay remain untouched throughout. Full regression gates run before the paid proof rather than competing with it for CPU.

Raw trace and attempts append to local JSONL; the final raw envelope is `raw/run.json`. `raw/character.json` and `raw/shard-data/` are private staging artifacts, **not** evidence intended for publication.

## Commands

- `node --experimental-strip-types --test scripts/phase36-*.test.mjs src/game/agent/risk-cadence.test.ts`
- `node --experimental-strip-types scripts/phase36-verify.mjs --fingerprint`
- `node --experimental-strip-types evidence/phase36-live/raw/run-live-proof.mjs --preflight` (living body and both spend fences, zero paid calls)
- `"C:/Program Files/nodejs/node.exe" --max-old-space-size=8192 --experimental-strip-types evidence/phase36-live/raw/run-with-key.mjs` (explicitly authorized paid proof; separate tracked background process)
- `node --max-old-space-size=8192 --experimental-strip-types scripts/phase36-verify.mjs evidence/phase36-live/raw/run.json > evidence/phase36-live/verification.json`

The orchestrator also gives the recorder an 8-GB heap. The source fingerprint and effective defaults are captured before activation. No raw key or account record is fed to the verifier.

## Acceptance and limitations

Require full-day survival including day/night; zero host rejections/interventions; unchanged, never-exhausted guard; independently recomputed usage-at-tariff projection <=$0.10/agent/**wall** day; and 100% decision/policy replay. USD/wall-day is observed spend × 86,400,000 / measured enabled milliseconds, not a fixed vale-day multiplier. This is a short-run projection, not a 24-hour bill or invoice reconciliation.

Policy replay is an independent offline driver of the pinned production policy, not an independent second scheduler implementation. Decision mapping and cost arithmetic are separately reconstructed. No paid calls occur during replay.

**Pressure limitation:** this baseline has hunger and energy decay, but no thirst/drowning mechanic and no HP damage at zero hunger/energy (`src/game/sim.ts:166–169`, parent risk-cadence mechanics tests). Natural terrain/food exposure must be described from observations. Merely remaining alive cannot establish water survival or starvation resistance; the literal water-pressure criterion must be marked unproven, not fabricated. No mechanics will be added or weakened in this evidence-only task.

Final metrics, exact revision, fresh agent ID, verification results, and raw artifact hashes are recorded in report.json and review.md after execution. Phase 4 remains withheld on any failed or missing criterion.
