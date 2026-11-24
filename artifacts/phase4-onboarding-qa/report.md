# Phase 4 independent onboarding QA — BLOCKED, gate NOT PASSED

## Authorized live continuation — 2026-11-24 UTC

Candidate remains e126c89 on integrated 61e8ce5. Owner authorization and protected credentials were supplied; the previous absence-of-authorization blocker below is historical. Combined authorized cap: **$0.25**. No push/deploy or product source changes.

**Current blockers:** provisioned OpenAI credential returns **401 `invalid_api_key`** on read-only `/v1/models` discovery. Local endpoint lists its model but did **not** produce a validated mind exchange in the real integrated journey. No cloud generation was attempted. Do not mark Phase 4 passed.

### Real results, separate from fixtures

| Check | Result / exact scope |
|---|---|
| Protected setup | PASS: reflex/cloud/protection values present, stable protection key has valid 32-byte hex shape; values never printed or committed. |
| Live reflex prerequisite | PASS: real TypeSafe request HTTP 200; safe-action probability response decoded. |
| Cloud onboarding | BLOCKED: model discovery 401 `invalid_api_key` twice. No valid cloud model selected; no cloud journey timer or generation. |
| Local discovery | PASS discovery only: `/v1/models` HTTP 200, `huihui_ai/qwen3-abliterated:8b`; `/api/ps` reports model loaded with context length 4096. |
| Local fresh-account browser journey | Activation reached the real server, but acceptance condition was not reached during **290.2702165 seconds** from first create-account action. This is a bounded unsuccessful observation, NOT a successful under-five-minute onboarding time. No first-action latency was separately recorded. |
| Actual authoritative action | PASS limited: real TypeSafe decision at tick 70, applied action tick 71; cabbage count changed from 2 to 1. This is genuine provider-driven eating, not mere HTTP admission. |
| Mind connection | NOT PASSED: `lastMindExchangeTick=null`, mind asleep with `MIND_UNREACHABLE` at the observation deadline. Real local requests were sent; no completion was substituted. Local model performance/context/transport cause is not yet isolated. |
| Role/directive | PASS scoped: exact Ranger starting-skills map matches manifest; each captured outbound mind request includes the selected role pack exactly once and supplied directive. Delivery attempt is not model comprehension or a valid returned plan. |
| Billing | PASS activation scope: real free-account creation and unleash succeeded without payment/subscription. |
| Closed-console sleep continuity | NOT DEMONSTRATED: browser closed at tick 2695; after a further bounded 90-second window the applied-action marker remained 71. The mind had never first become awake, so this also does not exercise awake → asleep acceptance. Absence of a new action in this short risk-gated interval is not by itself a proven scheduler defect. |
| Full-vale-day self-sustaining behavior | UNVERIFIED; no full-day or surviving/sustaining claim. |
| Restart persistence | PASS in-process host reconstruction only: same persisted account/character, role, directive, unleashed lifecycle and body restored; exactly one owned character. A separate OS process restart and browser token-resume journey remain unverified. |
| Browser QA | Zero captured uncaught page errors. Screenshot inspection shows account-entry UI, not status UI, despite earlier native status locator success; likely reset/navigation needs focused reproduction. Do NOT treat this image as status or stable-render proof. Browser console errors were not collected by this live harness. |
| Redaction | PASS limited: exact protected credential scan of saved text evidence finds no matches. Real cloud-browser credential handling and all host logs remain unverified. |
| Invalid inputs/retries/idempotency | Prior 114/114 regression evidence below remains applicable; no new all-live matrix claim. |

### Spend and artifacts

Two real TypeSafe calls total: readiness probe and actual local-journey reflex decision. Provider-reported usage priced by the checked-in tariff totals **325 micro-USD ($0.000325)**, not an independently fetched invoice. No OpenAI generation. Conservative probe/run envelopes reserved $0.01 plus $0.005 actually admitted; local harness admitted at most 40 requests of <=64 KiB and reserves $0.005 per request, keeping its maximum plus probe below the owner cap. Follow-up paid runs must reconcile this ledger first.

Evidence: `live-prerequisites.json`, `live-reflex-attempts.jsonl`, `local-live-attempts.jsonl`, `local-live.json`, `live-verification.json`, `local-live.png`. Reusable opt-in scripts: `scripts/phase4-live-prerequisites.mjs` and `scripts/phase4-live-local.mjs`; both syntax checks pass and refuse accidental repetition over existing paid evidence. They read the authorized protected env path via `PHASE4_PROTECTED_ENV`, never a repository .env.

Harness/setup limitations: initial unpaid local run hit the disabled console route because a Windows npm descendant survived wrapper termination; its zero-provider-call failure is retained in `local-harness-failure.json`. The route was enabled and the owned stale process stopped before the real run. Final live command exceeded the tool's 420-second wait, but produced the complete JSON report; subsequent independent inspection found no live harness process and ports 5611–5613 closed. A successful command exit is not claimed. The owned Vite listener was also stopped. Shared Ollama was never stopped or reconfigured; sleep isolation used only a dedicated transparent forwarding endpoint owned by this run.

Next: securely replace/repair cloud credential; establish a local endpoint capable of completing the actual game prompt within runtime limits; reproduce the UI reset with stable browser evidence, then finish timed cloud/local awake journeys, real process restart and full-day closed-console continuity. No remaining budget is treated as permission to bypass those prerequisites.

---
## Historical no-cost checkpoint (before authorization)

Task: t_11629bc1. Candidate: 61e8ce5 (fast-forwarded from the assigned clean worktree; not stale main). Contract: docs/phase-4-contracts-v1.md, especially S1–S14. No push, deployment, provider generation, or new provider spend.

## Timing and acceptance

**Cloud onboarding elapsed: not measured. Local onboarding elapsed: not measured.** Neither clean-browser live-provider journey was started. The required clock starts at the first account action and ends after unleashed plus the first actual authoritative action, not the HTTP acknowledgment. No under-300-second claim is made.

Fresh automated regression: **114 passed, 0 failed**, Node v24.13.0, wall duration reported by runner **154019.0425 ms**. This is test-suite duration, NOT onboarding duration. Full output: regression.tap. Existing focused coverage was rerun rather than duplicating already-present test cases. New reusable read-only prerequisite check: scripts/phase4-onboarding-preflight.mjs; syntax check passed, execution returned expected exit 2 and wrote preflight.json.

## Live prerequisites — checked, not assumed

- TYPESAFE_API_KEY absent from this worker's environment; bundled reflex live service not verified in this run. The integrated missing-configuration regression confirms activation refuses rather than substituting a stub.
- No fresh provider-spend authorization. Manager explicitly requires owner approval for any new paid run, including bundled reflex calls even if the mind itself is local. Older Phase 3 authorization is not reused.
- OPENAI_API_KEY absent from this environment; no approved cloud key/model supplied to this run. This does not assert that no credentials exist in protected stores elsewhere. No secret files searched or printed.
- EMBERHALL_SECRET_KEY absent. A stable protected 32-byte key must be provisioned and retained for restart verification. This is operator setup, not part of an ordinary player's five-minute journey.
- **Local endpoint discovery succeeds:** read-only GET http://127.0.0.1:11434/v1/models returned HTTP 200 with huihui_ai/qwen3-abliterated:8b. No generation was requested. Listing is not proof that the model returns valid game plans. The service was not stopped or modified.
- EMBERHALL_MIND_PRIVATE_ORIGINS absent. Same-machine testing needs exact origin http://127.0.0.1:11434 allowlisted; a remotely hosted shard instead needs a reachable approved endpoint, not its own localhost.
- Role manifest and authored packs are present in the integrated candidate. Persistent single-writer data directory, stable operator key, authorized metered reflex configuration, enabled /console, same-origin API routing and an approved cloud configuration must be prepared before starting the stopwatch.
- No worktree node_modules directory. Tests resolved existing ancestor dependencies and executed successfully; no package install or dependency mutation performed.

## Explicit scenario verdicts

PASS below is limited to the stated automated scope. BLOCKED / UNVERIFIED are not passes.

| Scenario | Fresh result and boundary |
|---|---|
| S1 cloud zero → first action under 300s | **BLOCKED**: no approved cloud configuration or reflex spend authorization. No browser timer. |
| S2 local awake → endpoint off + console closed → continued legal actions for a vale day | **BLOCKED live**. Real-shard deterministic-reflex/local-HTTP fixture sleep/wake test PASS; no real-model day or closed-browser day proof here. |
| S3 persistence / crash boundaries | **PASS scoped**: restart preserves accounts, characters, bodies, skills and journal; interrupted world-save-before-registry recovery preserves one body/no skill reset. **UNVERIFIED**: every activation write boundary and live-process restart journey. |
| S4 ownership | **PASS automated**: foreign owner 404 routes, invalid token/client mappings and real HTTP lifecycle suite. Read-only observer end-to-end action denial not independently exercised in this run. |
| S5 redaction | **PASS automated**: protected storage, hint-only reads, keyless protection refusal, provider error sanitization, browser-storage/controller guards. **UNVERIFIED**: live-browser capture plus real provider/host logs. |
| S6 idempotency/revisions/late callbacks | **PASS automated**: account replay/conflict, stale revision, repeated unleash/recall and late-response fencing. No independent concurrent live-browser run. |
| S7 invalid inputs | **PASS automated**: draft/readiness, name/directive, closed-key config/model/provider/URL validation and DNS/redirect/body limits. |
| S8 retries | **PASS automated**: 503 preserves nonsecret form, clears key, requires honest reentry where needed; retry succeeds; stale revision reload. |
| S9 no billing gate | **PASS automated**: beta-free creation, readiness ignores billing, source/UI guards and fixture-backed runtime activation. Live activation not attempted. |
| S10 role/directive injection | **PASS scoped**: role skill grants once, existing bodies never regranted, cloud request contains selected pack once and newest directive, latest observation fencing. Every role across a live restart not verified. |
| S11 initially offline local | **PASS fixture-backed real shard** with deterministic reflex provider, not live reflex acceptance. |
| S12 wake/latest revision | **PASS fixture-backed**: actual loopback HTTP wake, latest directive and no stale completion; malformed/auth responses not awake. |
| S13 reflex unavailable / budget denied | **PASS automated**: degraded truth/no substitute, missing bundle rejects activation, UI does not show healthy autopilot. |
| S14 recall and independent lifetime | **PASS scoped**: pending callback fence, abort, body preservation, no idle model polling. Console-closed live autonomous continuity remains unverified. |

## Autonomous activity evidence

regression.tap includes `real shard: offline local unleash, actual reflex actions, wake latest revision, recall and restart` PASS and `activation recovery after world-save before registry write does not duplicate body or reset skills` PASS. These execute authoritative shard behavior, but their providers are fixtures. They are NOT ongoing live-provider self-sustaining evidence. No live activity counters, survival duration or fabricated journal are presented.

Upstream integration reports desktop/mobile built-browser fixture QA and full gates at 61e8ce5. Those are inherited evidence, not freshly rerun or relabelled here. Prior Phase 3 economics evidence is unchanged. Water-survival follow-up t_086e14fb is not the blocker for this card.

## Reproduce safe verification

```sh
node scripts/phase4-onboarding-preflight.mjs http://127.0.0.1:11434/v1
# Expected exit 2: this non-generating check cannot certify live acceptance.
node --experimental-strip-types --test --test-concurrency=1 src/server/agent-runtime.test.ts src/server/runtime-lifecycle.test.ts src/server/accounts.test.ts src/server/mind-egress.test.ts src/game/agent/account.test.ts src/game/agent/mind-outcome.test.ts src/lib/console-api.test.ts src/components/console/console-flow.test.ts src/components/console/console-view.test.ts
```

## Required unblock

Manager/owner must approve a bounded live-provider budget and supply an authorized reflex credential plus cloud mind configuration through protected provisioning (not chat). Provision a persistent isolated host and stable encryption key. Confirm exclusive permission to stop/restart the selected local model endpoint, or use a dedicated instance so other users are not interrupted. Then resume this exact candidate: time both fresh browser journeys, collect actual applied-action ticks/body effects, observe local sleep with console closed for the required vale day, restart host, and complete the remaining live matrix. Do not release Phase 4 until those criteria are met.
