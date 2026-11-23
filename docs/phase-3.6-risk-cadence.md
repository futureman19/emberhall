# Phase 3.6: risk-gated paid admission

Implementation baseline: `3f69fb9` on `wt/t_166eb9f5` (contains `7c624d5` and `bbb570f`). Work is isolated in `.worktrees/t_f08f0691`, branch `wt/t_f08f0691`. No production/main integration, provider spend, push, deployment or chain action is part of this implementation handoff.

## Policy and configuration

`createHostReflex` → `createReflexAutopilot` → `createReflexScheduler` enables this by default. No launcher flag or director connection is required.

- `DEFAULT_SCHEDULER_CONFIG.riskGated = true`. `false` retains the old event-admission behavior solely as a legacy dispatch-test/compatibility seam; the production host does not set it.
- `idleHeartbeatTicks = 36000`: one nominal host hour since the last scheduling attempt. Any decision resets it. Tick progression, not an independent timer, drives admission; host stalls extend real elapsed time. Heartbeats work at night and on identical surfaces.
- `DEFAULT_CADENCE.reflexCooldownTicks = 150` is **unchanged**. No heartbeat cooldown is imposed on danger. At a continuously delivering 10 Hz host this bounds additional scheduler admission delay to 15 seconds. It does NOT bound provider/transport latency, missing observations, budget denial, or custom backoff/concurrency settings. It is not a promise that combat cannot kill within 15 seconds.
- Current-state hunger ≤25, HP ≤25% of maximum, or living non-owned engaged fauna within 8 tiles prompts a decision at the next slot, and retries while unresolved. Current-state checks work even when starting below a threshold. Ghost bodies do not generate endless low-HP/hunger reminders.
- Discrete HP loss, death/resurrection, hostile engagement/disengagement, hunger and energy warning/critical crossings, new loot piles, and initial boot are meaningful events. They bypass quiet-window and same-surface suppression. Energy crossings are 25/10, hunger warning/critical diagnostics 25/10. Low energy alone does not continuously re-trigger: the available idle action cannot restore it.
- Idle completion, weather, passive fauna/people arrivals, nightfall/daybreak, and ordinary numerical vitals drift are not paid events. They remain visible in observations. No actions are chosen or executed by this gate.
- Pending condition-based warnings are revalidated against each new observation and discarded after recovery. Discrete damage remains meaningful after healing. Existing single-flight/coalescing, retry backoff, mapping, wire compaction, full-observation replay hashing, and budget authorization remain in place.
- `settled()` now follows its documented contract: it waits for in-flight work, not cooldown-retained work that requires a future observation.

## Threshold derivation: actual mechanics, not assumed hazards

`src/game/catalog.ts` defines 36 simulation seconds per vale hour. `sim.ts:149–169` caps each real-dt step at 0.1, increments the host tick, and drains awake non-ghost hunger by 3.2/vale-hour and energy by 2.4/vale-hour. The shard ticks at 100 ms. Thus 150 normal ticks consume 1.333 hunger and 1 energy; hunger 25 has 281.25 nominal wall seconds to zero, energy 25 has 375 seconds. These are **depletion margins**, not death deadlines.

`player.ts:575–617` consumes real food immediately; bread adds 32 hunger, rations 60, cooked fish 38, raw fish 12, capped at 100. Starting food decisions at 25 provides headroom without regularly wasting a meal at full hunger. A failed/non-food choice keeps hunger risk armed rather than postponing it to an hourly heartbeat.

Important baseline limitations:

- Hunger and energy really drain, despite stale Phase 3 comments previously saying otherwise. Those comments are corrected.
- No starvation/exhaustion-to-HP damage, thirst meter, or general water drowning damage exists in this baseline. Water is nonwalkable (`pathfinding.ts:16–17`). Night changes encounters, not a general HP tax. Do not manufacture those hazards in tests or claim survival proves resistance to them.
- The offered `Rest / remain idle` is intent `none` (`autopilot.ts`), not sleep or energy regeneration. Paying every 15 seconds forever for low energy would be a cost bug with no restorative benefit.
- Actual threats include fauna attacks, poison (1 HP/0.08 vale-hour), and Emberdeep heat. At 36 seconds/hour, poison can tick every 2.88 seconds; the inherited 15-second bound is not universal combat safety. HP loss and engaged hostiles remain urgent; no survival guarantee is inferred from stocked-body tests.

## Economics: target, not a live acceptance claim

Phase 3.5 measured $0.012607 / 40 calls = $0.000315175/call on its workload. At that assumed price, $0.10 allows 317 calls per wall day. Hourly heartbeat alone is about $0.00756/day. Continuous 15-second danger calls would still cost about $1.8154/day and eventually encounter the unchanged $0.50 guard: safety takes priority over suppressing genuine risk for a good-looking bill.

At the nominal clock there are 100 vale days per wall day; the prior measured proof ran about 90.5. With enough stocked bread and one effective paid decision per meal, 3.2 * 24 * 100 / 32 = 240 food decisions/day, approximately $0.07564 before incidental events. This is conditional feasibility, not measured cost. Acquisition, unsuccessful choices, combat, startup frequency, token sizes and retries can exceed the target. Short first-day runs can undercount long-run food pressure because the body starts fed; report starting/ending hunger and inventory.

The implementation does not cap calls at an artificial $0.10 or silence risk once that target is approached. `budget.ts`, `metered.ts`, pricing and cost-day definitions are unchanged. The only hard guard remains $0.50 per agent per UTC wall day.

## Verification and downstream integration

Recovered verification completed on 2026-11-22: 40 focused tests pass; `PORT=5587 npm run check` exits 0 with 501 script tests and 1613 source tests, lint, typecheck, build and auth invariant passing. Log: `full-check-recovery.log` (local, ignored). The earlier `full-check.log` is preserved as a failed attempt: two legacy shard signal tests collided with an existing listener on default port 8080. A dedicated valid test port fixes the environment without changing tests; port 0 is rejected by shard configuration. Auth was additionally checked against this worktree's owned dev server on 5586; it agrees with the build (sign-in off). Owned dev listener was stopped and socket absence verified. Art inventory was refreshed after clean typecheck; generated placement and route-tree noise are excluded.

Behavioral RED was observed for the ambient-event test (65 calls instead of 1), missing heartbeat/night/startup/persistent-risk behavior, `settled()` waiting forever on retained work, and stale recovered-threshold calls. Existing dispatch-mechanics fixtures explicitly select the legacy admission mode; production-default tests exercise the new policy.

`risk-cadence.test.ts` covers idle/noise suppression, identical-surface and nighttime heartbeat, exact hunger threshold, unresolved retries, recovery, critical startup, engaged hostility, ghost suppression, energy crossing-only behavior, meaningful pile arrival, real metered UTC budget exhaustion/rollover, and actual tickWorld + commandEat across a full vale day. The latter is an isolated stocked body with fauna removed, seeded terrain, and a deterministic test thinker—not a real model or native gathering proof. It verifies water nonwalkability and night passage without inventing water damage. No credentials or external API are used.

Integrate the committed task branch into the fresh live-proof worktree based on `3f69fb9`, together with the independent accounting parent. Preserve production defaults (no `riskGated:false`, no shortened cooldown, no slowed clock). Refresh the art ledger on the integrated tree rather than accepting a conflicting older ledger. Run focused tests with:

```
node --experimental-strip-types --test src/game/agent/risk-cadence.test.ts src/game/agent/cadence-cost.test.ts src/game/agent/scheduler.test.ts src/game/agent/autopilot.test.ts src/game/agent/integration.test.ts
```

Then task `t_bd4459bd` owns fresh-agent paid full-day proof and independent replay; `t_c9e75cb1` owns final integrated gates. Neither live economics acceptance nor fleet readiness is established by this implementation. Require zero rejections/interventions, a never-exhausted guard, actual elapsed-wall-time projection ≤$0.10/day, and 100% replay. Keep failures visible and use a fresh agent ID for each paid proof.
