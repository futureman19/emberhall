# Player visibility experiment — CLOSED / SHELVED

## Decision
The persistent-overlay lifecycle question is finished. Do NOT integrate or deploy this approach. Its diagnostic uses a full-scene extra depth pass, not the previously scoped-area optimization. Alpha-cutout material fidelity, production cost, full death/resurrection transitions and equipment-action coverage are not accepted. Lifecycle success alone does not justify release. This is a completed experiment and a shelved rendering proposal, NOT a shipped player-visibility feature.

Automatic next step: NONE. Generic heartbeat/continue instructions do not reopen this experiment. Reopen only for an explicitly changed goal or materially new evidence. Do not chain additional visibility diagnostics automatically. Broader Phase 2 art work is not declared complete by this decision.

## Actual evidence
- scripts/player-persistent-overlay-prototype.mjs: standalone browser-only module, never imported by the app. Reuses per-mesh overlays, refreshes world matrices before rendering, suppresses ghost/invisibility/hidden/absent source state, replaces stale material clones and disposes owned resources. Borrowed geometries are not disposed.
- scripts/player-persistent-lifecycle.mjs: desktop/mobile tavern approach on disposable local review save. No application source edits.
- Red control --red disables continuous matrix synchronization. 16 checks ran; exactly the desktop/mobile movement checks failed (3633 / 3717 mismatches). No page/shader errors.
- Green: 16/16 checks passed. Desktop 161 moving frames, mobile177; zero transform mismatches. Persistent copy reuse, ghost/invisibility/hidden/detached suppression, material replacement, resize plus idempotent cleanup passed. Suppressed and removed overlays matched underlying pixels exactly within frozen JS tasks.
- Ghost/invisibility tests mutate the actual QA world fields directly and render synchronously; NOT a full user death/resurrection/spell flow. Detached-source test is scene removal/readdition, NOT React route unmount acceptance. Material replacement test is synthetic source-material replacement, NOT all equipment gameplay acceptance.
- Screenshots reviewed on desktop/mobile: visible yellow location cue. Possible minimap noise/construction geometry anomalies were not compared against a same-frame baseline, so they are not attributed to this overlay and no whole-scene visual acceptance is claimed.
- Raw results: art/verification/civic/player-persistent-lifecycle-{red,green}/results.json; viewport screenshots alongside green results.
- npm run lint, npm run typecheck, npm run build passed after removing one unused harness variable. Build log: art/verification/civic/player-persistent-build.log. Test-suite log: art/verification/civic/player-persistent-tests.log (exact totals captured separately in acceptance JSON).

## Execution-loop correction
One bounded lifecycle question, one deliberately broken control, one corrected run, terminal SHELVED decision. No child delegation and no new follow-up experiment. The prior child was cancelled by gateway shutdown per telegram2 agent.log; restart initiator remains unknown. No gateway code/config fix is claimed. Profile-local frontend-runtime-visual-verification and hermes-agent skills now record closure and non-durable delegation handling.

Production and the previously deployed preview are unchanged by this batch. Existing source, generated-file changes and unrelated art evidence are preserved.
