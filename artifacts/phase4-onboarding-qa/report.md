# Phase 4 independent onboarding QA — BLOCKED, gate NOT PASSED

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
