# Phase 3.6 verifier validation (t_17d35f35)

Scope: offline tools and recorder contract only, based on `3f69fb9` (contains
`7c624d5` and `bbb570f`). No scheduler, game, server or chain implementation edits;
no provider calls, push or deploy. The fresh live proof and merged risk-policy
acceptance belong to downstream tasks, not this tools validation.

## Executed checks

- Recovery RED: 67/68 verifier tests passed; the pending coverage test failed
  against the unfinished `verifyCoverage` stub.
- GREEN: `node --experimental-strip-types --test scripts/phase36-*.test.mjs
  scripts/audit-safety-test-registration.test.mjs` — 69/69 passed (68 verifier,
  one registration). Covers measured projection units, exact $0.10 boundary and
  over-threshold failure, incomplete evidence, shutdown exclusion, forced idle,
  malformed/changed decisions, missing policy outputs and observation timing.
- `npx eslint scripts/phase36-*.mjs --max-warnings 0` and `npx tsc --noEmit` — exit 0.
- `PORT=5537 npm run check` — exit 0: lint, 569 script tests, 1603 source tests,
  typecheck, production build and auth invariant. Local ignored log:
  `phase36-check-r3.log`, terminal marker `CHECK_EXIT=0`.
- Exact-worktree auth probe: `node scripts/check-auth-invariant.mjs --dev-url
  http://127.0.0.1:5536` — sign-in off agrees with build. The standard full gate
  also checks the existing baseline dev host on 8080; it was not modified.
- `git check-ignore evidence/phase36-live/raw/run.json
  evidence/phase36-live/attempts.jsonl` — both ignored.
- CLI against legacy `evidence/phase35-live/report.json` — exit 1, correctly
  refusing a summary without the new reproducible evidence envelope.

## Environment failures retained, not hidden

The first full check had 568/569 script passes: terrain-palette's literal local
Three URL could not resolve in this sparse worktree. An ignored local
`node_modules/three` junction to the existing installed Three fixed it; targeted
terrain-palette passed without changing dependencies or source.

The second full check passed all 569 script tests and 1601/1603 source tests.
The two shard signal tests tried port 8080, already held by the baseline dev host.
They pass with `PORT=5537`; the entire third check then passed with that setting.
`PORT=0` is invalid for shardConfig and was not used for the successful gate.
No other lane's server was stopped. Generated line-ending-only placement/route
files are excluded from the deliverable.

## Baseline arithmetic, not a new live run

Recomputed with projectEconomics from the historical Phase 3.5 report:

- Observed usage-at-tariff spend: $0.012607 over 954804 ms.
- Covered vale hours: report.lastHour minus report.startHour.
- USD/agent/wall-day: **1.140804604924152**, thresholdPass **false**.
- USD/vale-day: **0.012605541025347685**.
- Measured vale-days/wall-day: **90.50024926579353**, not a hard-coded multiplier.

This arithmetic does not make the old summary sufficient Phase 3.6 evidence.
The combined gate intentionally rejects this baseline's non-risk defaults.
Integrate the scheduler parent, record the merged fingerprint, collect a fresh
complete trace with the documented live harness wrappers, and run the verifier.
Decision reconstruction is separate code; policy replay is an independent offline
driver of pinned production policy, not a second scheduler implementation.
Usage-derived cost at a captured tariff is not an independently reconciled bill.
