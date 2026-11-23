# Phase 3.6 independent final validation

## Verdict: FAIL / INCOMPLETE acceptance; repository gate PASS

**Phase 4 and fleet scale-up remain withheld.** This card completes validation, not product acceptance. The literal water-pressure criterion is unproven. No thirst/drowning mechanic exists in the pinned baseline; hunger/energy decay does not damage HP at zero. Adding those mechanics or waiving that criterion requires an explicit product decision, not a silent validation fix.

The root card's **wall-day projection** requirement passes. The validation card's literal **measured always-on wall-day cost** is not established: the enabled interval is 954580 ms, not 24 wall hours. The $0.08634750/agent/wall-day figure is measured usage at the recorded tariff extrapolated to a wall day, not a measured 24-hour bill, invoice reconciliation, or assurance of long-run sustained behavior with depleted food.

## Exact revisions and scope

- Tested integrated candidate: `6efe2cc0ccfc6720a84058e78f1e27d32c462412`.
- Fresh live-proven runtime: `8a441d65ac6b15f462d96164f04acec22b4e7303`.
- Validation branch/worktree: `wt/t_c9e75cb1`, `C:/Users/futur/Desktop/emberhall/.worktrees/t_c9e75cb1`.
- `git diff 8a441d65 HEAD -- src scripts package.json package-lock.json` was empty. The candidate adds only four sanitized evidence files over the live revision. This validation adds only this document and `validation.json`; no runtime, policy, economics, tests or assertions changed.
- No push, deploy, chain operation, paid provider call, or fleet action was performed in this validation.

## Fresh full repository gate

`PORT=5598 npm run check` completed with process exit **0** and `FULL_CHECK_EXIT=0` in `phase36-validation-check.log`:

```text
> eslint . --max-warnings 0
script tests: 571 passed, 0 failed
source tests: 1613 passed, 0 failed
> tsc --noEmit
build: completed
[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).
[auth-invariant] dev and build agree: sign-in off
FULL_CHECK_EXIT=0
```

The script's default auth probe uses the existing 8080 server. Separately, `node scripts/check-auth-invariant.mjs --dev-url http://127.0.0.1:5597` passed against this exact worktree's owned dev server. Shard tests used isolated PORT=5598. Both owned ports were confirmed free after cleanup; the surviving owned Vite child was stopped explicitly after shell termination.

Before the gate, `npx tsc --noEmit` passed, then `node scripts/audit-art-coverage.mjs --refresh` reported no errors and **no content diff**: 5428 assets, 8212 states, 296 source files. The existing ledger line pins are current; no ledger commit is necessary. The flat ESLint config excludes `.worktrees/**`. An ignored local Three junction supplied the literal test import without changing dependencies. Test/build-generated ledger/placement/route-tree working-copy churn was excluded/restored after stopping the server. No test rerun or assertion weakening was needed.

## Independent evidence checks

- Reran `scripts/phase36-verify.mjs` on the parent's retained `evidence/phase36-live/raw/run.json` using the candidate's verifier: **exit 0**, decisions **3/3**, policy requests **3/3**, zero mismatches and zero replay spending.
- Independently hashed all five listed raw files and all four provenance files: all matched the committed report. Compared all JSONL trace rows with the envelope, and bound each append-only attempt's identity, timestamps, usage, cost, raw provider weights and state hash to its corresponding call/decision: all matched.
- Inspected the private registry without publishing keys: one dedicated character, matching agent/body IDs, created before activation. Start spend was zero; retained append-only history contains exactly three begin/end pairs. The recorder refuses an existing attempts file. This supports fresh proof provenance; it is not a global audit of every possible credential use.
- Observed 8642 matching survival/observation samples, maximum sample gap 135 ms, 24.002717077771305 vale hours and both day/night. Minimum HP 40. Natural hunger crossed its low threshold; the host logged cabbage consumption, and cabbage fell from two to one. Ordinary startup food was retained; no artificial danger or manual food grant was introduced.
- Zero recorded rejections, interventions and runtime errors. Three host acknowledgments were successful. Inspected orchestrator and host logs show no manual gameplay or mid-run reconnect. These local records cannot prove the absence of an omitted external action.
- The guard stayed open at every sample with the unchanged $0.50 UTC-day cap; final spend 954 micros, final reservation zero. Three real paid calls cost $0.000954. Arithmetic uses actual enabled milliseconds and excludes shutdown, not a fixed vale-day multiplier.
- Policy replay is an independent offline driver of the pinned production scheduler, **not a separately implemented scheduler**. Decision mapping and usage arithmetic are separately reconstructed.

## Publication safety and retained evidence

Raw files remain in the parent worktree's ignored `evidence/phase36-live/raw/`; none are tracked. `git check-ignore -v` confirms `.gitignore:35` covers the envelope, private character and shard registry. Known local credential-value comparisons plus private-key/Bearer/API-key pattern checks found no hits in the sanitized Phase 3.6 evidence. This is a bounded scan, not a universal guarantee.

`validation.json` records machine-readable gate results, replay results, exact revisions, metric provenance and SHA-256 hashes of the retained local validation logs. Raw logs and credentials must not be committed or attached.

## Required next decision

The controller must resolve the absent water-pressure criterion explicitly. Keep Phase 4 withheld while it is unresolved. If new runtime behavior or economics are introduced, require a new fresh-agent live proof and rerun the full gate; the old proof cannot accept changed behavior. If a literal measured wall-day test is required rather than the root's projection contract, that is also outstanding. Do not infer authorization to spend, deploy or scale from this validation completion.
