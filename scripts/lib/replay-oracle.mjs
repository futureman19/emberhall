// @ts-nocheck — plain-JS oracle utility shared by .mjs scripts and the .ts test.
// Reusable strict replay oracle (t_5465ed80).
//
// compareRuns() is the field-by-field safety comparison shared by the CLI
// verifier (scripts/water-survival-replay-check.mjs) and the negative-control
// regression test (src/game/replay-oracle.test.ts). Keeping it in one module
// means the test exercises EXACTLY the logic the verifier runs — a divergence
// the test catches is a divergence the verifier catches.
//
// Two tiers:
//  - HARD safety checks: seed/scenario, observation count, the full vitals /
//    position / water / day-night trajectory, decision rows, triggers, counters,
//    budget guard, water/food/night exposure safety fields, acceptance, the
//    recomputed-hash integrity checks, and the STRICT full traceHash. Any hard
//    failure => pass=false. Nothing safety-relevant is projected away.
//  - CLASSIFIED ambient check (non-hard): verb-offer multiplicity. After the
//    determinism fix this matches exactly; on the pre-fix historical evidence it
//    is the sole harmless difference. It is reported separately so a strict
//    traceHash mismatch can be attributed precisely to ambient multiplicity
//    rather than silently blessed.
import { canonicalObservation, canonicalDecisionFromRecord, traceHash, TRACE_HASH_BASIS } from "./replay-trace.mjs";

const VITALS = ["hp", "hunger", "thirst", "energy", "x", "z", "inWater", "drowning", "ghost"];
// waterExposure fields that are SAFETY-relevant (must match exactly). The
// verbsOffered tally is ambient multiplicity and is classified separately.
const SAFETY_EXPOSURE = [
  "thirstStart", "thirstMin", "thirstEnd", "hungerStart", "hungerMin", "hungerEnd",
  "hpStart", "hpMin", "hpEnd", "firstTickAtOrBelow", "ticksAtOrBelow",
  "inWaterTicks", "drowningTicks", "maxConsecutiveInWater", "inWaterEpisodes",
  "drinkOfferObservations", "drinkDecisions", "drinkAckedOk", "thirstRestoreEvents",
  "eatDecisions", "eatAckedOk", "nightObservations", "observationCount",
];
const STRICT_CHECK = "STRICT traceHash live == replay (exact oracle)";

/** Recompute the strict trace hash from raw observation rows + decision records. */
export function recomputeHash(obsRows, decisionRecords) {
  return traceHash(obsRows.map(canonicalObservation), decisionRecords.map(canonicalDecisionFromRecord));
}

/** Resolve decision records: prefer raw/decisions.jsonl rows, fall back to the
 *  report's compact rows (which carry the exact canonical fields). */
export function resolveDecisionRows(rawRows, report) {
  if (Array.isArray(rawRows) && rawRows.length) return rawRows;
  return report.decisions ?? [];
}

export function compareRuns({ live, replay, liveObs, replayObs, liveDec, replayDec }) {
  const checks = [];
  const check = (name, ok, detail, hard = true) => { checks.push({ name, ok: !!ok, detail, hard }); return ok; };

  // --- identity -------------------------------------------------------------
  check("same seed", live.initialConditions?.seed === replay.initialConditions?.seed,
    { live: live.initialConditions?.seed, replay: replay.initialConditions?.seed });
  check("same scenario", live.scenario === replay.scenario, { live: live.scenario, replay: replay.scenario });

  // --- observation counts ---------------------------------------------------
  check("observation count live == replay", liveObs.length === replayObs.length, { live: liveObs.length, replay: replayObs.length });
  check("observation count == counts.observations",
    liveObs.length === live.counts?.observations && replayObs.length === replay.counts?.observations,
    { live: liveObs.length, replay: replayObs.length, liveCount: live.counts?.observations, replayCount: replay.counts?.observations });

  // --- per-observation safety trajectory ------------------------------------
  let vitalsMismatch = 0, nightMismatch = 0, verbMultiplicityMismatch = 0, firstMismatch = null;
  const n = Math.min(liveObs.length, replayObs.length);
  for (let i = 0; i < n; i++) {
    const a = liveObs[i], b = replayObs[i];
    if (a.tick !== b.tick || a.hour !== b.hour) {
      vitalsMismatch++; firstMismatch ??= { i, reason: "tick/hour", live: a.tick, replay: b.tick }; continue;
    }
    if (a.isNight !== b.isNight) { nightMismatch++; firstMismatch ??= { i, tick: a.tick, reason: "isNight" }; }
    for (const k of VITALS) {
      if (a.you?.[k] !== b.you?.[k]) {
        vitalsMismatch++; firstMismatch ??= { i, tick: a.tick, key: k, live: a.you?.[k], replay: b.you?.[k] };
      }
    }
    const av = (a.verbs ?? []).map((v) => (typeof v === "string" ? v : v.verb)).slice().sort();
    const bv = (b.verbs ?? []).map((v) => (typeof v === "string" ? v : v.verb)).slice().sort();
    if (av.join(",") !== bv.join(",")) verbMultiplicityMismatch++;
  }
  check("vitals/position/water/day-night trajectory identical", vitalsMismatch === 0 && nightMismatch === 0,
    { vitalsMismatch, nightMismatch, firstMismatch });

  // --- decisions ------------------------------------------------------------
  check("decision count live == replay", liveDec.length === replayDec.length, { live: liveDec.length, replay: replayDec.length });
  let decMismatch = 0, firstDecMismatch = null;
  const dn = Math.min(liveDec.length, replayDec.length);
  for (let i = 0; i < dn; i++) {
    const a = canonicalDecisionFromRecord(liveDec[i]), b = canonicalDecisionFromRecord(replayDec[i]);
    if (JSON.stringify(a) !== JSON.stringify(b)) { decMismatch++; firstDecMismatch ??= { i, live: a, replay: b }; }
  }
  check("decision rows identical (verb/answer/outcome/tick/hour)", decMismatch === 0, { decMismatch, firstDecMismatch });

  // --- triggers / counters --------------------------------------------------
  check("triggerCounts identical", JSON.stringify(live.triggerCounts) === JSON.stringify(replay.triggerCounts),
    { live: live.triggerCounts, replay: replay.triggerCounts });
  for (const k of ["decisions", "attempts", "rejections", "interventions", "errors"]) {
    check(`counts.${k} identical`, live.counts?.[k] === replay.counts?.[k], { live: live.counts?.[k], replay: replay.counts?.[k] });
  }

  // --- budget guard ---------------------------------------------------------
  check("budget guard: zero paid, zero provider calls",
    live.cost?.providerCalls === 0 && replay.cost?.providerCalls === 0 && live.cost?.totalUsd === 0 && replay.cost?.totalUsd === 0,
    { liveUsd: live.cost?.totalUsd, replayUsd: replay.cost?.totalUsd, liveCalls: live.cost?.providerCalls, replayCalls: replay.cost?.providerCalls });
  check("budget cap identical", live.budget?.capMicros === replay.budget?.capMicros, { live: live.budget?.capMicros, replay: replay.budget?.capMicros });
  check("budget spent identical", live.budget?.final?.spentMicros === replay.budget?.final?.spentMicros,
    { live: live.budget?.final?.spentMicros, replay: replay.budget?.final?.spentMicros });

  // --- water/food/night exposure safety fields ------------------------------
  const le = live.waterExposure ?? {}, re = replay.waterExposure ?? {};
  const exposureMismatch = SAFETY_EXPOSURE.filter((k) => JSON.stringify(le[k]) !== JSON.stringify(re[k]));
  check("water/food/night exposure safety fields identical", exposureMismatch.length === 0, { exposureMismatch });

  // --- acceptance -----------------------------------------------------------
  check("acceptance identical", JSON.stringify(live.acceptance) === JSON.stringify(replay.acceptance),
    { live: live.acceptance, replay: replay.acceptance });

  // --- strict trace hash (recomputed integrity + exact equality) ------------
  const recomputedLive = recomputeHash(liveObs, liveDec);
  const recomputedReplay = recomputeHash(replayObs, replayDec);
  check("recomputed live hash == live report.traceHash", recomputedLive === live.traceHash, { recomputed: recomputedLive, report: live.traceHash });
  check("recomputed replay hash == replay report.traceHash", recomputedReplay === replay.traceHash, { recomputed: recomputedReplay, report: replay.traceHash });
  const strictExact = live.traceHash === replay.traceHash;
  check(STRICT_CHECK, strictExact, { live: live.traceHash, replay: replay.traceHash });

  // --- classified ambient multiplicity (NON-hard) ---------------------------
  const lv = le.verbsOffered ?? {}, rv = re.verbsOffered ?? {};
  const ambientVerbDelta = {};
  for (const verb of new Set([...Object.keys(lv), ...Object.keys(rv)])) {
    if ((lv[verb] ?? 0) !== (rv[verb] ?? 0)) ambientVerbDelta[verb] = { live: lv[verb] ?? 0, replay: rv[verb] ?? 0 };
  }
  check("ambient verb-offer multiplicity (classified, non-hard)",
    verbMultiplicityMismatch === 0 && Object.keys(ambientVerbDelta).length === 0,
    { verbMultiplicityMismatch, ambientVerbDelta }, false);

  const hardChecks = checks.filter((c) => c.hard);
  const safetyChecks = hardChecks.filter((c) => c.name !== STRICT_CHECK);
  const safetyIdentical = safetyChecks.every((c) => c.ok);
  const pass = hardChecks.every((c) => c.ok);
  return {
    pass,
    safetyIdentical,
    strictExact,
    // A strict mismatch that is attributable ONLY to ambient multiplicity:
    // every safety field matches, so the difference is harmless presentation.
    harmlessAmbientOnly: safetyIdentical && !strictExact,
    checksPassed: checks.filter((c) => c.ok).length,
    checksTotal: checks.length,
    hardPassed: hardChecks.filter((c) => c.ok).length,
    hardTotal: hardChecks.length,
    verbMultiplicityMismatch,
    ambientVerbDelta,
    traceHashBasis: TRACE_HASH_BASIS,
    checks,
  };
}