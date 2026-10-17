# Godmode sandbox — local review candidate

## Use

Choose **Enter Godmode sandbox** on the title screen, or open Settings while playing and choose it there. Your current normal hall is saved before switching; a failed save prevents the switch. The sandbox uses its own world and save. Its status chip reads **GODMODE · Sandbox**. Settings provides **Replenish sandbox supplies** and **Return to normal hall**.

The current registries provide:

- 70 catalog items, at least 99 of each.
- 181 valid resource/form/quality stacks across 29 resource definitions, at least 999 of each.
- 25 skills at their actual base cap of 100. There is no aggregate skill cap: total skill only slows normal gain timing.
- All 38 implemented spells are available through the spellbook and stocked reagents; all 12 weapon techniques meet their skill thresholds. Ordinary weapon, target, range, mark, cooldown and reagent rules still apply.
- Full mana regeneration and 100,000 local game gold. This is **not invulnerability**. Placeholder skills do not acquire invented implementations. Crafted combinations can be made from the stocked materials; this does not enumerate every possible crafted/rare permutation.

The sandbox refills on load and through its replenish button. The normal save key remains `emberhall-save-v4`; the sandbox uses `emberhall-godmode-save-v1`. Persisted `sandbox: true` provenance routes writes independently of mutable mode flags, rejects cross-slot loading and blocks item/look/part inscription encoding. Normal live worlds do not gain skills or full-mana regeneration because another tab changes a flag. Vault rendering/opening, redeem preflight and wallet action entrypoints are also guarded. These are client-side product boundaries, not a new server-side anti-cheat system.

The existing `?god=1` selects the isolated sandbox rather than modifying the normal hall. The old enabled test-kit startup redirects into the sandbox before clearing or granting anything. `?god=0` selects normal play. The UI uses full navigation to dispose the prior session.

## Verification

Base: `af6c82614c5da0d3ef87d72ba2b7d92acd410cac`. Isolated worktree: `C:/Users/futur/Desktop/emberhall-godmode`, branch `feature/godmode`. No remote push or deployment.

- Tests-first: sandbox tests initially failed on the missing implementation; a later all-spell save regression failed on `thornsnare` before replacing the stale handwritten spell whitelist with `SPELL_META`.
- Targeted sandbox/save/Godmode tests passed. Tests cover registry completeness, caps, techniques, reagents, idempotent replenish, all armed spells serializing, cross-slot rejection, save failures, normal-world isolation and export rejection.
- Final `npm run check` exited 0: **482 script tests + 1,160 source tests**, zero failures; lint, typecheck, production build and auth invariant all passed. Log: `godmode-check-final.log`.
- Final lint after browser harness refinements also passed. Art ledger refreshed; test-generated placement and route-tree changes restored.
- `scripts/godmode-smoke.mjs` passed against dev and the built preview at 1280×844 and 390×844. Desktop clicks and mobile touch taps entered Godmode, verified every item/skill/resource stack, displayed every spell, successfully cast Night Sight, reloaded, returned to the original save, and activated again without contaminating normal inventory/skills. Fresh browser contexts only; no user's browser storage was used. Console and page errors: none.
- Evidence: `screenshots/godmode-dev/verdict.json`, `screenshots/godmode-built/verdict.json`, plus `1280/390-entry.png`, `1280/390-settings.png` and `1280/390-sandbox.png` in each directory. Final desktop/mobile screenshots were visually reviewed; mode status, entry, return and replenish controls fit without clipping/overlap.
- Standard `browser-smoke.mjs` passed dev/built comparison with no baseline divergence, overflow, console or page errors. Its Windows-inapplicable `/workspace` brand warnings were independently checked using `node scripts/brand-check.mjs --game --root C:/Users/futur/Desktop/emberhall-godmode`: exit 0, zero warnings. Artifacts: `screenshots/godmode-title-{dev,built}.json` and corresponding screenshots.
- Owned dev/preview servers stopped; ports 8080 and 8081 confirmed closed. Original worktree remained clean.

## Limits and diagnostic attempts

An optional exhaustive `gate:crafting` survey was attempted, but did not finish after more than ten minutes and was explicitly stopped, including its orphaned earlier timeout child. No recipe, material catalog, crafting formula or normal progression balance changed; this optional survey is **not claimed passed**. All crafting tests within the required full check passed.

Browser harness corrections: close the initial phone Guide before hitting Settings; compare preserved normal inventory/skills after re-entry rather than expecting ordinary simulation time to remain frozen. An initially overlapping absolute mode badge was replaced with an integrated status-chip row and visually rechecked. Background Windows harnesses use `node.exe` to avoid the shell's `node` TTY wrapper.
