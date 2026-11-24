/**
 * Traceable per-agent per-wall-day cost projection refresh (t_0d13c23d).
 * Reads the recorded Phase 3.6 paid baseline and the zero-paid water-survival
 * proof, reproduces the Phase 3.6 arithmetic, and computes a refreshed
 * paid-equivalent projection from the water run's observed attempt cadence.
 * No provider calls; pure arithmetic over recorded artifacts.
 *
 *   node --experimental-strip-types scripts/water-survival-cost-projection.mjs \
 *     [--phase36-report <path>] [--phase36-raw <path>] [--water-report <path>] \
 *     [--out evidence/water-survival-replay-check]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const root = resolve(arg("--root", process.cwd()));
const p36ReportPath = resolve(arg("--phase36-report", "C:/Users/futur/Desktop/emberhall/evidence/phase36-live/report.json"));
const p36RawPath = resolve(arg("--phase36-raw", "C:/Users/futur/Desktop/emberhall/.worktrees/t_bd4459bd/evidence/phase36-live/raw/run.json"));
const waterReportPath = resolve(root, arg("--water-report", "evidence/water-survival-live/report.json"));
const outDir = resolve(root, arg("--out", "evidence/water-survival-replay-check"));
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const WALL_DAY_MS = 86_400_000;

const p36 = readJson(p36ReportPath);
const p36raw = readJson(p36RawPath);
const water = readJson(waterReportPath);
const m = p36.metrics;
const tariff = p36raw.calls[0].price;

// ---- Phase 3.6 paid baseline reproduction ----------------------------------
const p36enabledWallMs = m.enabledWallMs;
const p36segWallMs = p36raw.segments.filter((s) => s.mode === "enabled").reduce((a, s) => a + (s.endMs - s.startMs), 0);
const p36costMicros = m.costMicros;
const p36rawMicros = p36raw.calls.reduce((a, c) => a + c.costMicros, 0);
const p36prompt = m.promptTokens, p36completion = m.completionTokens, p36calls = m.paidCalls;
const p36observedUsd = p36costMicros / 1e6;
const p36usdPerAgentWallDay = p36observedUsd * WALL_DAY_MS / p36enabledWallMs;
const p36valeDays = m.valeHours / 24;
const p36usdPerValeDay = p36observedUsd / p36valeDays;
const p36valeDaysPerWallDay = WALL_DAY_MS / p36enabledWallMs * p36valeDays;
const perCallCeil = p36raw.calls.map((c) => ({ id: c.id, promptTokens: c.usage.promptTokens, exactMicros: c.usage.promptTokens * tariff.promptPerMTok, recordedMicros: c.costMicros, ceilMicros: Math.ceil(c.usage.promptTokens * tariff.promptPerMTok) }));
const meanPromptPerAttempt = p36prompt / p36calls;
const meanCostMicrosPerAttempt = p36costMicros / p36calls;
const baselineRecorded = m.economics.usdPerAgentWallDay;
const baselineReproduced = Math.abs(p36usdPerAgentWallDay - baselineRecorded) < 1e-12;

// ---- Water-survival zero-paid observed -------------------------------------
const wSeg = water.segments.find((s) => s.mode === "enabled");
const wEnabledWallMs = wSeg.endMs - wSeg.startMs;
const wWallSeconds = water.duration.wallSeconds;
const wValeHours = water.duration.simHours;
const wValeDays = wValeHours / 24;
const wAttempts = water.counts.attempts;
const wObservedUsd = water.cost.totalCostMicros / 1e6; // 0
const wDirectUsdPerAgentWallDay = wObservedUsd * WALL_DAY_MS / wEnabledWallMs; // 0
const wAttemptsPerEnabledWallDay = wAttempts * WALL_DAY_MS / wEnabledWallMs;
const wAttemptsPerValeDay = wAttempts / wValeDays;
const wValeDaysPerWallDay = WALL_DAY_MS / wEnabledWallMs * wValeDays;
const wAttemptsPerWallHour = wAttempts / (wWallSeconds / 3600);

// ---- Refreshed paid-equivalent projection (HYPOTHETICAL, not measured) -----
// Applies the recorded Phase 3.6 tariff and per-attempt usage to the water
// run's observed attempt cadence. The water run itself made ZERO paid calls.
const paidEquivViaMeanCostUsdPerWallDay = wAttemptsPerEnabledWallDay * meanCostMicrosPerAttempt / 1e6;
const paidEquivViaMeanTokensUsdPerWallDay = wAttemptsPerEnabledWallDay * meanPromptPerAttempt * tariff.promptPerMTok / 1e6;
const paidEquivUsdPerValeDay = wAttemptsPerValeDay * meanCostMicrosPerAttempt / 1e6;
const ratioToBaseline = paidEquivViaMeanCostUsdPerWallDay / baselineRecorded;
const thresholdUsd = m.economics.thresholdUsd; // 0.1
const breachesThreshold = paidEquivViaMeanCostUsdPerWallDay > thresholdUsd;

const projection = {
  task: "t_0d13c23d",
  generatedAt: new Date().toISOString(),
  sources: { phase36Report: p36ReportPath, phase36Raw: p36RawPath, waterReport: waterReportPath },
  conventions: {
    wallDayMs: WALL_DAY_MS,
    usdPerAgentWallDay: "observedUsd * 86_400_000 / enabledWallMs (sustained enabled-time projection; NOT a measured 24h bill)",
    usdPerValeDay: "observedUsd / (valeHours/24)",
    valeDaysPerWallDay: "86_400_000 / enabledWallMs * (valeHours/24)",
    perCallMicros: "ceil(promptTokens * promptPerMTok); output free (completionPerMTok=0); summed across calls",
    enabledWallMs: "sum of (endMs-startMs) over mode=enabled segments; setup/excluded wall time not counted",
  },
  tariff: { tableId: tariff.tableId, model: tariff.model, currency: tariff.currency, promptPerMTok: tariff.promptPerMTok, completionPerMTok: tariff.completionPerMTok, source: tariff.source, capturedAt: tariff.capturedAt },
  phase36Baseline: {
    codeRevision: p36.codeRevision, branch: p36.branch, testedWaterSurvival: false,
    enabledWallMs: p36enabledWallMs, enabledWallMsFromRawSegments: p36segWallMs, enabledWallMsMatch: p36enabledWallMs === p36segWallMs,
    valeHours: m.valeHours, paidCalls: p36calls, promptTokens: p36prompt, completionTokens: p36completion,
    costMicros: p36costMicros, costMicrosFromRawCalls: p36rawMicros, costMicrosMatch: p36costMicros === p36rawMicros,
    perCallCeil, observedUsd: p36observedUsd,
    usdPerAgentWallDay: p36usdPerAgentWallDay, usdPerAgentWallDayRecorded: baselineRecorded, reproducedExactly: baselineReproduced,
    usdPerValeDay: p36usdPerValeDay, usdPerValeDayRecorded: m.economics.usdPerValeDay,
    valeDaysPerWallDay: p36valeDaysPerWallDay, valeDaysPerWallDayRecorded: m.economics.valeDaysPerWallDay,
    meanPromptTokensPerAttempt: meanPromptPerAttempt, meanCostMicrosPerAttempt: meanCostMicrosPerAttempt,
    thresholdUsd, thresholdPassRecorded: m.economics.thresholdPass,
    basis: m.economics.basis,
  },
  waterSurvivalObserved: {
    revision: water.revision, paid: water.paid, providerCalls: water.providerCalls, backend: water.backend,
    enabledWallMs: wEnabledWallMs, wallSeconds: wWallSeconds, valeHours: wValeHours, ticks: water.duration.ticks, observations: water.counts.observations,
    attempts: wAttempts, attemptsPerWallHour: wAttemptsPerWallHour, attemptsPerValeDay: wAttemptsPerValeDay,
    attemptsPerEnabledWallDay: wAttemptsPerEnabledWallDay, valeDaysPerWallDay: wValeDaysPerWallDay,
    promptTokens: water.cost.usage.promptTokens, completionTokens: water.cost.usage.completionTokens,
    observedUsd: wObservedUsd, directMeasuredUsdPerAgentWallDay: wDirectUsdPerAgentWallDay,
    note: "Zero-paid deterministic-local-survival backend: 0 provider calls, 0 tokens, 0 micros. The literal measured projection is $0/agent/wall-day; the local price snapshot carries promptPerMTok=0.",
  },
  refreshedPaidEquivalentProjection: {
    hypothetical: true,
    measured: false,
    method: "Apply the recorded Phase 3.6 tariff ($0.042/Mtok input, output free) and per-attempt usage to the water run's OBSERVED attempt cadence. The water run made no paid calls; this is an extrapolation, not a water-survival bill.",
    attemptsPerEnabledWallDay: wAttemptsPerEnabledWallDay,
    viaMeanReportedCost: { meanCostMicrosPerAttempt: meanCostMicrosPerAttempt, usdPerAgentWallDay: paidEquivViaMeanCostUsdPerWallDay, usdPerValeDay: paidEquivUsdPerValeDay },
    viaMeanPromptTokens: { meanPromptTokensPerAttempt: meanPromptPerAttempt, promptPerMTok: tariff.promptPerMTok, usdPerAgentWallDay: paidEquivViaMeanTokensUsdPerWallDay },
    primaryUsdPerAgentWallDay: paidEquivViaMeanCostUsdPerWallDay,
    ratioToPhase36Baseline: ratioToBaseline,
    phase36BaselineUsdPerAgentWallDay: baselineRecorded,
    thresholdUsd,
    breachesHistoricalThreshold: breachesThreshold,
    assumptions: [
      "Per-attempt prompt token usage equals the Phase 3.6 paid mean (7,566.67 tokens). The water-survival observation adds thirst/inWater/drowning/drink fields absent from Phase 3.6, so real paid prompts may be LARGER; this projection is therefore not an upper bound.",
      "Attempt cadence (6 attempts over a ~24-vale-hour enabled window) is taken from the zero-paid water run; a paid backend could change timing/answers and thus cadence.",
      "Tariff held at the recorded typesafe-jev jev-1.14.0 rate card ($0.042/Mtok input, output free, captured 2026-11-21); no volume discounts; account-specific billing not reconciled.",
      "Enabled-time projection convention identical to Phase 3.6 (observed spend x 86,400,000 / enabled ms); a sustained-rate projection, NOT a measured 24-hour bill or invoice.",
      "The ~2x ratio vs Phase 3.6 reflects the water-survival policy issuing ~2x the reflex attempts per vale-day (6 vs 3), not a tariff change.",
    ],
  },
};
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "projection.json"), JSON.stringify(projection, null, 2));
console.log(JSON.stringify({
  baselineReproducedExactly: baselineReproduced,
  phase36UsdPerAgentWallDay: p36usdPerAgentWallDay,
  waterDirectMeasuredUsdPerAgentWallDay: wDirectUsdPerAgentWallDay,
  waterAttemptsPerEnabledWallDay: wAttemptsPerEnabledWallDay,
  refreshedPaidEquivUsdPerAgentWallDay: paidEquivViaMeanCostUsdPerWallDay,
  refreshedViaMeanTokensUsdPerAgentWallDay: paidEquivViaMeanTokensUsdPerWallDay,
  ratioToBaseline: ratioToBaseline,
  breachesHistoricalThreshold: breachesThreshold,
}, null, 2));
