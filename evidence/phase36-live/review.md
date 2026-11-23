# Phase 3.6 live evidence review

## Verdict: recorded economics/replay PASS; complete acceptance withheld

Fresh agent `reflex-proof-36-1795415115` ran revision `8a441d65ac6b15f462d96164f04acec22b4e7303` on local port 5594 for **954580 ms**, covering **24.002717078 vale hours** without manual intervention. Real paid Jev calls: **3**, total **$0.000954**. The measured enabled-time projection is **$0.08634750/agent/wall-day**, below $0.10. This is usage at recorded tariff, not an invoice or measured 24-hour bill.

All 8642 authoritative observations have matching survival samples. Both day and night were observed. Minimum HP 40; minimum hunger 24.986861; minimum energy 22.353479. Zero rejections, zero interventions, zero runtime errors. The unchanged $0.50 UTC-day guard never exhausted; final spend 954 micros and no outstanding reservation. Independent decision replay **3/3**, policy request replay **3/3**, no mismatches; verifier exit 0, no replay spending. Detailed triggers/actions and per-UTC-day accounting are in report.json.

**Unmet literal criterion:** water pressure is unproven. The pinned game has no thirst/drowning mechanic, and hunger/energy zero does not damage HP. The run demonstrates natural hunger decay and reflex response, not starvation/drowning survival. No fake danger, mutation, manual food grant, simulation slowdown, or director-presence override was introduced. Therefore the tool's `PASS_RECORDED_EVIDENCE` is not blanket product acceptance. **Phase 4 / fleet scale-up remains withheld** pending the validation child and explicit resolution of the water-pressure requirement. Do not silently waive it.

## Provenance and gates

- Integration merges scheduler e7f4203 and verifier 0acd991 over baseline 3f69fb9. Exact measured revision above; policy.json and report.json retain the full effective default config and source hashes.
- Paid entry uses approved Node key-loader pattern; no shell key assignment. Both preflight spend fences passed with zero provider calls. Fresh dedicated identity had no prior attempt history. Preflight-only host connections precede enabled time; no reconnect occurred during the proof.
- The local shard retained its ordinary startup inventory, 100-ms timer and elapsed clamp. Only the recorder's intent/verb path drove the character. Host shutdown follows the recorded stop and is excluded from the denominator.
- Full merged `PORT=5596 npm run check` passed: 571 script and 1613 source tests, lint, typecheck, build, auth. Exact worktree auth independently passed on 5595. The first full attempt failed an unrelated nondeterministic Brann/Kip fixture; unchanged targeted rerun and the complete r3 gate passed. Logs preserved locally; no fixture assertion was weakened.
- Recorder tests demonstrated RED (missing module), then GREEN for immutable samples, clocks, guard capture and redaction refusal. Art ledger refreshed after clean typecheck; test-generated placement and route-tree artifacts excluded.
- Raw artifacts remain gitignored. report.json hashes the exact raw envelope, trace, attempts, host log and orchestrator log; credentials/registry/save files are not published. No push, deploy or chain action.

## Next validation

`t_c9e75cb1` must independently inspect this revision, replay the retained raw envelope, confirm secrets exclusion, and explicitly resolve or fail the water-pressure criterion. If runtime policy changes, a new paid proof requires a new dedicated agent ID. Do not reuse this identity for another proof, extend the run after seeing its result, or label the short projection a 24-hour bill.
