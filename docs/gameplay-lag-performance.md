# Bounded gameplay-lag pass

## Outcome

The measured avoidable GPU workload was unused terrain instance capacity. `hideRest` moved every unused instance underground and shrank it, but still submitted the full pool to the GPU. Replace that with a live-prefix `InstancedMesh.count`; retain allocated buffers and every live transform. Invalidate bounds so picking remains correct when a pool shrinks or grows. No quality settings, simulation timing, saves, foliage animation or visible art were removed.

This is a verified render-work reduction, **not proof that the user's particular phone lag is fixed**. The phone model, browser, save and exact lag symptom remain unknown.

## Built-browser comparison

Base: `5870d13343c8e93bd1f2358882c3a71b1b572fac` (routes-D_noUBvb.js).
Candidate built chunk: `routes-Dpfq2IzF.js`, SHA-256 `eb06cba369323d5242ce9ffb4f812a5b5b356757ccf6aa23590260b9d9ddaec1`.

Same seed 42, initial noon/storm, stationary town or repositioned dungeon entrance, normal speed and paused separately, isolated save, pinned browser RNG. Chromium D3D11, 8-second warmup then 12-second sampled window, CPU profiler enabled in both arms. No builds/tests running during measurement. Four scenarios per device in each build; 720–721 sampled frames each. These are seeded fixtures, not a user's existing save or a stress-test boss fight.

| Mode | Scene | Triangles before → after | Reduction | Calls before → after |
|---|---|---:|---:|---:|
| Phone defaults | Town | 3,837,133 → 2,269,613 | 40.85% | 246 → 244 |
| Phone defaults | Dungeon entrance | 1,749,318 → 147,682 | 91.56% | 47 → 43 |
| Desktop defaults | Town | 6,563,354 → 4,521,742 | 31.11% | 420 → 418 |
| Desktop defaults | Dungeon entrance | 2,405,766 → 300,134 | 87.52% | 100 → 95 |

Counts were identical between paused and running within each scenario. RAF p50 stayed 16.7 ms; p95 was 16.7 ms before and 16.7–16.8 ms after. This desktop GPU was already refresh-limited, so **no measured FPS gain is claimed**. Submitted triangles include shadow passes where enabled; these are renderer workload counts, not GPU elapsed-time measurements.

Mobile emulation: 390×844 CSS viewport, touch/coarse pointer, deviceScaleFactor 3. Actual drawing buffer 585×1266 (DPR capped at 1.5; 740,610 pixels). Fresh phone defaults already disable dynamic shadows and antialiasing and reduce horizon trees by 15%. Native touch toggling verified a saved shadows-on choice survives reload; it raises candidate town workload to 4,502,462 submitted triangles. Existing explicit preferences are intentionally preserved, not silently downgraded.

CPU profiling found scene matrix traversal as the largest named sampled JS hotspot, not a demonstrated simulation/subscription bottleneck. A small hidden-proxy CPU experiment was discarded; only the much larger, deterministic terrain instance-budget fix remains. No claim of improved CPU timings or touch input latency is made.

## Verification

- Real Three regression tests: live prefix, zero, shrink, regrowth, retained buffer/transforms and raycasts against refreshed bounds; 2/2 pass.
- `npm run check`: exit 0; lint, **497 script tests + 1258 source tests**, typecheck, production build and auth invariant all pass.
- Art ledger refreshed after typecheck; existing asset/state statuses unchanged. Only helper identity changed from `terrain.tsx#hideRest` to `instance-pool.ts#finishInstancePool`, plus source-line references. Test-generated placement report restored.
- Final built phone and desktop profiles: four scenarios each, zero page errors. Native touch settings/reload probe: zero page or console errors.
- Side-by-side phone screenshots: town trees, terrain, buildings, characters and dungeon entrance geometry retained. Rain streak positions differ; pre-existing dungeon rain remains visible in both arms.
- No deployment or push. Owned dev/preview processes are cleaned up after verification.

## Reproduction and local evidence

Run `npm run preview -- --host 127.0.0.1 --port 8097` after building; restart the owned preview whenever rebuilding. Then:

```
node --experimental-strip-types scripts/gameplay-lag-profile.mjs candidate mobile
node --experimental-strip-types scripts/gameplay-lag-profile.mjs candidate-desktop desktop
```

`EMBER_PERF_OUTPUT_DIR` overrides `screenshots/gameplay-lag`; optional `EMBER_PERF_GRAPHICS` supplies persisted graphics JSON. Harness uses a disposable browser context, never an existing player profile.

Evidence root on verification host: `C:/Users/futur/.hermes/profiles/telegram2/cache/scratch/`

- `ember-perf-mobile-before/report.json` and `ember-perf-baseline/report.json`: original built baselines, profiles/screenshots alongside.
- `ember-verified/mobile/report.json`, `ember-verified/desktop/report.json`: exact final candidate, profiles/screenshots alongside.
- `ember-performance-summary.json`: computed comparison.
- `ember-compare-town.png`, `ember-compare-dungeon.png`: side-by-side visual checks.
- `ember-settings-report.json`, `ember-mobile-settings.mjs`: native touch/default/persistence probe.
- `ember-perf-check-complete.log`: complete gate with `CHECK_EXIT=0`.

Earlier `after`, `mobile-after`, `mobile-final` and `mobile-draws` experiment directories are **not final evidence**. A diagnostic draw-callback attribution experiment was inconclusive and removed. A stale preview first caused a Continue timeout; restarting fixed it. The first foreground full-check attempt lost its parent shell at timeout; it was not accepted, and the entire gate was rerun as a tracked background job to exit 0. A combined profiling command reached its timeout after writing both complete final reports; both report counts/errors were independently validated, and the settings probe was subsequently run separately to exit 0.

## Self-audit / limitations

- **Incomplete work:** no physical-phone reproduction, publication or user-save investigation; parent decides publication.
- **Untested:** sustained thermal throttling, actual phone GPU timings, touch latency, moving-camera/boss stress and every possible saved-world density. Ask for model/browser and whether lag means stutters, low sustained frame rate, or delayed touch.
- **Pattern issues:** none found after reviewing all nine pool-finalization call sites; follows existing live-count patterns used by authored rocks, soft canopies and horizon batches.
- **Hidden concerns:** phone town workload remains 2.27 million submitted triangles; this optimization cannot guarantee sufficient performance on older devices. Saved shadows-on can nearly double that workload. The screenshot fixture retains existing heavy rain, including at the dungeon entrance.
- **Cleanup:** discarded CPU experiment removed; unrelated generated placement diff restored; no dependency or save-schema changes. Raw diagnostic artifacts remain only in the declared scratch directory.
