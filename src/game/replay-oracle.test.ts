// Negative-control regressions for the strict survival replay oracle
// (t_5465ed80). Exercises scripts/lib/replay-oracle.mjs — the EXACT comparison
// the CLI verifier runs — against synthetic runs.
//
// Proves three things:
//  1. Identical seed/config/log => exact strict replay match (pass, strictExact).
//  2. Every real safety divergence (action/intent, vitals, water/night exposure,
//     position, decisions/triggers, counters, budget guard) fails LOUDLY — even
//     when the attacker recomputes traceHash to match the mutated data, so the
//     field-level safety checks cannot be bypassed by re-hashing.
//  3. A purely ambient verb-offer multiplicity change is classified as the sole
//     harmless difference (safetyIdentical stays true) while still failing the
//     strict oracle — the oracle distinguishes harmless presentation from a real
//     safety divergence and never blesses the latter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { compareRuns, recomputeHash, readEvidenceBytes } from "../../scripts/lib/replay-oracle.mjs";

type Obs = { tick: number; hour: number; isNight: boolean; you: Record<string, number | boolean>; verbs: string[] };
type Dec = { tick: number; hour: number; verb: string | null; answer: string | null; outcome: string | null };

const SAFETY_EXPOSURE = {
  thirstStart: 80, thirstMin: 20, thirstEnd: 60, hungerStart: 80, hungerMin: 40, hungerEnd: 70,
  hpStart: 100, hpMin: 90, hpEnd: 100, firstTickAtOrBelow: 100, ticksAtOrBelow: 50,
  inWaterTicks: 30, drowningTicks: 0, maxConsecutiveInWater: 10, inWaterEpisodes: 3,
  drinkOfferObservations: 6, drinkDecisions: 2, drinkAckedOk: 2, thirstRestoreEvents: 2,
  eatDecisions: 1, eatAckedOk: 1, nightObservations: 40, observationCount: 2,
};

function makeRun(seed = 20261124) {
  const obs: Obs[] = [
    { tick: 0, hour: 8, isNight: false, you: { hp: 100, hunger: 80, thirst: 80, energy: 80, x: 10, z: 10, inWater: false, drowning: false, ghost: false }, verbs: ["walk", "talk", "talk"] },
    { tick: 1, hour: 8, isNight: false, you: { hp: 100, hunger: 79, thirst: 78, energy: 79, x: 11, z: 10, inWater: true, drowning: false, ghost: false }, verbs: ["walk", "hunt"] },
  ];
  const dec: Dec[] = [{ tick: 0, hour: 8, verb: "drink", answer: "Drink from the stream.", outcome: "ok" }];
  const report: Record<string, unknown> = {
    revision: "test-sha",
    initialConditions: { seed },
    scenario: "water-survival",
    config: { scheduler: { riskGated: true, reflexCooldownTicks: 150 }, price: { tableId: "local-survival-zero", promptPerMTok: 0, completionPerMTok: 0 } },
    counts: { observations: obs.length, decisions: dec.length, attempts: dec.length, rejections: 0, interventions: 0, errors: 0 },
    triggerCounts: { boot: 1, "vitals.thirst_critical": 1 },
    cost: { providerCalls: 0, totalUsd: 0 },
    budget: { capMicros: 500000, final: { spentMicros: 0 } },
    waterExposure: { ...SAFETY_EXPOSURE, verbsOffered: { walk: 2, talk: 2, hunt: 1 } },
    acceptance: { pass: true, zeroRejections: true, zeroInterventions: true, budgetGuardIntact: true },
    traceHash: "",
  };
  report.traceHash = recomputeHash(obs, dec);
  return { report, obs, dec };
}

function compare(live: ReturnType<typeof makeRun>, replay: ReturnType<typeof makeRun>) {
  return compareRuns({
    live: live.report, replay: replay.report,
    liveObs: live.obs, replayObs: replay.obs,
    liveDec: live.dec, replayDec: replay.dec,
  });
}

// Clone a run and recompute its traceHash so the hash-integrity checks pass —
// simulating an adversary who re-hashes after mutating safety data. The field
// checks must STILL catch the divergence.
function mutated(fn: (r: ReturnType<typeof makeRun>) => void) {
  const r = structuredClone(makeRun());
  fn(r);
  r.report.traceHash = recomputeHash(r.obs, r.dec);
  return r;
}

test("identical seed/config/log => exact strict replay match", () => {
  const a = makeRun(), b = makeRun();
  const v = compare(a, b);
  assert.equal(v.pass, true);
  assert.equal(v.strictExact, true);
  assert.equal(v.safetyIdentical, true);
  assert.equal(v.harmlessAmbientOnly, false);
  assert.equal(v.hardPassed, v.hardTotal);
});

test("repeated independent equivalent runs match exactly", () => {
  // Two separately-constructed runs from the same seed are byte-identical.
  const v = compare(makeRun(7), makeRun(7));
  assert.equal(v.pass, true);
  assert.equal(v.strictExact, true);
});

test("different seed is caught (identity check)", () => {
  const v = compare(makeRun(1), mutated((r) => { r.report.initialConditions = { seed: 2 }; }));
  assert.equal(v.pass, false);
  assert.equal(v.safetyIdentical, false);
});

// --- real safety divergences MUST fail loudly, even with a recomputed hash ---
const safetyCases: Array<[string, (r: ReturnType<typeof makeRun>) => void]> = [
  ["action/intent (decision verb)", (r) => { r.dec[0].verb = "eat"; }],
  ["decision outcome", (r) => { r.dec[0].outcome = "rejected"; }],
  ["vital hp", (r) => { r.obs[0].you.hp = 55; }],
  ["vital thirst", (r) => { r.obs[1].you.thirst = 5; }],
  ["vital hunger", (r) => { r.obs[0].you.hunger = 10; }],
  ["vital energy", (r) => { r.obs[1].you.energy = 1; }],
  ["water exposure (inWater)", (r) => { r.obs[1].you.inWater = false; }],
  ["drowning", (r) => { r.obs[1].you.drowning = true; }],
  ["position x", (r) => { r.obs[1].you.x = 99; }],
  ["night exposure", (r) => { r.obs[0].isNight = true; }],
  ["trigger counts", (r) => { r.report.triggerCounts = { boot: 1 }; }],
  ["rejection counter", (r) => { (r.report.counts as Record<string, number>).rejections = 3; }],
  ["intervention counter", (r) => { (r.report.counts as Record<string, number>).interventions = 2; }],
  ["budget guard provider calls", (r) => { (r.report.cost as Record<string, number>).providerCalls = 1; }],
  ["budget guard spend", (r) => { (r.report.budget as { final: { spentMicros: number } }).final.spentMicros = 12345; }],
  ["water exposure safety field", (r) => { (r.report.waterExposure as Record<string, number>).drowningTicks = 9; }],
  ["acceptance flag", (r) => { (r.report.acceptance as Record<string, boolean>).pass = false; }],
  ["scheduler config", (r) => { (r.report.config as { scheduler: Record<string, unknown> }).scheduler.reflexCooldownTicks = 151; }],
  ["zero-tariff price config", (r) => { (r.report.config as { price: Record<string, unknown> }).price.promptPerMTok = 1; }],
];
for (const [name, fn] of safetyCases) {
  test(`real safety divergence fails loudly: ${name}`, () => {
    const v = compare(makeRun(), mutated(fn));
    assert.equal(v.pass, false, `${name} must fail the oracle`);
    assert.equal(v.safetyIdentical, false, `${name} must break safety identity (not be blessed as harmless)`);
    assert.equal(v.harmlessAmbientOnly, false, `${name} must NOT be classified as harmless ambient`);
  });
}

test("oracle cannot bless a real safety divergence hidden behind a recomputed hash", () => {
  // Mutate a vital AND recompute the hash so both recomputed-hash integrity
  // checks pass; the trajectory check must still reject it.
  const bad = mutated((r) => { r.obs[0].you.hp = 1; });
  const v = compare(makeRun(), bad);
  const recomputedOk = v.checks.filter((c: { name: string; ok: boolean }) => c.name.startsWith("recomputed")).every((c: { ok: boolean }) => c.ok);
  assert.equal(recomputedOk, true, "hash integrity checks pass (attacker re-hashed)");
  assert.equal(v.strictExact, false);
  assert.equal(v.safetyIdentical, false);
  assert.equal(v.pass, false);
});

test("purely ambient verb-offer multiplicity is classified harmless, still fails strict", () => {
  // Add an extra ambient "talk" offer: no safety field changes.
  const ambient = mutated((r) => {
    r.obs[0].verbs = ["walk", "talk", "talk", "talk"];
    (r.report.waterExposure as { verbsOffered: Record<string, number> }).verbsOffered = { walk: 2, talk: 3, hunt: 1 };
  });
  const v = compare(makeRun(), ambient);
  assert.equal(v.safetyIdentical, true, "no safety field changed");
  assert.equal(v.strictExact, false, "ambient multiplicity feeds the strict hash");
  assert.equal(v.harmlessAmbientOnly, true, "classified as the sole harmless difference");
  assert.equal(v.pass, false, "strict oracle still fails (exact equality required)");
  assert.deepEqual((v.ambientVerbDelta as Record<string, { live: number; replay: number }>).talk, { live: 2, replay: 3 });
});

test("gzip-preserved evidence returns the exact original bytes", () => {
  const dir = mkdtempSync(join(tmpdir(), "replay-oracle-gzip-"));
  try {
    const original = Buffer.from('{"tick":0,"verbs":["walk"]}\n', "utf8");
    const path = join(dir, "observations.jsonl");
    writeFileSync(`${path}.gz`, gzipSync(original));
    assert.deepEqual(readEvidenceBytes(path), original);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});