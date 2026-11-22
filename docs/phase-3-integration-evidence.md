# Phase 3 integration: local evidence and live gate status

Task `t_166eb9f5`, recovered on `wt/t_166eb9f5` in `C:/Users/futur/Desktop/emberhall/.worktrees/t_166eb9f5`. The board's BoxSV workspace is incorrect and was not edited. Parent merges are present at `35bf59d` (Jev, scheduler, accounting).

## Acceptance status — LIVE RUN 2026-11-22 (measured gates PASS; scale-up withheld)

Live paid acceptance executed 2026-11-22 23:15–23:31 UTC on a dedicated local shard (port 5590,
fresh data dir), character `reflex-proof` / agent `reflex-proof-qwen`, `jev-1.14.0`, reflex-only.
Full reviewer verdict: `evidence/phase3-live/review.md`; recorder output: `evidence/phase3-live/report.json`.

| Required live evidence | Result |
|---|---|
| Run configuration | One dedicated character, real Jev `jev-1.14.0`, no mind/planner/manual fallback; preflight passed before paid start |
| Live duration | 955,271 ms wall; sim hour 8.0139 → 32.0166 (24.003 sim hours), reason `full-vale-day` |
| Full-day survival | **PASS** — died=false, 8,642 samples, final hp=40, never ghost |
| Live provider attempts / retries | 612 attempts: 611 ok, 1 budget-blocked, 0 error/timeout/interrupted; retries 0; independent replay 611/611 match |
| Live DecisionLog | `evidence/phase3-live/decisions.jsonl` (9,253 rows) + `attempts.jsonl` (612 rows) |
| Per-agent daily live spend | **$0.499904** measured, UTC day 2026-11-22; estimatedAttempts=0 (all usage reported) |
| ≤ $0.50 per-agent/day acceptance | **PASS on measured evidence** (independent cost report gate PASS) |
| Host execution rejections / interventions | rejected=0; no operator interventions |
| Scale-up economics | **WITHHELD** — budget exhausted at t+277s (~4.6 min); remaining ~11.3 min of the vale day ran budget-forced idle (survival held). Sustained-cadence projection $45.21/agent/day ≈ 90× over the pivot's ≪$0.50/agent/day rule. Projection is labeled, NOT a measured wall-day pass. Reflex cadence/prompt-size reduction required before Phase 4 fleet operation (follow-up card seeded). |

No deployment, remote push, wallet/chain action, credential change, or model-routing change was performed. Local fake-provider tests are **not** survival or live cost evidence; the live gates above rest on the real paid run only.

## Verified integration

- `reflex-runtime.ts:createHostReflex` explicitly composes host push feed → event scheduler/autopilot → metered adapter → Jev. There is no production stub fallback in this factory.
- `metered.ts` constructs Jev itself with `maxRetries: 0`, overriding supplied backend retry settings. Adapter retries individually authorize, fsync a begin record, call HTTP, fsync an end, and settle. A test supplying five internal retries still sees exactly three authorized HTTP attempts and three begin/end pairs.
- Budget denial between attempts prevents the next HTTP request. Guard checks are synchronous. Missing/invalid usage is estimated, never refunded; malformed numeric amounts/prices fail closed. End-write failure settles known cost and closes the guard; begin-write failure sends nothing, voids its hold, and closes the guard. Original hold and price survive interrupted-call restoration.
- Strict/shallow replay rejects incomplete successful rows, duplicate answers, malformed probability vectors and missing action digests.
- Real **local** shard + WebSocket transport + Jev protocol adapter + durable attempt log executed pack food consumption with a fake HTTP response. This uncovered and fixed the nested verb wire envelope and duplicate menu labels. It establishes the local host prerequisite, not remote production readiness.
- Pack eating and stop/idle are executable choices, with food/rest slots reserved at the menu cap. Stop fences late provider responses from action submission. Idle is the existing `none` intent; it is not a new sleep command. Bank/craft UI flows are still excluded rather than fabricated as intents; long-term self-sustaining behavior is not claimed.
- The scheduler has no interval/timeout polling. Host observations arrive via WS; retry delays and transport deadlines are bounded timers, not periodic provider calls. Existing cadence regressions cover idle silence, bursts, cooldown, survival triggers and stop/unsubscribe. A source regression ensures the sole production Jev construction in the agent directory is the metered adapter.

## Price basis and honest normalization

Public source `https://docs.typesafe.ai/models` fetched on 2026-11-22 confirms `jev-1.14.0`: **$0.042 per million input tokens; output tokens free**. The recorder pins this model, not `jev-latest`. This is the public rate, not an account invoice; no discounts are assumed. Integer micro-USD costs round upward per attempt. Missing usage remains explicitly estimated and cannot establish exact billed spend.

The guard's locked cost day is a **UTC wall-clock calendar day**, independent of simulation time. The recorder also reports elapsed wall milliseconds, authoritative start/end sim hours, full attempt counts and UTC spend rows. `spend × 86,400,000 / elapsedMs` is an explicitly labeled **projection** of sustained wall-day cadence, not a measured 24-hour invoice. Never label a short or accelerated vale-day sample a measured wall-day pass. Review UTC rows and this distinction before authorizing scale-up. The estimate-based pre-call reservation can overshoot by one in-flight usage delta; post-call accounting exposes that breach rather than claiming an absolute provider billing ceiling.

## Enable / disable (only after spending authorization)

Default behavior is unchanged: neither solo client nor shard automatically starts a paid reflex loop. The new opt-in recorder is `scripts/reflex-live-proof.ts`.

1. Use one dedicated, authorized host character, with no human or planner controller. Independently verify the intended host and capture its runtime log. Do not use another player's key: the host replaces an existing controlling socket for that character.
2. Supply `TYPESAFE_API_KEY`, `EMBERHALL_REFLEX_WS`, `EMBERHALL_REFLEX_CHARACTER_KEY`, and `EMBERHALL_REFLEX_AGENT_ID` privately in the runner environment. Never put credentials in commands, reports, screenshots or git. `TYPESAFE_MODEL` must be absent or exactly `jev-1.14.0`.
3. Only after approval, set `EMBERHALL_REFLEX_PAID_APPROVED=1` and run:

   ```text
   node --experimental-strip-types scripts/reflex-live-proof.ts evidence/phase3-live
   ```

   This records a full 24-sim-hour attempt, death, operator stop, or four-hour watchdog termination. It does not advance ticks, seed supplies, reposition bodies, select fake answers or inject a mind. The host owns its real clock. `attempts.jsonl` persists every authorized call/retry; `decisions.jsonl` persists chosen actions and pushed survival samples; `report.json` retains the result. The proof recorder deliberately leaves final cost acceptance for review.
4. Stop with SIGINT/SIGTERM. The loop unsubscribes and fences late action submission, waits for bounded in-flight accounting, then disconnects. Removing the approval environment value disables future starts. The preflight test proves missing approval exits before opening a host connection or calling a provider.
5. Preserve the same attempts file for budget restoration after restart. A `runner.lock` prevents concurrent writers in that directory; after a crash, inspect the old process/log before removing it. **Do not use a new directory to reset an agent's same-day budget.** The local factory requires one shared guard per shard/accounting owner; it is not a distributed billing service. Other processes/directories are not coordinated by this lock.

Offline tools (no provider calls):

```text
node --experimental-strip-types scripts/agent-cost-replay.ts evidence/phase3-live/attempts.jsonl
node --experimental-strip-types scripts/agent-cost-report.ts evidence/phase3-live/attempts.jsonl
```

Capture host execution refusals too: an `ack` is queue admission, not successful simulation execution. No zero-rejection live claim has been made.

## Reproduce local verification

```text
node --experimental-strip-types --test src/game/agent/integration.test.ts src/game/agent/accounting-safety.test.ts src/game/agent/replay-safety.test.ts src/game/agent/cost.test.ts src/game/agent/jev.test.ts src/game/agent/autopilot.test.ts src/game/agent/scheduler.test.ts src/game/agent/hostfeed.test.ts
node --test scripts/reflex-live-proof.test.mjs scripts/audit-safety-test-registration.test.mjs
npx tsc --noEmit
npx eslint src/game/agent/ src/game/player.ts scripts/reflex-live-proof.ts scripts/reflex-live-proof.test.mjs --max-warnings 0
npm test
```

Focused fake HTTP responses test accounting mechanics only. Fresh execution outputs are saved under `evidence/phase3-local/`; final gate counts, hashes and exclusions are recorded in `verification.json`. Real-paid acceptance completed 2026-11-22 (see status table above and `evidence/phase3-live/review.md`); measured gates pass, scale-up economics withheld pending reflex cost reduction.

### Recovery verification results

- Focused agent suites: **105/105**, exit 0 (`focused-recovery.log`).
- Full `npm test`: **500 script + 1599 source tests**, no failures, exit 0 (`npm-test-bounded.log`). One additional source-text recorder guard test was added after this run began; the final preflight/registration rerun passes **4/4** (`final-static.log`). This guard check is static, not a live survival proof.
- Full zero-warning lint, TypeScript, art audit and production build: exit 0. Build explicitly cleared `DATABASE_URL` so no remote migrations ran. Auth invariant against the owned local dev server at port 5529: sign-in off on both sides; server stopped and no listening socket remained.
- Ledger refresh preserves existing asset approval statuses and loses no non-inventoried asset. Generated placement and route-tree files have no semantic diff and are excluded from commits.
- `npm-test-recovery.log` is an interrupted foreground run, **not** a passing suite; previous pricing-assertion failure logs are superseded. The tracked background full run has an explicit `EXIT_CODE=0`.
- Recorder now refuses an initially dead/ghost body before starting the provider runtime. Historical-log restarts suppress the wall-day projection rather than dividing accumulated historical spend by the new run duration; retain the same log directory for budget continuity.
- Local-only integration; no push or deployment. The unrelated inherited proof-script lint cleanups are isolated in a separate commit.
