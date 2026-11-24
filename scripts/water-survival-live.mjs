// Zero-paid water-survival LIVE proof (t_4e2c4d13).
//
// Runs a FRESH dedicated reflex-driven agent against a REAL isolated
// authoritative host (src/server shard over WebSocket) for a FULL vale day
// (24 sim hours) under combined night + food + water pressure. The reflex
// backend is a DETERMINISTIC LOCAL SURVIVAL SCORER (scripted below, per
// docs/water-survival-slice.md section 4 Scenario A) metered through the REAL
// production cost seam (callReflexMetered) at a ZERO tariff:
// 0 provider calls, 0 tokens, $0. This is NOT the paid Jev acceptance gate —
// it is the deterministic/local zero-paid proof path authorized by
// docs/water-survival-slice.md §4 and the overnight guardrail. No credential
// is read, no paid provider is constructed, no host/game code is mutated.
//
// Evidence: observations, decisions, attempts (schema-valid, replay-ready),
// budget-guard snapshots, water-pressure exposure telemetry, initial
// conditions, exact revision, config, duration, acceptance verdict.
import { mkdirSync, existsSync, openSync, writeSync, closeSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawn, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { connectHostFeed } from "../src/game/agent/hostfeed.ts";
import { createReflexAutopilot } from "../src/game/agent/autopilot.ts";
import { callReflexMetered } from "../src/game/agent/metering.ts";
import { BudgetGuard } from "../src/game/agent/budget.ts";
import { createJsonlAttemptLog, readAttemptLogFile } from "../src/game/agent/attempts-file.ts";
import { DEFAULT_SCHEDULER_CONFIG } from "../src/game/agent/scheduler.ts";
import { createRecorder } from "./phase36-recorder.mjs";

// ---- zero-paid enforcement -------------------------------------------------
// This runner has NO paid path. It never reads TYPESAFE_API_KEY and never
// constructs the Jev backend. The only backend is the deterministic local
// survival scorer below (no Math.random, no network).
const PAID = false;
const BACKEND_ID = "deterministic-local-survival";
const ZERO_PRICE = {
  tableId: "local-survival-zero",
  model: "deterministic-scorer",
  currency: "USD",
  promptPerMTok: 0,
  completionPerMTok: 0,
  source: "local deterministic survival backend — no provider call, zero cost",
  capturedAt: "2026-11-24",
  notes: "Zero-paid water-survival proof (t_4e2c4d13). NOT the paid Jev gate.",
};

// ---- configuration ---------------------------------------------------------
const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const root = resolve(arg("--root", process.cwd()));
const outDir = resolve(root, arg("--out", "evidence/water-live"));
const rawDir = join(outDir, "raw");
const port = Number(arg("--port", "5599"));
const seed = Number(arg("--seed", "20261124"));
const charName = arg("--name", "aquila");
const charKey = arg("--key", "proof-water-aquila");
const agentId = arg("--agent", "water-proof-aquila");
const watchdogMs = Number(arg("--watchdog-ms", "1800000"));
const dataDir = join(rawDir, "shard-data");
const url = `ws://127.0.0.1:${port}`;

if (existsSync(join(rawDir, "attempts.ndjson"))) throw new Error("fresh evidence directory required");
mkdirSync(rawDir, { recursive: true });

const revision = execSync("git rev-parse HEAD", { cwd: root }).toString().trim();
const branch = execSync("git branch --show-current", { cwd: root }).toString().trim();
const nodeVersion = process.version;
const startedWallMs = Date.now();

// ---- boot the isolated real host ------------------------------------------
const shardEnv = {
  ...process.env,
  PORT: String(port),
  EMBERHALL_SEED: String(seed),
  EMBERHALL_DATA_DIR: dataDir,
  EMBERHALL_KEYS: `${charName}:${charKey}`,
};
delete shardEnv.TYPESAFE_API_KEY; // belt-and-suspenders: no paid key in the host env
const shardLogFd = openSync(join(rawDir, "shard.log"), "wx");
const shard = spawn(process.execPath, ["--experimental-strip-types", join(root, "scripts/water-shard-boot.mjs")], {
  cwd: root,
  env: shardEnv,
  stdio: ["ignore", "pipe", "pipe"],
});
let shardReady = false;
const readyPromise = new Promise((resolveReady, rejectReady) => {
  const timer = setTimeout(() => rejectReady(new Error("shard boot timeout")), 30000);
  const onData = (buf) => {
    writeSync(shardLogFd, buf);
    if (/shard running/.test(buf.toString())) { shardReady = true; clearTimeout(timer); resolveReady(); }
  };
  shard.stdout.on("data", onData);
  shard.stderr.on("data", (buf) => writeSync(shardLogFd, buf));
  shard.on("exit", (code) => { if (!shardReady) { clearTimeout(timer); rejectReady(new Error(`shard exited early code=${code}`)); } });
});

// ---- evidence sinks --------------------------------------------------------
const attemptPath = join(rawDir, "attempts.ndjson");
const durable = createJsonlAttemptLog(attemptPath);
const traceFd = openSync(join(rawDir, "trace.jsonl"), "wx");
const obsFd = openSync(join(rawDir, "observations.jsonl"), "wx");
const feedFd = openSync(join(rawDir, "feed.ndjson"), "wx");
const r = createRecorder((row) => writeSync(traceFd, JSON.stringify(row) + "\n"));
const guard = new BudgetGuard();
const decisions = [], rejections = [], interventions = [], errors = [];
const triggerCounts = {};
const canonicalObs = [];
const schedulerConfig = structuredClone(DEFAULT_SCHEDULER_CONFIG);

// ---- water-pressure exposure telemetry ------------------------------------
const water = {
  thirstStart: null, thirstMin: null, thirstEnd: null,
  firstTickAtOrBelow: { offer60: null, low25: null, critical10: null },
  ticksAtOrBelow: { offer60: 0, low25: 0, critical10: 0 },
  inWaterTicks: 0, drowningTicks: 0, maxConsecutiveInWater: 0, inWaterEpisodes: 0,
  drinkOfferObservations: 0, drinkDecisions: 0, drinkAckedOk: 0, thirstRestoreEvents: 0,
  hungerStart: null, hungerMin: null, hungerEnd: null, eatDecisions: 0, eatAckedOk: 0,
  nightObservations: 0, hpStart: null, hpMin: null, hpEnd: null,
  verbsOffered: {}, observationCount: 0,
};
let prevThirst = null, prevInWater = false, consecInWater = 0;
let current = null, latestObservation = null, active = false, stopped = false, reason = "setup-failed";
let firstHour = null, lastObs = null, initialObservation = null;
let finish;
const done = new Promise((resolveDone) => { finish = resolveDone; });

function trackWater(obs) {
  const you = obs.you;
  water.observationCount++;
  if (water.thirstStart === null) { water.thirstStart = you.thirst; water.hungerStart = you.hunger; water.hpStart = you.hp; }
  water.thirstMin = water.thirstMin === null ? you.thirst : Math.min(water.thirstMin, you.thirst);
  water.hungerMin = water.hungerMin === null ? you.hunger : Math.min(water.hungerMin, you.hunger);
  water.hpMin = water.hpMin === null ? you.hp : Math.min(water.hpMin, you.hp);
  water.thirstEnd = you.thirst; water.hungerEnd = you.hunger; water.hpEnd = you.hp;
  for (const [key, th] of [["offer60", 60], ["low25", 25], ["critical10", 10]]) {
    if (you.thirst <= th) {
      water.ticksAtOrBelow[key]++;
      if (water.firstTickAtOrBelow[key] === null) water.firstTickAtOrBelow[key] = obs.tick;
    }
  }
  if (you.inWater) {
    water.inWaterTicks++; consecInWater++;
    water.maxConsecutiveInWater = Math.max(water.maxConsecutiveInWater, consecInWater);
    if (!prevInWater) water.inWaterEpisodes++;
  } else consecInWater = 0;
  prevInWater = you.inWater;
  if (you.drowning) water.drowningTicks++;
  if (obs.isNight) water.nightObservations++;
  const drinkOffered = obs.verbs.some((v) => v.verb === "drink");
  if (drinkOffered) water.drinkOfferObservations++;
  for (const v of obs.verbs) water.verbsOffered[v.verb] = (water.verbsOffered[v.verb] ?? 0) + 1;
  if (prevThirst !== null && you.thirst - prevThirst >= 20) water.thirstRestoreEvents++;
  prevThirst = you.thirst;
}

// ---- connect, meter, drive -------------------------------------------------
await readyPromise;
const feed = await connectHostFeed({ url, apiKey: charKey, client: "water-survival-proof" });
initialObservation = structuredClone(feed.latest);
firstHour = feed.latest.hour;

const log = {
  begin(row) { durable.begin(row); current.id = row.attemptId; r.event("request", { attemptId: row.attemptId, exchange: current.exchange, context: current.context }, current.wallMs); },
  end(row) { durable.end(row); current.end = structuredClone(row); },
  lines: () => durable.lines(), toJSONL: () => durable.toJSONL(),
};

// Deterministic local survival backend (docs/water-survival-slice.md §4):
// scripted, zero-paid, no Math.random. Walks to the water's edge BEFORE
// drinking (avoids non-adjacent refusals), preserves pack food until hunger
// pressure fires, scrambles to shore when drowning. topPick: highest score,
// ties -> first.
const WORK_SCORE = { chop: 100, mine: 95, harvest: 90, pick: 85, till: 80, sowCabbage: 78, sowWheat: 78, sowGarlic: 78, sowAcorn: 76, dig: 70, fish: 65, hunt: 60, loot: 55, skin: 50, tame: 45, fill: 40, cast: 30, fireball: 30, teleport: 20 };
function survivalScores(options, verbs, you, triggers) {
  const hungerTrig = triggers.some((t) => String(t.kind).startsWith("vitals.hunger"));
  const dangerTrig = triggers.some((t) => t.survival && (String(t.kind).startsWith("vitals.hp") || String(t.kind).startsWith("danger") || t.kind === "vitals.in_water" || t.kind === "vitals.drowning"));
  return options.map((label, i) => {
    const verb = verbs[i] ?? "";
    const L = String(label).toLowerCase();
    if (L.startsWith("scramble to shore")) return 1000;
    const isEat = verb === "eat" || L.includes("from pack");
    if (isEat && you.hunger != null && you.hunger <= 10) return 960;
    if (L.startsWith("walk to the water")) return 900;
    if (L.startsWith("drink from the water")) return 850;
    // Preserve pack food until hunger pressure fires (doc section 4 A):
    // eat only on a hunger trigger or when hunger <= 30.
    if (isEat) return (hungerTrig || (you.hunger != null && you.hunger <= 30)) ? 800 : 5;
    if (hungerTrig && ["fish", "harvest", "pick", "hunt", "loot"].includes(verb)) return 600;
    if (dangerTrig && verb === "walk") return 550;
    if (dangerTrig && ["cast", "fireball", "teleport"].includes(verb)) return 540;
    // Low energy: prefer rest over work to avoid fatigue refusals.
    if (verb in WORK_SCORE) return (you.energy != null && you.energy <= 20) ? 0 : WORK_SCORE[verb];
    if (verb === "walk") return (you.energy != null && you.energy <= 20) ? 0 : 10;
    return 1;
  });
}
const localBackend = {
  calls: [],
  async decide(exchange) {
    localBackend.calls.push(exchange);
    const state = exchange.state ?? {};
    const you = state.observation?.you ?? {};
    const triggers = state.triggers ?? [];
    const verbs = state.candidateVerbs ?? [];
    const answers = exchange.questions.map((q) => {
      const scores = survivalScores(q.options ?? [], verbs, you, triggers);
      let pick = 0;
      for (let i = 1; i < scores.length; i++) if (scores[i] > scores[pick]) pick = i;
      return { id: q.id, type: "choice", pick };
    });
    return { answers };
  },
};
const stubCallBackend = {
  async call(exchange) {
    const result = await localBackend.decide(exchange);
    return { result, raw: null, usage: { promptTokens: 0, completionTokens: 0 }, provider: { name: "local-survival", model: "scripted-deterministic" } };
  },
};
let meteredExhausted = false;
function triggerOf(ctx) {
  const triggers = ctx?.triggers ?? [];
  if (triggers.length === 0) return { kind: "unknown", detail: "no trigger context" };
  const first = triggers[0];
  return triggers.length === 1
    ? { kind: first.kind, detail: first.detail }
    : { kind: first.kind, detail: `${first.detail} (+${triggers.length - 1} more: ${triggers.slice(1).map((t) => t.kind).join(", ")})` };
}
const backend = {
  budgetExhausted: () => meteredExhausted,
  async decide(exchange, ctx) {
    active = true;
    for (const t of ctx?.triggers ?? []) triggerCounts[t.kind] = (triggerCounts[t.kind] ?? 0) + 1;
    current = { exchange: structuredClone(exchange), context: structuredClone(ctx), observation: structuredClone(latestObservation), wallMs: Date.now() };
    try {
      const metered = await callReflexMetered(
        { backend: stubCallBackend, guard, log, price: ZERO_PRICE, provider: { name: "local-survival", model: "scripted-deterministic" } },
        { agentId, bodyId: feed.characterId, trigger: triggerOf(ctx), tick: ctx?.tick ?? 0, stateHash: ctx?.stateHash ?? "0", exchange },
      );
      meteredExhausted = guard.snapshot(agentId).exhausted;
      if (metered.outcome.error) throw new Error(metered.outcome.error.message);
      current.answers = structuredClone(metered.outcome.result.answers);
      r.event("response", { attemptId: metered.attemptId, answers: current.answers });
      return metered.outcome.result;
    } catch (error) {
      errors.push({ wallMs: Date.now(), kind: "backend-failure", message: String(error.message) });
      throw error;
    }
  },
};

async function send(action) {
  r.event("submit", { attemptId: current.id, action });
  const rejection = action.type === "intent" ? await feed.submit(action.intent) : await feed.verb({ verb: action.verb, item: action.item, tx: action.tx ?? null, ty: action.ty ?? null });
  const row = r.event("ack", { attemptId: current.id, rejection });
  if (rejection !== null) rejections.push(row);
  return rejection;
}

const auto = createReflexAutopilot({
  backend,
  submit: (intent) => send({ type: "intent", intent }),
  verb: (req) => send({ type: "verb", ...req }),
  config: schedulerConfig,
  hooks: {
    onAttemptEnd(row) { active = false; if (row.status !== "ok") errors.push({ wallMs: Date.now(), kind: "scheduler", status: row.status }); },
    onDecision(row) {
      r.event("decision", { attemptId: current.id, row });
      const ackOk = !row.outcome || row.outcome.submitRejected !== 1;
      if (row.verb === "drink") { water.drinkDecisions++; if (ackOk) water.drinkAckedOk++; }
      if (row.verb === "eat") { water.eatDecisions++; if (ackOk) water.eatAckedOk++; }
      decisions.push({ attemptId: current.id, observation: current.observation, row: structuredClone(row), exchange: current.exchange, answers: current.answers });
      writeSync(feedFd, JSON.stringify({ wallMs: Date.now(), verb: row.verb, answer: row.answer, ackOk }) + "\n");
    },
  },
});

function stop(why, wallMs) {
  if (stopped) return;
  stopped = true; reason = why;
  r.stop(wallMs); auto.stop(); finish();
}
const signal = () => { interventions.push({ wallMs: Date.now(), kind: "operator-stop" }); stop("operator-stop", Date.now()); };
process.once("SIGTERM", signal); process.once("SIGINT", signal);
const watchdog = setTimeout(() => { interventions.push({ wallMs: Date.now(), kind: "watchdog" }); stop("watchdog", Date.now()); }, watchdogMs);

auto.start();
const unsubscribe = feed.source.subscribe((obs) => {
  if (stopped) return;
  latestObservation = obs; lastObs = obs;
  canonicalObs.push({ tick: obs.tick, hour: obs.hour, isNight: obs.isNight, you: { hp: obs.you.hp, hunger: obs.you.hunger, thirst: obs.you.thirst, energy: obs.you.energy, x: obs.you.x, z: obs.you.z, inWater: obs.you.inWater, drowning: obs.you.drowning, ghost: obs.you.ghost }, verbs: obs.verbs.map((v) => v.verb) });
  const wallMs = Date.now();
  writeSync(obsFd, JSON.stringify({ wallMs, tick: obs.tick, hour: obs.hour, isNight: obs.isNight, you: obs.you, verbs: obs.verbs.map((v) => v.verb), logTail: obs.logTail }) + "\n");
  trackWater(obs);
  r.observe(obs, guard.snapshot(agentId), meteredExhausted, wallMs);
  auto.ingest(obs);
  queueMicrotask(() => {
    if (active || r.trace.at(-1)?.type !== "observation") return;
    if (obs.you.ghost || obs.you.hp <= 0) stop("death", wallMs);
    else if (obs.hour - firstHour >= 24) stop("full-vale-day", wallMs);
  });
});

try { await done; }
finally {
  clearTimeout(watchdog); unsubscribe(); auto.stop(); await auto.settled(); await feed.close();
  durable.close(); closeSync(traceFd); closeSync(obsFd); closeSync(feedFd);

  // Shut the isolated host down cleanly (it saves on SIGTERM).
  await new Promise((resolveShutdown) => {
    const t = setTimeout(() => { shard.kill("SIGKILL"); resolveShutdown(); }, 8000);
    shard.once("exit", () => { clearTimeout(t); resolveShutdown(); });
    shard.kill("SIGTERM");
  });
  closeSync(shardLogFd);

  const lines = readAttemptLogFile(attemptPath);
  const calls = lines.filter((x) => x.type === "begin").map((begin) => {
    const end = lines.find((x) => x.type === "end" && x.attemptId === begin.attemptId);
    return { id: begin.attemptId, agentId, startMs: begin.startedAt, endMs: end?.endedAt, status: end?.status ?? "interrupted", usage: end?.usage, price: end?.cost.price ?? begin.price, model: begin.provider.model, provider: begin.provider.name, costMicros: end?.cost.micros, costBasis: end?.cost.basis };
  });
  const first = r.samples[0] ?? { wallMs: startedWallMs, tick: 0, hour: firstHour ?? 0 };
  const last = r.samples.at(-1) ?? first;
  const finalGuard = guard.snapshot(agentId);
  const totalCostMicros = calls.reduce((s, c) => s + (c.costMicros ?? 0), 0);
  const budgetIntact = finalGuard.spentMicros === 0 && finalGuard.reservedMicros === 0 && !finalGuard.failClosed && !finalGuard.exhausted && finalGuard.remainingMicros === finalGuard.capMicros;
  const survived = reason === "full-vale-day" && lastObs && !lastObs.you.ghost && lastObs.you.hp > 0;
  const waterExposed = water.ticksAtOrBelow.offer60 > 0 && water.drinkOfferObservations > 0;
  const waterResponded = water.drinkDecisions > 0 && water.thirstRestoreEvents > 0;
  const acceptance = {
    fullDaySurvival: survived,
    zeroRejections: rejections.length === 0,
    zeroInterventions: interventions.length === 0,
    budgetGuardIntact: budgetIntact,
    waterPressureExposed: waterExposed,
    waterPressureResponded: waterResponded,
    pass: survived && rejections.length === 0 && interventions.length === 0 && budgetIntact && waterExposed && waterResponded,
  };
  const savePath = join(dataDir, "shard-save.json");
  const saveSha256 = existsSync(savePath) ? createHash("sha256").update(readFileSync(savePath)).digest("hex") : null;

  // Replay-stable canonical trace (wall-clock excluded): sim-keyed vitals +
  // verb menu per observation, plus sim-keyed decision rows. The independent
  // replay card recomputes this hash from its own run with the same seed.
  const canonicalDecisions = decisions.map((d) => ({ tick: d.observation?.tick, hour: d.observation?.hour, verb: d.row.verb, answer: d.row.answer, outcome: d.row.outcome ?? null }));
  const traceHash = createHash("sha256").update(canonicalObs.map((o) => JSON.stringify(o)).join("\n") + "\n---decisions---\n" + canonicalDecisions.map((d) => JSON.stringify(d)).join("\n")).digest("hex");
  const rawEvidenceHashes = {};
  for (const [name, p] of [["attempts", attemptPath], ["trace", join(rawDir, "trace.jsonl")], ["observations", join(rawDir, "observations.jsonl")], ["feed", join(rawDir, "feed.ndjson")], ["shardLog", join(rawDir, "shard.log")]]) {
    if (existsSync(p)) rawEvidenceHashes[name] = createHash("sha256").update(readFileSync(p)).digest("hex");
  }
  const wallSeconds = (Date.now() - startedWallMs) / 1000;
  const hourlySamples = [];
  let lastHourKey = null;
  for (const s of r.samples) { const k = Math.floor(s.hour); if (k !== lastHourKey) { hourlySamples.push(s); lastHourKey = k; } }
  const compactDecisions = decisions.map((d) => ({ attemptId: d.attemptId, tick: d.observation?.tick, hour: d.observation?.hour, thirst: d.observation?.you?.thirst, hunger: d.observation?.you?.hunger, hp: d.observation?.you?.hp, energy: d.observation?.you?.energy, x: d.observation?.you?.x, z: d.observation?.you?.z, inWater: d.observation?.you?.inWater, drowning: d.observation?.you?.drowning, triggers: (d.exchange?.state?.triggers ?? []).map((t) => t.kind), options: d.exchange?.questions?.[0]?.options ?? [], optionVerbs: d.exchange?.state?.candidateVerbs ?? [], verb: d.row.verb, answer: d.row.answer, outcome: d.row.outcome ?? null }));
  const envelope = {
    schema: "emberhall-water-live-v1",
    task: "t_4e2c4d13",
    scenario: "A",
    paid: PAID,
    backend: BACKEND_ID,
    providerCalls: 0,
    note: "Deterministic local survival scorer (scripted, no Math.random) metered through the real cost seam at a zero tariff. NOT the paid Jev acceptance gate. Scenarios B-D rule coverage is cited from the focused suites and the QA regression report at this revision in review.md.",
    revision, branch, nodeVersion,
    agentId, bodyId: feed.characterId, characterName: charName,
    initialConditions: { seed, port, dataDir, startHour: firstHour, observation: initialObservation },
    config: { scheduler: schedulerConfig, price: ZERO_PRICE, watchdogMs, url },
    reason,
    duration: { startedWallMs, endedWallMs: Date.now(), wallSeconds, simHours: last ? last.hour - first.hour : null, startTick: first?.tick, endTick: last?.tick, ticks: last && first ? last.tick - first.tick : null },
    segments: [{ startMs: first.wallMs, endMs: last.wallMs, startHour: first.hour, endHour: last.hour, mode: "enabled" }],
    acceptance,
    waterExposure: water,
    budget: { final: finalGuard, totalCostMicros, capMicros: finalGuard.capMicros },
    counts: { observations: r.samples.length, decisions: decisions.length, attempts: calls.length, rejections: rejections.length, interventions: interventions.length, errors: errors.length },
    triggerCounts,
    traceHash,
    traceHashBasis: "sha256 over JSON.stringify of each canonical observation {tick,hour,isNight,you:{hp,hunger,thirst,energy,x,z,inWater,drowning,ghost},verbs} joined by newline, then the literal separator line ---decisions---, then canonical decision rows {tick,hour,verb,answer,outcome} joined by newline; wall-clock fields excluded",
    rawEvidenceHashes,
    cost: { totalUsd: 0, totalCostMicros, providerCalls: 0, usage: { promptTokens: 0, completionTokens: 0 }, price: ZERO_PRICE, cadence: { attempts: calls.length, wallSeconds, attemptsPerWallHour: wallSeconds > 0 ? calls.length / (wallSeconds / 3600) : null, observations: r.samples.length, simHours: last ? last.hour - first.hour : null }, projectionNote: "Zero-paid run. The paid wall-day projection is t_0d13c23d's scope; inputs recorded here are attempt cadence, observation count and the zero-tariff price table. The Phase 3.6 paid price record is untouched." },
    samples: hourlySamples, decisions: compactDecisions, calls, rejections, interventions, errors,
    artifacts: { attempts: "raw/attempts.ndjson", trace: "raw/trace.jsonl", observations: "raw/observations.jsonl", feed: "raw/feed.ndjson", shardLog: "raw/shard.log", shardSave: { path: savePath, sha256: saveSha256 } },
  };
  writeFileSync(join(outDir, "report.json"), JSON.stringify(envelope, null, 2));
  // Replay-critical rows committed alongside the report (modest size).
  writeFileSync(join(outDir, "decisions.jsonl"), decisions.map((d) => JSON.stringify({ attemptId: d.attemptId, verb: d.row.verb, answer: d.row.answer, tick: d.observation?.tick, hour: d.observation?.hour, thirst: d.observation?.you?.thirst, hp: d.observation?.you?.hp, outcome: d.row.outcome })).join("\n") + "\n");
  console.log(JSON.stringify({ reason, acceptance, counts: envelope.counts, triggerCounts, water: { thirstMin: water.thirstMin, drinkDecisions: water.drinkDecisions, drinkAckedOk: water.drinkAckedOk, thirstRestoreEvents: water.thirstRestoreEvents, inWaterTicks: water.inWaterTicks }, simHours: envelope.duration.simHours, wallSeconds, traceHash }));
}
