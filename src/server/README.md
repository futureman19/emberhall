# Shard host (P2-A + P2-B)

Run locally with `node --experimental-strip-types src/server/main.ts`.
HTTP and WebSocket share `PORT`, bound on `0.0.0.0` (default 8080).
`GET /healthz` returns `{ok:true,tick,characters,uptimeSec}`.
No browser globals are required by these modules.

Environment only (no `.env`):

| Variable | Default |
| --- | --- |
| `PORT` | `8080` |
| `EMBERHALL_DATA_DIR` | `./shard-data` |
| `EMBERHALL_SEED` | `20261121` |
| `EMBERHALL_KEYS` | `kett:dev-kett,bran:dev-bran` |

The default keys are **local proof credentials**, not production credentials.
The registry contains plaintext keys; keep the data directory private. Files are
created with mode 0600 on systems supporting POSIX modes. Configure Windows ACLs
at deployment. Existing registry entries win over environment seeds; changing an
existing name's environment secret is not credential rotation.

`createShard(config)` boots and persists the initial registry/world but does not
start its timer. `start()` starts one 100ms interval. `step(elapsedSeconds)` is the
same tick boundary for deterministic CPU tests. Elapsed time is measured with a
monotonic clock and clamped to [0,1] seconds; the existing simulation additionally
caps its own timestep at 0.1 seconds. `stop()` stops and saves once. The entrypoint
installs SIGINT/SIGTERM handlers. A forced process kill cannot run those handlers.

The world is closed over, never returned. Transport-facing access:

- `resolveKey(key)` returns a registered character ID or null.
- `enqueueIntent(characterId, intent)` returns null on admission, a reason on
  rejection. Admission is **not** action success. Pure harness validation happens
  before queueing, with the save schema's spell catalog constraint; the real
  `submitIntent` runs in the next serialized tick drain.
- Requests are copied on admission. The queue is bounded at 1024 entries. Multiple
  requests for one actor in a drain leave the last intent in its single slot.
- `observationFor(id)` and `obsHash(id)` use the existing harness projections.
  Unknown IDs throw. Observations do not expose mutable world references.
- `checkpoint()` returns the v6 save string for trusted diagnostics, not a client
  endpoint. `save()` writes it atomically. It contains all actors, not just one.

Every 300 host ticks and graceful shutdown write `shard-save.json.tmp` then rename.
The registry is also atomically replaced. A process crash can roll back up to the
last save; pending queue admissions are transient and are not durable receipts.
There is no multi-process writer lock: **one process per data directory**.
Invalid save bytes use the requested fresh-world fallback; the registry preserves
character IDs while missing bodies/sheets are recreated. Invalid registries fail
closed. Valid restores preserve actor sheets, positions, depletion, and tick.

Hydration mirrors `live.ts`'s `withFauna`, with parity coverage, without binding its
singleton or enabling god mode. `decodeSave` is the same decode/migration path as
`loadSave`, minus browser storage. No parallel save schema is introduced.

## WebSocket protocol

Send a JSON text `{type:"hello",apiKey,client?}` within five seconds. A valid key
gets `{type:"welcome",characterId,name,tick,observation}`. Then send
`{type:"intent",seq,intent:{kind,tx,ty,targetId,spell}}`; receive exactly one
`{type:"ack",seq,ok,reason?}` for queue admission. A well-shaped but invalid
intent gets a rejected ack; malformed JSON/schema gets `{type:"error",reason}`
and closes. Binary messages are rejected. Client bodyId/characterId fields,
including nested intent fields, never influence binding.

Each authoritative tick notifies transport (no polling). It sends
`{type:"obs",observation}` only when that character's hash differs. A duplicate
key closes the old socket with code 4000 / `replaced`; old-session cleanup cannot
clear the replacement's orders. Disconnect clears queued orders, intent and path,
but retains the body. Authenticated transport errors also clear its orders.
Payloads are capped at 64 KiB and slow peers with >2 MiB buffered are disconnected.
Use a TLS terminator for remote use; this listener alone is plain HTTP/WS.

`createTransport(shard).listen(0, "127.0.0.1")` supports ephemeral test ports;
`runMain({...shardConfig(env),port:0})` returns `ready: Promise<number>` and
`shutdown(): Promise<void>` for child harnesses. Environment PORT retains its
existing 1–65535 validation. Shutdown closes sockets before final persistence.

## Existing integration boundaries

- Approved harness dispatch now routes walk through actor-scoped `commandWalk`
  path planning before the sim moves it; transport never writes positions.
  Other work verbs retain the original intent-only behavior: walk within reach
  before issuing harvest/work. Ack is not a promise that routing/work succeeds.
- `hashObservation` includes tick, so it normally changes every active tick.
- Existing simulation randomness and retained solo-authority systems are not
  redesigned here. This is not an economic replay, chain settlement, or MMO-scale
  readiness claim.

Tests: `node --experimental-strip-types --test src/server/*.test.ts`.
The shutdown tests exercise real child processes with Node signal events because
Windows process termination does not deliver Unix signals to JavaScript handlers.
