# Phase 3.6 independent economics and replay evidence

This tool does **not** run a shard, spend money, connect to a provider, deploy, or
change the scheduler. It verifies a fresh single-agent proof recorded by the live
worker. Do not feed it the old `report.json`: that is a claim, not reproducible
input. Phase 3.5's 12,607 micros / 954,804 ms projects to
$1.140804604924152/agent/wall-day, failing the new <=$0.10 threshold.

## Invocation

Run from the integrated task worktree, after merging scheduler + verifier:

```sh
node --experimental-strip-types scripts/phase36-verify.mjs --fingerprint
node --max-old-space-size=8192 --experimental-strip-types scripts/phase36-verify.mjs evidence/phase36-live/raw/run.json > evidence/phase36-live/verification.json
node --experimental-strip-types --test scripts/phase36-*.test.mjs
```

The fingerprint command prints the effective default config and fixed-list source
hashes to capture **before** starting. The verifier rejects a different config or
source fingerprint; it also requires the merged default `riskGated: true` and
policy version `phase36-risk-v1`. The legacy baseline intentionally cannot pass
the Phase 3.6 combined gate. Script tests are already registered by the repository's
`scripts/**/*.test.mjs` glob. Full repository/live gates belong to downstream cards.

Exit codes: **0** recorded evidence passes all checks; **1** failed/incomplete
checks, with mismatches; **2** malformed/unreadable envelope. Output is a compact
verdict, never a copy of raw observations or provider payloads. Do not use shell
pipelines that hide the Node exit code. Tests contain explicitly synthetic data;
they are not live acceptance evidence.

## Evidence envelope (`emberhall-phase36-v1`)

Store the raw JSON envelope at `evidence/phase36-live/raw/run.json` (gitignored).
All arrays below are required, even when empty. Missing values are not zero.
Use a fresh dedicated agent and a new directory. Do not silently aggregate old
attempt histories, overwrite failed runs, or omit failed calls.

- `schema`: exactly `emberhall-phase36-v1`.
- `agentId`, `bodyId`: dedicated identities; no credentials.
- `reason`: `full-vale-day` only on actual completion.
- `policy`: exact output of `--fingerprint`: `{version, config, sourceHashes}`.
  Config includes cadence, event thresholds, failure backoff, concurrency and the
  integrated risk gate/idle heartbeat. No defaults may be omitted.
- `maxSampleGapMs`: declared observation gap limit, at most **2000 ms** for live
  acceptance. Record every host observation actually ingested, not timer samples.
- `segments`: one uninterrupted enabled interval
  `{startMs,endMs,startHour,endHour,mode:'enabled'}`; optional trailing `stopped`
  interval for cleanup visibility. Wall values are actual epoch milliseconds;
  hours are cumulative authoritative vale hours (not modulo 24). Set boundaries
  to first and last survival samples. Start at actual controller activation,
  not process boot; end BEFORE stop/close/fsync/reporting. Samples must cover both
  boundaries. A run must span >=24 enabled vale hours. Reconnect, budget-blocked,
  restart or disconnected intervals fail; they cannot improve the denominator.
- `samples`: `{wallMs,tick,hour,hp,ghost,hunger,energy,utcDay,guard}` per observation,
  including the initial and terminal observations. `utcDay` is YYYY-MM-DD from
  wall time. `guard` is `{capMicros:500000,spentMicros,reservedMicros,exhausted}`
  read from the actual guard at that time, not inferred from the end summary.
  Use provider reservation-start UTC day accounting, consistent with BudgetGuard.
  Guard spend is cross-checked against completed calls for that day. Fresh history
  must be empty. Any closed/changed/missing guard fails.
- `calls`: one entry per provider attempt, including failures:
  `{id,agentId,startMs,endMs,status,usage,price,model,costMicros,costBasis}`.
  Copy from the append-only attempt log, not the summary. `id` is its attemptId;
  times are begin.startedAt/end.endedAt; `usage` has `promptTokens` and
  `completionTokens`; `price` is the original tariff snapshot with model, currency,
  promptPerMTok, completionPerMTok, source, capturedAt (other provenance is welcome).
  `costBasis` must be `reported` to pass; null/estimated/interrupted stays visible
  and fails. Cost is independently recomputed as
  `ceil(promptTokens*promptPerMTok + completionTokens*completionPerMTok)` micros.
  This is usage-derived cost at a captured tariff, **not a reconciled invoice**.
- `decisions`: `{attemptId,observation,row,exchange,raw,answers}` per successful
  call. `observation` is the full authoritative Observation used by prepare, before
  wire compaction. `row` is the emitted DecisionLogRow, `exchange` the actual
  provider exchange, `raw` the provider pre-normalization map
  `{next_action:[...]}`, `answers` the normalized ReflexAnswer array. No shallow
  replay pass: raw probabilities are mandatory. Successful calls and decisions
  must match one-to-one. `row.outcome` must be null for the zero-rejection proof.
- `rejections`: explicit array of actual host refusals with wall time/attempt ID;
  zero required. Keep rejected decision outcomes too; do not count only one side.
- `interventions`: explicit array of manual actions, planner/fallback commands,
  reconnection/restart or observer mutations with wall time/kind; zero required.
  Empty means the recorder observed none, not proof that unlogged actions cannot
  exist. Reviewer must inspect host/operator provenance separately.
- `trace`: ordered events described next. All pushes, including suppressed idle
  ones, are required. Each has contiguous zero-based `seq` and nondecreasing
  epoch `wallMs`. Snapshot objects when writing: never retain mutable references.

## Ordered policy trace contract

Wrap the autopilot's injected source/backend/submit/verb/hooks in the **proof
harness**, without modifying decision semantics or adding waits to the live loop.
Append each event at its boundary, with the same clock/sequence writer:

| type | additional fields | boundary |
|---|---|---|
| `observation` | `observation` (full) | immediately BEFORE each `ingest`, including welcome |
| `request` | `attemptId,exchange,context` | backend `decide(exchange,context)` entry; context is the full AttemptRequest, including scheduler-local numeric attemptId, tick, bodyId, triggers, stateHash and surfaceDigest |
| `response` | `attemptId,answers` | immediately before resolving backend decide to autopilot |
| `submit` | `attemptId,action` | submit/verb entry; action `{type:'intent',intent}` or `{type:'verb',verb,item}` |
| `ack` | `attemptId,rejection` | immediately before resolving submit/verb; rejection is null on success |
| `decision` | `attemptId,row` | `onDecision` callback |
| `stop` | none | after all in-flight responses/acks/decisions are recorded, at controller stop |

Correlate scheduler numeric IDs with metered attempt IDs explicitly. The outer
`attemptId` on trace rows is the same string as `calls[].id`. Do not substitute
scheduler IDs for metering IDs. The trace's context preserves the scheduler's own
numeric ID. Match the request observation by its exact tick and preserve it in the
decision envelope. Capture normalized responses at the backend boundary and raw
probabilities from the attempt end record. Never log auth headers, WS URLs with
keys, environment variables, account records, or the raw HTTP request object.
Use `redactForLog` before durable serialization; any redaction affecting replay
inputs makes evidence incomplete, not grounds to silently accept a shallow replay.

Successful Phase 3.6 proof is single-flight. Error/timeout/blocked/interrupted runs
fail accounting and must be retained for diagnosis; this replay does not invent
responses or recover lost completion ordering. At full-day completion, stop on a
stable boundary after in-flight work finishes; retain observations until that
boundary. Do not include post-stop shutdown latency in enabled time. The verifier
requires a one-to-one ordered sample/observation match (including wall timestamp),
and the sole final stop timestamp must equal the last observation and enabled end.
Capture that logical stop boundary synchronously; later transport/fsync cleanup is
not part of the observation window. Metered start/end times must fall inside the
matching backend request/response trace boundaries.

## Independence and limits

1. Accounting recomputes costs, UTC buckets, survival and elapsed projections from
   records. Always-on USD/agent/wall-day = observed USD * 86,400,000 / enabled ms.
   USD/vale-day = observed USD * 24 / covered vale hours. The measured
   vale-days/wall-day multiplier is reported, never hard-coded to 90.5.
2. Decision replay separately implements option preparation, compaction,
   normalization and first-max selection, then compares every row field and
   exchange. It shares only pure domain primitives: intent mapping, food priority,
   catalog and hash. It does not run the production action executor.
3. Policy replay is an independent offline driver of the **pinned production
   policy**, not a second independent scheduler implementation. It feeds every
   logged observation, holds backend and host acknowledgements on deferred promises,
   and reproduces asynchronous completion order. Every emitted request, trigger,
   exchange, submit and decision must equal its recorded counterpart. Unexpected
   or missing calls, omitted trace outputs, mutated config and source drift fail.
   The backend and submitters are local stubs: replay issues zero paid calls.
4. Replay proves reproducibility of supplied inputs, not that a dishonest logger
   captured every event. The combined verdict checks day/night coverage and
   sample/trace vitals. Reviewer must retain raw host logs and inspect fresh-agent
   provenance, pressure exposure, interventions, guard operation, and pricing.
   A short-run projection is not a measured 24-hour bill or a survival guarantee.

## Integration checklist for the live-proof worker

- Cherry-pick this tools commit and the scheduler commit into a dedicated worktree.
- Record the actual merged source fingerprint/default config before a fresh run.
- Extend the live harness with the boundary wrappers above; the old script alone
  does not emit sufficient inputs and must not be relabeled Phase 3.6 evidence.
- Retain immutable raw attempts, ordered trace and host logs under `raw/` or
  ignored `*.jsonl`. Full observations can be large; keep them local. The verifier
  currently reads the envelope in memory (8 GB Node heap invocation above).
- Run the verifier; retain `verification.json` plus sanitized review notes with
  hashes of raw artifacts. A failed projection is a failed economics gate even
  if the body survives and its measured vale-day spend is below $0.50.
- Commit only tools/docs/sanitized verdict/review, never raw logs or secrets.
- No push, deploy, chain operation or paid call is authorized by this tool.
