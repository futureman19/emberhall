/**
 * AI-MMO soak driver — two role-driven agents (ranger + smith) living on ONE
 * local authoritative shard for a full vale day (accelerated clock).
 *
 * Extends the P2-C two-client proof harness. CPU-local: no deploy, no paid API.
 * Reflexes use the contract's Jev-shaped builders (choice/noul/score) but the
 * pick is SAMPLED from the normalized weights with a seeded mulberry32 RNG
 * (answerChoice itself is greedy argmax; sampling is what makes a role's whole
 * daily loop visible rather than one dominant verb). The mind slow-path runs
 * through the real runMindExchange pipeline against a scripted local adapter
 * (BYO LLM not provisioned — labeled assumption in the report).
 *
 * Time compression: shard tick driven manually via shard.step(0.1) on a 10ms
 * setInterval. tickWorld clamps dt to 0.1 sim-seconds; SECONDS_PER_HOUR=36, so
 * one vale day = 8640 ticks. Nominal 10x; effective rate is lower under policy
 * load and is measured + reported. All agent mutations cross the authenticated
 * WS wire (hello/intent/verb/ack/obs). Static-terrain targets (trees, rocks,
 * civic buildings) come from a deterministic fixture world (same seed +
 * hydrateWorld as the shard) — the P2-C proof pattern, equivalent to the
 * rendered map a human client reads.
 *
 * Run: node --experimental-strip-types scripts/soak-run.mjs [--days N]
 * Deliverables: .hermes/verification/soak/{soak-report.json,soak-narrative.md}
 * Evidence:     artifacts/soak/{journal-*.jsonl,decisions-*.jsonl,shard.jsonl,checkpoints/}
 */
import { createServer } from "node:net";
import { mkdirSync, rmSync, writeFileSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { WebSocket } from "ws";

import { createShard } from "../src/server/shard.ts";
import { createTransport } from "../src/server/ws.ts";
import { createWorld } from "../src/game/world.ts";
import { hydrateWorld } from "../src/server/hydrate.ts";
import { decodeSave } from "../src/game/save.ts";
import { MAP } from "../src/game/atlas.ts";
import { mulberry32 } from "../src/game/rng.ts";
import { choice, noul, answerNoul, normalize } from "../src/game/agent/reflex.ts";
import { createDecisionLog, hashObservation } from "../src/game/agent/log.ts";
import { runMindExchange } from "../src/game/agent/mind.ts";
import { DEFAULT_CADENCE } from "../src/game/agent/types.ts";

/* ── config ─────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const argOf = (flag, dflt) => { const i = argv.indexOf(flag); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const DAYS = Math.max(1, Number(argOf("--days", "1")) || 1);
const INTERVAL_MS = Math.max(1, Number(argOf("--interval-ms", "10")) || 10);
const TICK_DT = 0.1;
const SECONDS_PER_HOUR = 36;
const TICKS_PER_HOUR = SECONDS_PER_HOUR / TICK_DT;       // 360
const TICKS_PER_DAY = TICKS_PER_HOUR * 24;               // 8640
const TARGET_TICKS = TICKS_PER_DAY * DAYS;
const COMPRESSION = TICK_DT / (INTERVAL_MS / 1000);      // nominal 10x
const CHECKPOINT_TICKS = 300;
const SEED = Number(argOf("--seed", "20261121")) || 20261121;
const REFLEX_USD_PER_CALL = 4 / 86400;     // contract anchor ~$4/agent/day at 1Hz
const QUIET_START = DEFAULT_CADENCE.sleepStartHour;      // 22
const QUIET_END = DEFAULT_CADENCE.sleepEndHour;          // 6
// Decision cadence: the Phase 3.5 cost contract default is 150 ticks
// (reflexCooldownTicks) for PAID reflexes. This soak is an unpaid role loop,
// and chop/mine/hunt are multi-tick WORK beats that a new intent would
// overwrite mid-swing — 60 ticks (6 sim-s) lets each work task run to
// completion before the next decision; this is what makes the role loops real.
const COOLDOWN = 60;
const MIND_HOURS = DEFAULT_CADENCE.mindHeartbeatHours;   // 3
const HUNGRY = 75;                         // eat threshold (hunger decays 3.2/vale-hr)

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "artifacts", "soak", "data");
const OUT_DIR = join(ROOT, "artifacts", "soak");
const DELIVER_DIR = join(ROOT, ".hermes", "verification", "soak");
const CKPT_DIR = join(OUT_DIR, "checkpoints");
for (const d of [DATA_DIR, OUT_DIR, DELIVER_DIR, CKPT_DIR]) mkdirSync(d, { recursive: true });
for (const f of ["shard-save.json", "characters.json"]) { const p = join(DATA_DIR, f); if (existsSync(p)) rmSync(p); }

const KEYS = [
  { name: "ranger", key: "soak-ranger-key-9f3a" },
  { name: "smith", key: "soak-smith-key-7c1d" },
];
const ROLE_PACK = { ranger: readText(join(ROOT, "agent-packs", "ranger.md")), smith: readText(join(ROOT, "agent-packs", "smith.md")) };
const MANUAL = readText(join(ROOT, "docs", "vale-manual.md"));
const DIRECTIVE = {
  ranger: "Live the ranger's day: hunt and track the vale's fauna, skin and loot the kill, eat when hungry, keep the pack stocked, rest at the hall when night falls.",
  smith: "Live the smith's day: mine ore, smelt it at the forge, craft tools and ingots, bank the surplus, equip the right tool, rest at the hall when night falls.",
};
function readText(p) { try { return readFileSync(p, "utf8"); } catch { return ""; } }
function freePort() { return new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); }); }
const nowIso = () => new Date().toISOString();
const round1 = (n) => Math.round(n * 10) / 10;
const round4 = (n) => Math.round(n * 10000) / 10000;
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/* ── stability hooks ────────────────────────────────────────────────── */
const stability = { uncaught: [], unhandled: [], shardErrors: [] };
process.on("uncaughtException", (e) => { stability.uncaught.push({ at: nowIso(), msg: String(e && e.stack || e) }); });
process.on("unhandledRejection", (e) => { stability.unhandled.push({ at: nowIso(), msg: String(e && e.stack || e) }); });

/* ── shard + transport (manual clock) ───────────────────────────────── */
const shardLog = [];
const shardJsonl = join(OUT_DIR, "shard.jsonl");
writeFileSync(shardJsonl, "");
const port = await freePort();
const config = { port, dataDir: DATA_DIR, seed: SEED, keys: KEYS };
const shard = createShard(config, {
  log: (line) => {
    shardLog.push(line);
    appendFileSync(shardJsonl, JSON.stringify({ at: nowIso(), line }) + "\n");
    if (/error|exception|unhandled/i.test(line)) stability.shardErrors.push(line);
  },
});
const transport = createTransport(shard);
const listenPort = await transport.listen(port);
const URL = `ws://127.0.0.1:${listenPort}`;

// Deterministic fixture for static-terrain target selection (P2-C pattern).
const fixture = hydrateWorld(createWorld(SEED));
const TREES = [], ROCKS = [];
for (let ty = 0; ty < fixture.tiles.length; ty++) {
  const row = fixture.tiles[ty];
  for (let tx = 0; tx < row.length; tx++) {
    const k = row[tx]?.kind;
    if (k === "tree") TREES.push({ tx, ty });
    else if (k === "rock") ROCKS.push({ tx, ty });
  }
}
// Civic building coordinates from the fixture (obs buildings are radius-capped,
// so navigation targets must come from the full map, not the observation).
const CIVIC = {};
for (const b of fixture.buildings) if (!CIVIC[b.kind]) CIVIC[b.kind] = { tx: b.tx, ty: b.ty, id: b.id };
const felledKeys = new Set();

/* ── seeded weighted sampling (answerChoice is greedy argmax) ───────── */
function samplePick(weights, rng) {
  const ps = normalize(weights);
  let r = rng(), acc = 0;
  for (let i = 0; i < ps.length; i++) { acc += ps[i]; if (r <= acc) return i; }
  return ps.length - 1;
}

/* ── agent client (P2-C ProofClient wire) ───────────────────────────── */
class AgentClient {
  constructor(role) {
    this.role = role;
    this.key = KEYS.find(k => k.name === role).key;
    this.rng = mulberry32(role === "ranger" ? 0x5a17 : 0x5c1d);
    this.characterId = null; this.obs = null; this.obsCount = 0; this.seq = 0;
    this.pending = new Map(); this.lastLogTail = []; this.simLines = []; this.journal = [];
    this.decisions = createDecisionLog();
    this.lastDecisionTick = -COOLDOWN; this.lastMindBucket = -1;
    this.goals = [role === "ranger" ? "hunt and eat" : "mine and bank"];
    this.mindJournalTail = [];
    this.counts = { intents: 0, verbs: 0, validAccepted: 0, validRejected: 0, invalidSent: 0, invalidRejected: 0, invalidAccepted: 0, refusals: 0 };
    this.actionCounts = {}; this.reflexQuestions = {}; this.mindCalls = 0;
    this.vaultTrail = []; this.equipped = null; this.lastBankTick = -1000;
    this.journalPath = join(OUT_DIR, `journal-${role}.jsonl`);
    this.decisionPath = join(OUT_DIR, `decisions-${role}.jsonl`);
    writeFileSync(this.journalPath, ""); writeFileSync(this.decisionPath, "");
    this.restedAtHall = false;
  }
  connect() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${this.role}: welcome timeout`)), 8000);
      this.ws = new WebSocket(URL);
      this.ws.on("open", () => this.ws.send(JSON.stringify({ type: "hello", apiKey: this.key, client: `soak-${this.role}` })));
      this.ws.on("message", (buf) => {
        let f; try { f = JSON.parse(buf.toString()); } catch { return; }
        if (f.type === "welcome") { clearTimeout(timer); this.characterId = f.characterId; this.obs = f.observation; this.lastLogTail = f.observation?.logTail ?? []; resolve(f); }
        else if (f.type === "ack") { const p = this.pending.get(f.seq); if (p) { this.pending.delete(f.seq); p(f); } }
        else if (f.type === "obs") { this.obs = f.observation; this.obsCount++; this.pumpLog(f.observation); }
        else if (f.type === "error") { const p = this.pending.get(f.seq); if (p) { this.pending.delete(f.seq); p({ ok: false, reason: f.reason || "error" }); } }
      });
      this.ws.on("error", (e) => { clearTimeout(timer); reject(e); });
    });
  }
  pumpLog(obs) {
    const tail = obs?.logTail ?? [];
    let overlap = 0; const max = Math.min(this.lastLogTail.length, tail.length);
    for (let k = max; k > 0; k--) if (this.lastLogTail.slice(-k).join("\n") === tail.slice(0, k).join("\n")) { overlap = k; break; }
    for (const text of tail.slice(overlap)) {
      if (!text) continue;
      this.simLines.push(text);
      const row = { tick: obs.tick, hour: round1(obs.hour), kind: "sim", text };
      this.journal.push(row); appendFileSync(this.journalPath, JSON.stringify(row) + "\n");
    }
    this.lastLogTail = tail;
  }
  send(frame) {
    const seq = ++this.seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.pending.delete(seq); resolve({ ok: false, reason: "ack-timeout" }); }, 6000);
      this.pending.set(seq, (ack) => { clearTimeout(timer); resolve(ack); });
      this.ws.send(JSON.stringify({ ...frame, seq }));
    });
  }
  async intent(kind, tx, ty, targetId = null, spell = null, { valid = true } = {}) {
    const it = { kind, tx: valid ? Math.round(tx) : tx, ty: valid ? Math.round(ty) : ty, targetId, spell };
    const ack = await this.send({ type: "intent", intent: it });
    this.counts.intents++; this.actionCounts[kind] = (this.actionCounts[kind] || 0) + 1;
    if (valid) { this.counts[ack.ok ? "validAccepted" : "validRejected"]++; }
    else { this.counts.invalidSent++; this.counts[ack.ok ? "invalidAccepted" : "invalidRejected"]++; }
    this.logAction("intent", kind, it, ack); return ack;
  }
  async verb(verb, extra = {}, { valid = true } = {}) {
    const req = { verb, item: extra.item ?? null, n: extra.n ?? null, recipeId: extra.recipeId ?? null };
    const ack = await this.send({ type: "verb", verb: req });
    this.counts.verbs++; this.actionCounts[verb] = (this.actionCounts[verb] || 0) + 1;
    if (valid) { this.counts[ack.ok ? "validAccepted" : "validRejected"]++; }
    else { this.counts.invalidSent++; this.counts[ack.ok ? "invalidAccepted" : "invalidRejected"]++; }
    if (verb === "equip" && ack.ok) this.equipped = extra.item;
    this.logAction("verb", verb, req, ack); return ack;
  }
  logAction(lane, kind, payload, ack) {
    const o = this.obs;
    const row = { tick: o?.tick ?? 0, hour: round1(o?.hour ?? 0), kind: lane, action: kind, payload, ok: !!ack.ok, reason: ack.reason ?? null };
    this.journal.push(row); appendFileSync(this.journalPath, JSON.stringify(row) + "\n");
    if (!ack.ok && ack.reason && ack.reason !== "ack-timeout") this.counts.refusals++;
  }
  recordReflex(question, candidates, answer, intent) {
    const o = this.obs;
    this.decisions.append({ tick: o?.tick ?? 0, bodyId: this.characterId ?? this.role, lane: "reflex", question, candidates, answer, intent: intent ?? null, stateHash: o ? hashObservation(o) : "0", outcome: null });
    this.reflexQuestions[question] = (this.reflexQuestions[question] || 0) + 1;
  }
  flushDecisions() { writeFileSync(this.decisionPath, this.decisions.rows.map(r => JSON.stringify(r)).join("\n") + "\n"); }
  get reflexCalls() { return this.decisions.rows.filter(r => r.lane === "reflex").length; }
}

/* ── scripted mind adapter (BYO LLM not provisioned) ────────────────── */
function scriptedAdapter(role) {
  return { async complete() {
    const hour = clients[role]?.obs?.hour ?? 0;
    const goals = role === "ranger" ? ["hunt the vale", "eat when hungry", "bank the surplus hide"] : ["mine ore", "smelt at the forge", "bank ingots and gold"];
    return JSON.stringify({ goals, journalEntry: `${role} marks hour ${round1(hour)}: the vale is quiet, the work continues.`, intentHints: [] });
  } };
}

/* ── policy helpers ─────────────────────────────────────────────────── */
const clients = {};
function nearest(list, x, z, maxD, skipFelled) {
  let best = null, bd = maxD;
  for (const t of list) { if (skipFelled && felledKeys.has(`${t.tx},${t.ty}`)) continue; const d = dist(x, z, t.tx, t.ty); if (d < bd) { bd = d; best = t; } }
  return best ? { ...best, dist: bd } : null;
}
function obsBuilding(obs, kinds, maxD = 60) { let best = null, bd = maxD; for (const b of obs.buildings) if (kinds.includes(b.kind) && b.dist < bd) { bd = b.dist; best = b; } return best; }
function civic(kind) { return CIVIC[kind] ?? null; }
function nearestFauna(obs, maxD = 28) { let best = null, bd = maxD; for (const c of obs.fauna) { if (c.hp <= 0 || c.ownerId) continue; if (c.dist < bd) { bd = c.dist; best = c; } } return best; }
function nearestPile(obs, maxD = 28) { let best = null, bd = maxD; for (const p of obs.piles) if (p.dist < bd) { bd = p.dist; best = p; } return best; }
function foodIn(pack) { for (const id of ["cabbage", "trail_rations", "bread", "cooked_meat", "meat", "apple"]) if ((pack[id] ?? 0) > 0) return id; return null; }
const isQuiet = (hour) => hour >= QUIET_START || hour < QUIET_END;
const inDanger = (o) => o.you.hp < o.you.maxHp * 0.3 || o.you.hunger < 12;
async function walkAndAct(c, tx, ty, reach, actFn) {
  const o = c.obs; const d = dist(o.you.x, o.you.z, tx, ty);
  if (d > reach) { await c.intent("walk", tx, ty); return "walking"; }
  return await actFn();
}

/* Ranger: hunt / track / skin / loot / eat / chop / rest (sampled). */
async function rangerDecide(c) {
  const o = c.obs; const pack = o.you.pack; const food = foodIn(pack);
  const fauna = nearestFauna(o); const pile = nearestPile(o); const hungry = o.you.hunger < HUNGRY;

  if (inDanger(o) || (hungry && food && o.you.hunger < 55)) {
    const q = noul("eat-now", "Is the body hungry enough to eat now?");
    const p = Math.min(1, Math.max(0, (80 - o.you.hunger) / 80));
    const a = answerNoul(q, p);
    c.recordReflex(q.question, ["yes", "no"], a.p >= 0.5 ? "yes" : "no", null);
    if (a.p >= 0.5 && food) { await c.verb("eat", { item: food }); return; }
    if (inDanger(o)) { const hall = civic("hall") ?? obsBuilding(o, ["hall", "bank"], 200); if (hall) await c.intent("walk", hall.tx, hall.ty); return; }
  }
  if (isQuiet(o.hour) && !inDanger(o)) {
    const hall = civic("hall");
    if (hall && !c.restedAtHall) { await c.intent("walk", hall.tx, hall.ty); c.restedAtHall = true; c.recordReflex("rest-at-night?", ["rest", "roam"], "rest", null); return; }
    c.recordReflex("quiet-window", ["rest", "roam"], "rest", null);
    await c.intent("none", o.you.x, o.you.z); return;
  }
  c.restedAtHall = false;

  const options = ["hunt", "loot", "track", "chop", "eat", "wander"];
  const weights = [fauna ? 7 : 0, pile ? 5 : 0, 3, 3, hungry && food ? 6 : 1, 2];
  const q = choice("ranger-action", "What should the ranger do now?", options);
  const pick = options[samplePick(weights, c.rng)];
  c.recordReflex(q.question, options, pick, null);

  if (pick === "hunt" && fauna) {
    await walkAndAct(c, fauna.x, fauna.z, 1.5, async () => { await c.intent("hunt", fauna.x, fauna.z, fauna.id); return "hunt"; });
  } else if (pick === "loot" && pile) {
    await walkAndAct(c, pile.tx, pile.ty, 1.5, async () => {
      if (/corpse|hide|carcass/i.test(pile.label)) await c.intent("skin", pile.tx, pile.ty, pile.id);
      else await c.intent("loot", pile.tx, pile.ty, pile.id);
      return "loot";
    });
  } else if (pick === "track") {
    await c.verb("track");
  } else if (pick === "eat" && food) {
    await c.verb("eat", { item: food });
  } else if (pick === "chop") {
    if ((c.equipped ?? o.you.wear?.main) !== "hatchet" && (pack.hatchet ?? 0) > 0) await c.verb("equip", { item: "hatchet" });
    const tree = nearest(TREES, o.you.x, o.you.z, 70, true);
    if (tree) await walkAndAct(c, tree.tx, tree.ty, 1.5, async () => { await c.intent("chop", tree.tx, tree.ty); return "chop"; });
    else await c.intent("walk", o.you.x + 6, o.you.z + 6);
  } else {
    const ang = (o.tick % 16) / 16 * Math.PI * 2;
    await c.intent("walk", o.you.x + Math.cos(ang) * 8, o.you.z + Math.sin(ang) * 8);
  }
}

/* Smith: mine / smelt / craft / bank / equip / rest (sampled, fixture nav). */
async function smithDecide(c) {
  const o = c.obs; const pack = o.you.pack;
  const ore = pack.ore ?? 0; const ingot = pack.ingot ?? 0;
  const forge = civic("forge"); const bank = civic("bank"); const hall = civic("hall");
  const rock = nearest(ROCKS, o.you.x, o.you.z, 200, true);
  const periodicBank = o.tick - c.lastBankTick > 500;

  if (isQuiet(o.hour) && !inDanger(o)) {
    if (hall && !c.restedAtHall) { await c.intent("walk", hall.tx, hall.ty); c.restedAtHall = true; c.recordReflex("rest-at-night?", ["rest", "work"], "rest", null); return; }
    c.recordReflex("quiet-window", ["rest", "work"], "rest", null);
    await c.intent("none", o.you.x, o.you.z); return;
  }
  c.restedAtHall = false;

  const options = ["mine", "smelt", "craft", "bank", "equip", "wander"];
  const weights = [
    rock ? 6 : 1,
    ore > 0 && forge ? 7 : 0,
    ingot >= 4 ? 5 : 0,
    bank && (ingot > 2 || ore > 4 || o.you.vault > 0 || periodicBank) ? 6 : 0,
    2,
    1,
  ];
  const q = choice("smith-action", "What should the smith do now?", options);
  const pick = options[samplePick(weights, c.rng)];
  c.recordReflex(q.question, options, pick, null);

  if (pick === "smelt" && forge && ore > 0) {
    await walkAndAct(c, forge.tx, forge.ty, 2.8, async () => { await c.verb("craft", { recipeId: "smelt" }); return "smelt"; });
  } else if (pick === "craft" && ingot >= 4) {
    const station = civic("yard") ?? forge ?? hall;
    const recipe = (pack.pick ?? 0) < 2 ? "pick" : "hatchet";
    if (station) await walkAndAct(c, station.tx, station.ty, 2.8, async () => { await c.verb("craft", { recipeId: recipe }); return "craft"; });
  } else if (pick === "bank" && bank) {
    await walkAndAct(c, bank.tx, bank.ty, 2.4, async () => {
      const before = o.you.vault;
      await c.verb("bank_gold");
      if ((pack.ingot ?? 0) > 2) await c.verb("bank_item", { item: "ingot", n: (pack.ingot ?? 0) - 2 });
      if ((pack.ore ?? 0) > 4) await c.verb("bank_item", { item: "ore", n: (pack.ore ?? 0) - 4 });
      c.lastBankTick = o.tick;
      c.vaultTrail.push({ tick: o.tick, before, after: c.obs?.you?.vault ?? before });
      return "bank";
    });
  } else if (pick === "equip") {
    const tool = "pick";
    if ((pack[tool] ?? 0) > 0 && c.equipped !== tool) await c.verb("equip", { item: tool });
    else await c.intent("walk", o.you.x + 4, o.you.z);
  } else if (pick === "mine" && rock) {
    if ((c.equipped ?? o.you.wear?.main) !== "pick" && (pack.pick ?? 0) > 0) await c.verb("equip", { item: "pick" });
    await walkAndAct(c, rock.tx, rock.ty, 1.5, async () => { await c.intent("mine", rock.tx, rock.ty); return "mine"; });
  } else {
    const target = forge ?? rock ?? hall;
    if (target) await c.intent("walk", target.tx, target.ty);
    else await c.intent("walk", o.you.x + 5, o.you.z + 5);
  }
}
const POLICY = { ranger: rangerDecide, smith: smithDecide };

/* ── economy audit ──────────────────────────────────────────────────── */
const economy = { checkpoints: [], violations: [], goldStart: null, goldEnd: null, itemStart: null, itemEnd: null };
function totals(W) {
  let gold = W.gold ?? 0; const items = {};
  const addItems = (map) => { for (const [k, v] of Object.entries(map ?? {})) if (typeof v === "number") items[k] = (items[k] || 0) + v; };
  for (const ps of Object.values(W.playerStates ?? {})) { gold += ps.vault ?? 0; addItems(ps.pack); }
  for (const b of W.buildings ?? []) if (b.chest) { addItems(b.chest.items ?? b.chest); gold += b.chest.gold ?? 0; }
  for (const p of W.piles ?? []) { gold += p.gold ?? 0; addItems(p.items); }
  return { gold, items };
}
function auditCheckpoint(tick) {
  let W; try { W = decodeSave(shard.checkpoint()); } catch (e) { stability.shardErrors.push("checkpoint decode: " + e); return; }
  if (!W) { economy.violations.push({ tick, kind: "decode-null" }); return; }
  const t = totals(W);
  for (const [key, node] of Object.entries(W.resourceNodes ?? {})) {
    if (node && node.state === "felled") felledKeys.add(key);
    else if (node && node.state === "standing") felledKeys.delete(key);
  }
  const prev = economy.checkpoints[economy.checkpoints.length - 1];
  if (prev) {
    if (t.gold < prev.gold - 1e-6) economy.violations.push({ tick, kind: "gold-decrease", from: prev.gold, to: t.gold });
    for (const [k, v] of Object.entries(t.items)) if (v < 0) economy.violations.push({ tick, kind: "negative-item", item: k, n: v });
    if (t.gold < 0) economy.violations.push({ tick, kind: "negative-gold", n: t.gold });
  }
  for (const ps of Object.values(W.playerStates ?? {})) {
    if ((ps.vault ?? 0) < 0) economy.violations.push({ tick, kind: "negative-vault", n: ps.vault });
    for (const [k, v] of Object.entries(ps.pack ?? {})) if (v < 0) economy.violations.push({ tick, kind: "negative-pack", item: k, n: v });
  }
  const mem = process.memoryUsage();
  const handles = typeof process._getActiveHandles === "function" ? process._getActiveHandles().length : null;
  const row = { tick, gold: t.gold, items: t.items, heapMB: round1(mem.heapUsed / 1048576), rssMB: round1(mem.rss / 1048576), handles, felledNodes: felledKeys.size };
  economy.checkpoints.push(row);
  if (economy.goldStart === null) { economy.goldStart = t.gold; economy.itemStart = t.items; }
  economy.goldEnd = t.gold; economy.itemEnd = t.items;
  writeFileSync(join(CKPT_DIR, `ckpt-${tick}.json`), JSON.stringify(row, null, 2));
}

/* ── invalid-intent authority probes ────────────────────────────────── */
async function invalidProbe(c) {
  const probes = [
    { kind: "fly", tx: 10, ty: 10 },
    { kind: "walk", tx: -1, ty: 10 },
    { kind: "walk", tx: MAP + 50, ty: 10 },
    { kind: "chop", tx: 1.5, ty: 10 },
  ];
  const p = probes[c.counts.invalidSent % probes.length];
  await c.intent(p.kind, p.tx, p.ty, null, null, { valid: false });
}

/* ── mind heartbeat ─────────────────────────────────────────────────── */
async function mindHeartbeat(c) {
  const o = c.obs; if (!o) return;
  const req = { directive: DIRECTIVE[c.role], rolePack: ROLE_PACK[c.role], manual: MANUAL, observation: o, goals: c.goals, journalTail: c.mindJournalTail.slice(-6) };
  const res = await runMindExchange(req, scriptedAdapter(c.role), { timeoutMs: 2000 });
  c.mindCalls++; c.goals = res.goals;
  if (res.journalEntry) {
    c.mindJournalTail.push(res.journalEntry);
    const row = { tick: o.tick, hour: round1(o.hour), kind: "mind", text: res.journalEntry };
    c.journal.push(row); appendFileSync(c.journalPath, JSON.stringify(row) + "\n");
  }
  c.decisions.append({ tick: o.tick, bodyId: c.characterId ?? c.role, lane: "mind", question: "mind-heartbeat: standing goals + journal", candidates: res.goals, answer: res.journalEntry || "(degraded)", intent: null, stateHash: hashObservation(o), outcome: null });
}

/* ── main loop ──────────────────────────────────────────────────────── */
const startedAt = nowIso(); const startWall = Date.now();
let lastCheckpointTick = 0, lastProbeTick = 0, finished = false;
for (const role of ["ranger", "smith"]) { clients[role] = new AgentClient(role); await clients[role].connect(); }
const characterIds = { ranger: clients.ranger.characterId, smith: clients.smith.characterId };
// Boot tool equip so the work loops are not refused for a bare hand.
await clients.smith.verb("equip", { item: "pick" });
await clients.ranger.verb("equip", { item: "hatchet" });

function perTick() {
  if (finished) return;
  const tick = shard.status().tick;
  for (const role of ["ranger", "smith"]) {
    const c = clients[role]; const o = c.obs; if (!o) continue;
    const bucket = Math.floor(o.hour / MIND_HOURS);
    if (bucket !== c.lastMindBucket) { c.lastMindBucket = bucket; void mindHeartbeat(c).catch(e => stability.shardErrors.push(`mind ${role}: ${e}`)); }
    if (tick - c.lastDecisionTick >= COOLDOWN) { c.lastDecisionTick = tick; void POLICY[role](c).catch(e => stability.shardErrors.push(`policy ${role}: ${e}`)); }
  }
  if (tick - lastCheckpointTick >= CHECKPOINT_TICKS) { lastCheckpointTick = tick; auditCheckpoint(tick); }
  if (tick - lastProbeTick >= 1000) { lastProbeTick = tick; for (const role of ["ranger", "smith"]) void invalidProbe(clients[role]).catch(e => stability.shardErrors.push(`probe ${role}: ${e}`)); }
  if (tick >= TARGET_TICKS) void finish();
}
const clock = setInterval(() => { try { shard.step(TICK_DT); perTick(); } catch (e) { stability.shardErrors.push("step: " + e); } }, INTERVAL_MS);

/* ── finish + report ────────────────────────────────────────────────── */
async function finish() {
  if (finished) return; finished = true;
  clearInterval(clock);
  const finalTick = shard.status().tick;
  auditCheckpoint(finalTick);
  for (const role of ["ranger", "smith"]) clients[role].flushDecisions();
  try { await transport.close(); } catch (e) { stability.shardErrors.push("close: " + e); }
  try { shard.stop(); } catch (e) { stability.shardErrors.push("stop: " + e); }
  const realSeconds = round1((Date.now() - startWall) / 1000);
  const effectiveTicksPerSec = round1(finalTick / Math.max(1, realSeconds));

  const agents = ["ranger", "smith"].map(role => {
    const c = clients[role];
    const top5 = Object.entries(c.reflexQuestions).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([q, n]) => ({ question: q, count: n }));
    return {
      role, characterId: c.characterId, reflexCalls: c.reflexCalls, mindCalls: c.mindCalls,
      estUsdPerValeDay: round4(c.reflexCalls * REFLEX_USD_PER_CALL),
      top5Questions: top5, actionCounts: c.actionCounts, counts: c.counts,
      obsFrames: c.obsCount, journalLines: c.journal.length, vaultTrail: c.vaultTrail.slice(-8),
    };
  });

  const authority = {
    validAccepted: agents.reduce((a, x) => a + x.counts.validAccepted, 0),
    validRejected: agents.reduce((a, x) => a + x.counts.validRejected, 0),
    invalidSent: agents.reduce((a, x) => a + x.counts.invalidSent, 0),
    invalidRejected: agents.reduce((a, x) => a + x.counts.invalidRejected, 0),
    invalidAccepted: agents.reduce((a, x) => a + x.counts.invalidAccepted, 0),
    pass: agents.every(x => x.counts.invalidAccepted === 0) && agents.reduce((a, x) => a + x.counts.validRejected, 0) === 0,
  };
  const econPass = economy.violations.length === 0 && economy.goldEnd >= economy.goldStart;
  const rangerActions = clients.ranger.actionCounts, smithActions = clients.smith.actionCounts;
  const rangerLoop = ["hunt", "track", "eat"].filter(k => (rangerActions[k] ?? 0) > 0);
  const smithLoop = ["mine", "craft", "bank_gold"].filter(k => (smithActions[k] ?? 0) > 0);
  const roleLoops = {
    ranger: { visible: rangerLoop, counts: rangerActions, pass: rangerLoop.length >= 2 },
    smith: { visible: smithLoop, counts: smithActions, pass: smithLoop.length >= 2 },
    pass: rangerLoop.length >= 2 && smithLoop.length >= 2,
    sleepGap: "No player sleep verb exists in the sim (energy never regenerates; hall beds are legacy occupancy). Smith/ranger night-rest is idle at the hall, not sleep. Content gap flagged for the controller.",
  };
  const costShape = {
    reflexUsdPerCall: REFLEX_USD_PER_CALL, anchor: "contract ~$4/agent/day at 1Hz polling (86400 calls/day)",
    perAgent: agents.map(a => ({ role: a.role, reflexCalls: a.reflexCalls, mindCalls: a.mindCalls, estUsdPerValeDay: a.estUsdPerValeDay, top5: a.top5Questions })),
    gateUsdPerAgentDay: 0.5, pass: agents.every(a => a.estUsdPerValeDay <= 0.5),
    mindAssumption: "Mind slow-path exercised via runMindExchange against a scripted local adapter (no paid LLM provisioned). External mind cost = $0 here; BYO endpoint cost is the owner's and not modeled.",
  };
  const mem0 = economy.checkpoints[0], memN = economy.checkpoints[economy.checkpoints.length - 1];
  const stabilityReport = {
    uncaughtExceptions: stability.uncaught.length, unhandledRejections: stability.unhandled.length,
    shardErrorLines: stability.shardErrors.length,
    heapMB: { start: mem0?.heapMB ?? null, end: memN?.heapMB ?? null, peak: Math.max(0, ...economy.checkpoints.map(c => c.heapMB ?? 0)) },
    handles: { start: mem0?.handles ?? null, end: memN?.handles ?? null },
    pass: stability.uncaught.length === 0 && stability.unhandled.length === 0 && stability.shardErrors.length === 0,
    detail: stability,
  };

  const report = {
    lane: "qwen", task: "t_8b32a7bd", mission: "AI-MMO soak: 24h role-agent run (ranger + smith)",
    baseSha: "e7593e6", branch: "wt/t_3b1e4b19", worktree: ".worktrees/t_3b1e4b19",
    seed: SEED, startedAt, finishedAt: nowIso(), realSeconds,
    compression: {
      tickDtSimSeconds: TICK_DT, intervalMs: INTERVAL_MS, nominalFactor: COMPRESSION,
      effectiveTicksPerRealSecond: effectiveTicksPerSec, effectiveFactor: round1(effectiveTicksPerSec * TICK_DT),
      secondsPerHour: SECONDS_PER_HOUR, ticksPerValeDay: TICKS_PER_DAY,
      targetTicks: TARGET_TICKS, actualTicks: finalTick, valeDays: DAYS,
      valeHoursPerRealSecond: round1(effectiveTicksPerSec * TICK_DT / SECONDS_PER_HOUR),
      note: `shard.step(${TICK_DT}) every ${INTERVAL_MS}ms (nominal ${COMPRESSION}x); measured ${effectiveTicksPerSec} ticks/real-s = ${round1(effectiveTicksPerSec * TICK_DT)}x effective under policy load. 1 vale day = ${TICKS_PER_DAY} ticks.`,
    },
    agents, characterIds,
    assertions: { authority, economy: { ...economy, pass: econPass }, roleLoops, costShape, stability: stabilityReport },
    findings: [
      "world.gold is a SINGLE GLOBAL purse, not per-player: commandBankGold sweeps the entire purse into the acting player's vault (bank.ts). With two agents, whoever banks first collects both agents' loot gold. Conservation holds (no duplication) but attribution is wrong for multi-agent. SIM-level economy gap — flagged, not drive-by fixed.",
      "No player sleep mechanic: CtxVerb has no sleep; energy only decays (sim.ts) and never regenerates; hall/dorm beds carry legacy occupantId with no rest command. The smith pack's 'sleeps' loop cannot run as written; night-rest is idle at the hall. Content gap.",
      "Reflexes use the contract's choice/noul builders but the pick is sampled (seeded mulberry32) from normalized weights — answerChoice is greedy argmax, which collapses a role to one dominant verb. Mind via scripted local adapter through the real runMindExchange pipeline. Cost is the contract's modeled estimate, not a billed amount.",
    ],
    blockers: [],
    artifacts: {
      report: ".hermes/verification/soak/soak-report.json", narrative: ".hermes/verification/soak/soak-narrative.md",
      journals: ["artifacts/soak/journal-ranger.jsonl", "artifacts/soak/journal-smith.jsonl"],
      decisions: ["artifacts/soak/decisions-ranger.jsonl", "artifacts/soak/decisions-smith.jsonl"],
      shardLog: "artifacts/soak/shard.jsonl", checkpoints: "artifacts/soak/checkpoints/", driver: "scripts/soak-run.mjs",
    },
    reproduce: "node --experimental-strip-types scripts/soak-run.mjs --days 1",
  };
  writeFileSync(join(DELIVER_DIR, "soak-report.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(DELIVER_DIR, "soak-narrative.md"), narrative(report));
  console.log(JSON.stringify({ done: true, finalTick, realSeconds, effectiveTicksPerSec, authority: authority.pass, economy: econPass, roleLoops: roleLoops.pass, cost: costShape.pass, stability: stabilityReport.pass }));
  process.exit(0);
}

function narrative(r) {
  const a = r.assertions; const line = (ok) => ok ? "PASS" : "FAIL";
  return [
    `# AI-MMO soak — ranger + smith on one local shard`, ``,
    `**Lane** ${r.lane} · **task** ${r.task} · **base** ${r.baseSha} · **branch** ${r.branch}`,
    `**Seed** ${r.seed} · **vale days** ${r.compression.valeDays} · **ticks** ${r.compression.actualTicks}/${r.compression.targetTicks} · **real seconds** ${r.realSeconds}`, ``,
    `## Time compression`, `${r.compression.note}`,
    `Nominal **${r.compression.nominalFactor}x**, measured **${r.compression.effectiveFactor}x** (${r.compression.effectiveTicksPerRealSecond} ticks/real-s, ~${r.compression.valeHoursPerRealSecond} vale hours/real-s). SECONDS_PER_HOUR=${r.compression.secondsPerHour}, ${r.compression.ticksPerValeDay} ticks/vale day. The shard tick is driven manually (shard.step), never wall-clock; all agent mutations still cross the authenticated WS wire.`, ``,
    `## Five assertions`,
    `1. **Authority — ${line(a.authority.pass)}**: valid accepted ${a.authority.validAccepted}, valid rejected ${a.authority.validRejected}, invalid sent ${a.authority.invalidSent}, invalid rejected ${a.authority.invalidRejected}, invalid accepted ${a.authority.invalidAccepted}.`,
    `2. **Economy — ${line(a.economy.pass)}**: gold start ${a.economy.goldStart} → end ${a.economy.goldEnd}; violations ${a.economy.violations.length}; felled nodes tracked ${a.economy.checkpoints.at(-1)?.felledNodes ?? 0}; checkpoints ${a.economy.checkpoints.length}.`,
    `3. **Role loops — ${line(a.roleLoops.pass)}**: ranger visible [${a.roleLoops.ranger.visible.join(", ")}]; smith visible [${a.roleLoops.smith.visible.join(", ")}]. ${a.roleLoops.sleepGap}`,
    `4. **Cost shape — ${line(a.costShape.pass)}**: ${a.costShape.perAgent.map(p => `${p.role} ${p.reflexCalls} reflex calls ≈ $${p.estUsdPerValeDay}/vale-day, ${p.mindCalls} mind calls`).join("; ")}. Gate $${a.costShape.gateUsdPerAgentDay}/agent/day. ${a.costShape.mindAssumption}`,
    `5. **Stability — ${line(a.stability.pass)}**: uncaught ${a.stability.uncaughtExceptions}, unhandled ${a.stability.unhandledRejections}, shard error lines ${a.stability.shardErrorLines}; heap ${a.stability.heapMB.start}→${a.stability.heapMB.end} MB (peak ${a.stability.heapMB.peak}); handles ${a.stability.handles.start}→${a.stability.handles.end}.`, ``,
    `## Top reflex questions`,
    ...a.costShape.perAgent.map(p => `- **${p.role}**: ${p.top5.map(t => `"${t.question}" ×${t.count}`).join("; ") || "(none)"}`), ``,
    `## Findings (SIM-level, flagged not fixed)`, ...r.findings.map(f => `- ${f}`), ``,
    `## Blockers`, r.blockers.length ? r.blockers.map(b => `- ${b}`).join("\n") : "- none", ``,
    `## Reproduce`, "```", r.reproduce, "```",
    `Evidence: ${r.artifacts.journals.join(", ")}; ${r.artifacts.decisions.join(", ")}; ${r.artifacts.shardLog}; ${r.artifacts.checkpoints}.`, ``,
  ].join("\n");
}

// Watchdog: generous ms budget (nominal run ~ TARGET_TICKS*INTERVAL_MS ms; allow 6x + 2min).
setTimeout(() => { if (!finished) { stability.shardErrors.push("watchdog: forced finish"); void finish(); } }, TARGET_TICKS * INTERVAL_MS * 6 + 120000);
console.log(JSON.stringify({ started: true, url: URL, seed: SEED, targetTicks: TARGET_TICKS, nominalCompression: COMPRESSION, characterIds, civic: CIVIC }));