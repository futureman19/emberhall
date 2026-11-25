// Shared replay-trace canonicalization + strict hash (t_5465ed80).
//
// SINGLE source of truth for the strict trace-oracle basis, used by BOTH
// water-survival-live.mjs (the producer) and water-survival-replay-check.mjs
// (the independent verifier). Before this module the two scripts carried
// divergent copies: the verifier hashed JSON.stringify({observations,decisions})
// with a different you-key order than the producer's newline-joined basis, so
// its "recomputed traceHash equals report" checks could never reproduce the
// recorded hash. The basis below is byte-identical to the producer's original
// computation (verified against the committed historical reports) and is
// documented in every report's traceHashBasis field.
//
// Basis (MUST stay byte-identical — key INSERTION ORDER is part of it because
// JSON.stringify preserves it):
//   sha256 over JSON.stringify of each canonical observation
//   {tick,hour,isNight,you:{hp,hunger,thirst,energy,x,z,inWater,drowning,ghost},verbs}
//   joined by newline, then the literal separator line ---decisions---, then
//   canonical decision rows {tick,hour,verb,answer,outcome} joined by newline;
//   wall-clock fields excluded.
//
// The hash is STRICT: it includes ambient verb-offer multiplicity (the full
// verbs array per observation, not a deduped set). Nothing safety-relevant is
// projected away — vitals, position, water/night exposure, decisions and the
// verb menu all feed the hash. Only wall-clock timing and presentation fields
// (logTail, labels, target metadata) are excluded by canonicalization.
import { createHash } from "node:crypto";

export const TRACE_HASH_BASIS =
  "sha256 over JSON.stringify of each canonical observation {tick,hour,isNight,you:{hp,hunger,thirst,energy,x,z,inWater,drowning,ghost},verbs} joined by newline, then the literal separator line ---decisions---, then canonical decision rows {tick,hour,verb,answer,outcome} joined by newline; wall-clock fields excluded";

/** @param {any} v */
function canonicalVerb(v) {
  return typeof v === "string" ? v : v.verb;
}

/** Canonical observation from a raw observations.jsonl row (verbs already
 *  strings) OR a live feed observation (verbs objects with .verb).
 * @param {any} o
 */
export function canonicalObservation(o) {
  return {
    tick: o.tick,
    hour: o.hour,
    isNight: o.isNight,
    you: {
      hp: o.you.hp,
      hunger: o.you.hunger,
      thirst: o.you.thirst,
      energy: o.you.energy,
      x: o.you.x,
      z: o.you.z,
      inWater: o.you.inWater,
      drowning: o.you.drowning,
      ghost: o.you.ghost,
    },
    verbs: o.verbs.map(canonicalVerb),
  };
}

/** Canonical decision row from a raw/compact decision record.
 * @param {any} d
 */
export function canonicalDecision(d) {
  return { tick: d.tick, hour: d.hour, verb: d.verb, answer: d.answer, outcome: d.outcome ?? null };
}

/** Canonical decision from ANY decision record shape: the live producer's
 *  {observation:{tick,hour},row:{verb,answer,outcome}} attempt object, or an
 *  already-flat compact report row. Null verb/answer/outcome are preserved
 *  exactly (they are meaningful and feed the hash).
 * @param {any} d
 */
export function canonicalDecisionFromRecord(d) {
  const flat = d && d.row
    ? { tick: d.observation?.tick, hour: d.observation?.hour, verb: d.row.verb, answer: d.row.answer, outcome: d.row.outcome }
    : d;
  return canonicalDecision(flat);
}

/** Strict full-trace hash over already-canonical rows.
 * @param {any[]} canonicalObs
 * @param {any[]} canonicalDecisions
 */
export function traceHash(canonicalObs, canonicalDecisions) {
  return createHash("sha256")
    .update(
      canonicalObs.map((o) => JSON.stringify(o)).join("\n") +
        "\n---decisions---\n" +
        canonicalDecisions.map((d) => JSON.stringify(d)).join("\n"),
    )
    .digest("hex");
}
