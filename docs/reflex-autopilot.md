# Reflex autopilot (Phase 3)

A body run by reflexes alone: observation in → one bounded reflex decision → validated
intent into the sim's own pipeline. No planner, no human fallback — contract §4.

## Pieces

| Module | Role |
| --- | --- |
| `src/game/agent/events.ts` | Diffs consecutive pushed Observations into typed triggers (survival vs normal). |
| `src/game/agent/scheduler.ts` | Decides WHEN a body thinks: coalescing, dedupe, cooldown, concurrency bound, failure backoff, quiet window. Never touches a provider itself. |
| `src/game/agent/autopilot.ts` | The Thinker: builds the one-question ReflexExchange over the intent-mappable verb menu, submits the picked intent, writes the decision row. |
| `src/game/agent/stub.ts` | Deterministic offline backend. Zero cost, byte-stable for replay. The Jev API backend drops into the same `ReflexBackend` seam. |
| `src/game/agent/hostfeed.ts` | The host shell (src/server) as an `ObservationSource` + ack-resolved intent submit. |

## Enable / disable

Solo vale (dev driver): `createReflexAutopilot({})` with no `source` pulls one observation
per `step()` from the live world and submits through `submitIntent`.

Against a host shard:

```ts
const feed = await connectHostFeed({ url: "wss://<shard>", apiKey: <character key> });
const auto = createReflexAutopilot({ source: feed.source, submit: feed.submit });
auto.start();   // boots on the replayed welcome observation
auto.stop();    // unsubscribes the feed and stops the scheduler; start() then throws
```

`stop()` is terminal for the instance — create a fresh autopilot to re-engage.

## Cost seams (implemented by the cost/log infrastructure task)

- `hooks.authorize(req)` — pre-call budget gate. Runs after `prepare`, before `execute`;
  exactly once per real attempt. A denial consumes the trigger and records `denied`.
- `hooks.onAttemptStart(req)` / `hooks.onAttemptEnd(rec)` — per-attempt logging. Every
  authorized attempt ends exactly once: `ok` | `error` | `denied`, with wall-clock
  start/latency, the tick-inclusive replay hash, and the tick-independent dedupe digest.
- `hooks.onDecision(row)` — replaces the default in-memory DecisionLog append. This is
  where the durable writer plugs in.

A `prepare` that returns `null` (nothing worth a paid call, e.g. fewer than two
intent-mappable options) produces NO attempt: no reservation, no record, no provider
touch.

## What the scheduler will never do

- Poll. There are no timers; work only happens when a pushed observation derives an event.
- Re-ask an unchanged decision surface (tick-independent digest suppression).
- Exceed `maxConcurrentAttempts` (default 1) or fire more than one attempt per
  `reflexCooldownTicks` (contract §5 default 2).
- Burn on a dead backend: consecutive failures back off exponentially (capped), while
  survival triggers are retained and refire when the window passes.
- Think through the quiet window (22:00–06:00 default) for anything but danger.
