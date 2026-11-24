# Phase 4 runtime: operate and observe

This integration connects the director HTTP API to the authoritative shard and the Phase 3 metered reflex scheduler. It does not deploy a host or grant permission to spend provider funds. Beta billing remains free and is not consulted by activation.

## Host prerequisites

Run the persistent Node host, not a serverless web function:

```sh
node --experimental-strip-types src/server/main.ts
```

Provision the following through the operator's protected environment (never a committed `.env`):

- `EMBERHALL_DATA_DIR`: durable single-writer volume, retained across restarts.
- `PORT`: a free host port (default 8080).
- `EMBERHALL_KEYS`: set to an empty string for a director-only host, or provision independent protected legacy controller bindings; do not deploy the development defaults.
- `EMBERHALL_SECRET_KEY`: stable 32-byte operator encryption key encoded as 64 hex characters. Keep it outside the data volume; losing/changing it makes saved mind secrets and account retry tokens unrecoverable.
- `TYPESAFE_API_KEY`: authorized bundled reflex credential. Optional `TYPESAFE_BASE_URL` and `TYPESAFE_MODEL` follow the existing Phase 3 adapter. Missing credentials **reject activation**, never select a stub.
- `EMBERHALL_CONSOLE_ORIGINS`: comma-separated exact trusted browser origins.
- Optional `EMBERHALL_DEFAULT_MODEL`: explicit fallback when a connector omits its model.
- Development only: `EMBERHALL_MIND_PRIVATE_ORIGINS`, comma-separated exact origins, e.g. `http://127.0.0.1:11434`. This replaces the old blanket `EMBERHALL_ALLOW_PRIVATE_ENDPOINTS` switch. Metadata destinations remain blocked even when listed. Without this list, fetches require public HTTPS destinations, check all DNS answers, pin the actual connection, and forbid redirects.

Enable `/console` with `VITE_DIRECTOR_CONSOLE=true`. HTTP is now the default console mode; `VITE_CONSOLE_API=mock` explicitly selects a visibly labelled, non-live contract preview. For local Vite dev, `EMBERHALL_DIRECTOR_URL` proxies `/api/v1` to the Node host. A deployed web frontend requires an equivalent same-origin reverse proxy; the Vite proxy is not a production deployment configuration.

A hosted process cannot reach the owner's laptop through its own localhost. A local mind must have an operator-approved reachable endpoint (normally a public HTTPS tunnel). The URL is an API base such as `https://example.test/v1`; adapters append `/chat/completions`.

## Observe an unleashed character

1. Open the console, create a free account, retain the one-time owner token, create a character, choose a role, write a directive, and configure a model plus cloud key or local endpoint.
2. Unleash. The stable character ID is also its authoritative body ID. Repeated requests return the existing activation rather than adding a runtime or regranting the starting skills.
3. The console polls read-only status, not a controlling WebSocket. Closing it does not stop the agent. Role pack and manual are inserted once in each mind request; later role/directive revisions do not reset learned skills or assets.
4. Inspect authenticated `GET /api/v1/characters/:id/status` for `mindState`, `driver`, `runtimeState`, `reflexState`, `configRevision`, body HP/task and journal. `lastReflexTick` is a completed decision; **`lastAppliedActionTick` is an observed authoritative effect**, not queue admission. Those runtime counters are session-local, not durable history.
5. The append-only `director-decisions.jsonl` records decisions, and `director-reflex-attempts.jsonl` records metered provider attempts. The existing UTC-day guard is reconstructed from that attempt log on restart. Do not delete these logs to reset the spend cap.

The mind plans; the reflex layer is the sole action writer. A valid response marks the mind awake. Auth errors or invalid output are explicit degraded errors; fallback standing goals are not evidence of an awake mind.

### Sleep and wake

An initially unreachable configured local mind may unleash. After a failed exchange (at most two 20-second attempts), it is asleep with one system sleep entry. If reflexes are healthy the driver is `reflex`, runtime is `running`, and autonomous scheduling continues. Failed mind retries back off 1 minute, 5 minutes, then 15 minutes. These are generating requests where the adapter has no non-generating probe; they are not promised free.

There is no idle mind heartbeat: an awake endpoint going offline is discovered on the next real trigger (a directive/config revision or damage), not by constant polling. To observe this deliberately, stop the local endpoint and submit a new complete directive revision. Restore the endpoint and wait for the next backoff opportunity; the next validated response uses current observation/configuration, clears the sleep marker and appends one wake entry. Old responses after edit/recall cannot overwrite the new generation.

If bundled reflexes fail or hit budget, status says degraded/unavailable or budget-exhausted; the console must not claim instincts are keeping the character going. This is control continuity, not immortality or a guarantee that every role will sustain itself forever. Recall cancels queued/in-flight agent work but preserves the body and assets; it does not grant invulnerability.

### Restart and recovery

Graceful shutdown aborts runtimes, drains in-flight work, closes the attempt log/transport and saves the shard. Restart loads durable ownership/config/secrets and shard state before reconciling desired unleashed agents. Activation reuses a checkpointed orphan body if registry persistence was interrupted. Missing/corrupt director body checkpoints fail closed instead of silently cloning assets. Keep the entire data directory together and do not run two writers against it.

## Reproducible local verification

```sh
PORT=5587 node --experimental-strip-types --test --test-concurrency=1 \
  src/server/agent-runtime.test.ts src/server/runtime-lifecycle.test.ts \
  src/server/mind-egress.test.ts src/game/agent/mind-outcome.test.ts \
  src/lib/console-api.test.ts src/components/console/console-view.test.ts
```

These tests exercise real shard effects, real loopback local HTTP sleep/wake, cloud adapter credentials/model/prompt via injected responses, duplicate activation, restart, late-response fencing, malformed/auth outcomes, SSRF/abort/body limits, no-billing activation and console DTO translation.

Browser smoke uses the real HTTP director, real shard and runtime, but explicitly injects deterministic provider fixtures (no paid traffic):

```sh
VITE_DIRECTOR_CONSOLE=true EMBERHALL_DIRECTOR_URL=http://127.0.0.1:5591 npm run dev -- --port 5589
node --experimental-strip-types scripts/phase4-runtime-smoke.mjs
```

The script owns an isolated host on 5591, drives desktop cloud and emulated-mobile local creation/unleash/recall with native browser actions, verifies sleep/wake status and captures screenshots. External browser dependencies are fulfilled empty for offline isolation; this is not external-service certification. For built output, build with the same flags and start `npm run preview -- --port 5590`. Nitro preview does not honor the Vite API proxy: run the smoke with `SMOKE_URL=http://127.0.0.1:5592 SMOKE_UPSTREAM=http://127.0.0.1:5590 SMOKE_OUTPUT=screenshots/phase4-runtime-built`; it owns a loopback reverse proxy on 5592 for the built frontend plus director. This explicitly tests the deployment topology without changing the built assets.

**Acceptance boundary:** fixture-backed integration is not the five-minute live-provider onboarding gate or a new full-day survival proof. Those remain downstream QA on this exact integrated commit with explicitly authorized live prerequisites. Existing Phase 3 economics evidence is preserved, not regenerated or relabelled by this task.
