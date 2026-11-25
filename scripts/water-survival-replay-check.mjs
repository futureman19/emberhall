// Independent strict replay oracle for the water-survival run (t_5465ed80).
//
// Reads two evidence directories produced by scripts/water-survival-live.mjs (a
// "live" run and an independent "replay" re-run) and verifies, field by field,
// that the survival trajectory, decisions, triggers, counters and budget guard
// match. The strict full traceHash is recomputed from each run's RAW evidence
// with the SHARED canonicalization in scripts/lib/replay-trace.mjs — the same
// function the live producer uses — so producer and verifier can never diverge
// on key order or field set. The comparison logic lives in
// scripts/lib/replay-oracle.mjs, shared with the negative-control regression
// test so the test exercises exactly what this verifier runs.
//
// Safety-relevant data is never dropped from the hash; ambient verb-offer
// multiplicity is part of the strict trace, so a real divergence fails loudly.
// Ambient multiplicity is ALSO reported as a classified (non-hard) difference so
// a strict mismatch can be attributed precisely rather than silently blessed.
//
// Usage:
//   node scripts/water-survival-replay-check.mjs \
//     --live evidence/water-survival-live --replay evidence/water-survival-replay \
//     --out evidence/water-survival-replay-check/verdict.json
// Defaults point at the committed historical evidence (backward-compatible
// validation of the pre-fix runs, whose strict traceHash differs only by ambient
// multiplicity). Fresh runs on the determinism fix should match exactly.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { compareRuns, resolveDecisionRows, readEvidenceBytes } from "./lib/replay-oracle.mjs";
import { TRACE_HASH_BASIS } from "./lib/replay-trace.mjs";

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}
const liveDir = arg("live", "evidence/water-survival-live");
const replayDir = arg("replay", "evidence/water-survival-replay");
const outPath = arg("out", "evidence/water-survival-replay-check/verdict.json");

const readJsonl = (p) => readEvidenceBytes(p).toString("utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
function load(dir) {
  const report = JSON.parse(readFileSync(join(dir, "report.json"), "utf8"));
  const obs = readJsonl(join(dir, "raw", "observations.jsonl"));
  const decPath = join(dir, "raw", "decisions.jsonl");
  const rawDec = existsSync(decPath) || existsSync(`${decPath}.gz`) ? readJsonl(decPath) : null;
  return { report, obs, dec: resolveDecisionRows(rawDec, report) };
}
const L = load(liveDir), R = load(replayDir);

const result = compareRuns({
  live: L.report, replay: R.report,
  liveObs: L.obs, replayObs: R.obs,
  liveDec: L.dec, replayDec: R.dec,
});

const verdict = {
  procedure: "independent strict replay oracle (shared canonicalization, recomputed from raw evidence)",
  generatedAt: new Date().toISOString(),
  liveDir, replayDir,
  liveRevision: L.report.revision, replayRevision: R.report.revision,
  traceHashBasis: TRACE_HASH_BASIS,
  ...result,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(verdict, null, 2) + "\n");
console.log(`${result.pass ? "PASS" : "FAIL"} hard ${result.hardPassed}/${result.hardTotal}; all ${result.checksPassed}/${result.checksTotal}; strictExact=${result.strictExact}; safetyIdentical=${result.safetyIdentical}; harmlessAmbientOnly=${result.harmlessAmbientOnly}`);
for (const c of result.checks) if (!c.ok) console.log(`  ${c.hard ? "✖ HARD" : "· classified"} ${c.name}: ${JSON.stringify(c.detail)}`);
console.log(`verdict -> ${outPath}`);
process.exit(result.pass ? 0 : 1);