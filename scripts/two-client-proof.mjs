#!/usr/bin/env node
/**
 * AI-MMO P2-C — the locked two-client proof (local shard).
 *
 * Read-only judge for the Phase 2 exit gate against the P2-A host core +
 * P2-B WebSocket/auth transport. Boots `src/server/main.ts` as a child
 * process on an ephemeral port with a temp data dir and a fixed seed, then
 * drives two real WebSocket clients through the pinned wire protocol:
 *
 *   C->S {type:"hello",apiKey} | {type:"intent",seq,intent:{kind,tx,ty,...}}
 *   S->C {type:"welcome",characterId,name,tick,observation}
 *        {type:"ack",seq,ok,reason?} | {type:"obs",observation}
 *        {type:"error",reason} + close
 *
 * Steps: boot/healthz, two welcomes + cross-observation, symmetric walk
 * proof, exactly-once tree fell (shared logTail + pack deltas + persisted
 * resources), SIGTERM/reboot recovery on the same data dir, evidence JSON.
 *
 * Usage (local, the gate):
 *   node scripts/two-client-proof.mjs [--port 0] [--seed 1977]
 *        [--keys kett:proof-kett,bran:proof-bran] [--data-dir DIR]
 *        [--evidence PATH]
 *
 * Remote reuse (P2-D, against a Fly deploy — no child boot, step 5 becomes
 * a disconnect/reconnect persistence check; --seed MUST match the deploy's
 * EMBERHALL_SEED so the fixture world picks the same tree):
 *   node scripts/two-client-proof.mjs --url wss://<fly-app>.fly.dev \
 *        [--http-base https://<fly-app>.fly.dev] [--seed 1977]
 *
 * No new runtime deps: Node >= 22 built-in WebSocket/fetch; the fixture
 * world imports the repo's own .ts modules (Node type stripping).
 * This script never edits src/**; a shard defect is reported, not patched.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DEFAULT_SEED = 1977;
const DEFAULT_KEYS = "kett:proof-kett,bran:proof-bran";
const DEFAULT_EVIDENCE = path.join(ROOT, ".hermes", "verification", "p2", "two-client-proof.json");
const WORK_REACH = 2.4; // src/game/player.ts
const SPAWN = { tx: 256, ty: 293 }; // COURT (256,292) + 1, shard.ts createPerson
const FRAME_TYPES = new Set(["welcome", "ack", "obs", "error"]);
const IS_WIN = process.platform === "win32";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const round1 = (n) => Math.round(n * 10) / 10;

class ProofFailure extends Error {}

function fail(message) {
  throw new ProofFailure(message);
}

async function waitFor(label, timeoutMs, probe, intervalMs = 60) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value !== undefined && value !== null && value !== false) return value;
    if (Date.now() > deadline) fail(`timeout after ${timeoutMs}ms waiting for ${label}`);
    await sleep(intervalMs);
  }
}

function parseKeys(spec) {
  const pairs = spec.split(",").map((pair) => {
    const split = pair.indexOf(":");
    if (split < 1) fail(`invalid key pair: ${pair}`);
    return { name: pair.slice(0, split).trim(), key: pair.slice(split + 1) };
  });
  if (pairs.length !== 2) fail("the locked proof needs exactly two characters");
  return pairs;
}

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/* ------------------------------------------------------------------ */
/* Fixture world: same seed + hydrate path as the shard, used only to  */
/* SELECT test inputs (walk destinations, one wild tree + stands).     */
/* P2-B observations carry no tiles/resources fields, so the tree      */
/* cannot be located from the wire; every ASSERTION still reads        */
/* observations (or the persisted save, labelled as such).             */
/* ------------------------------------------------------------------ */
async function loadFixture(seed) {
  const ts = (rel) => pathToFileURL(path.join(ROOT, rel)).href;
  const { createWorld } = await import(ts("src/game/world.ts"));
  const { hydrateWorld } = await import(ts("src/server/hydrate.ts"));
  const { assessResourceHarvest, harvestToolTier } = await import(ts("src/game/resources/harvest.ts"));
  const { astar, walkable } = await import(ts("src/game/pathfinding.ts"));
  const world = hydrateWorld(createWorld(seed));
  const toolTier = harvestToolTier({ nodeKind: "tree", tool: "hatchet" });
  return { world, assessResourceHarvest, astar, walkable, toolTier, seed };
}

function tileAt(fixture, tx, ty) {
  return fixture.world.tiles[ty * fixture.world.w + tx];
}

function pickWalkDest(fixture, from, avoid) {
  const candidates = [];
  for (let dy = -8; dy <= 8; dy += 1) {
    for (let dx = -8; dx <= 8; dx += 1) {
      const tx = Math.round(from.x) + dx;
      const ty = Math.round(from.z) + dy;
      const d = dist(tx, ty, from.x, from.z);
      if (d < 4 || d > 8) continue;
      if (avoid.some((a) => dist(tx, ty, a.tx, a.ty) < 3)) continue;
      if (!fixture.walkable(fixture.world, tx, ty)) continue;
      const kind = tileAt(fixture, tx, ty)?.kind;
      if (!["grass", "dirt", "cobble", "road", "sand", "floor"].includes(kind)) continue;
      candidates.push({ tx, ty });
    }
  }
  for (const cand of candidates) {
    const pathFound = fixture.astar(fixture.world, from.x, from.z, cand.tx, cand.ty);
    if (pathFound && pathFound.length > 0) return cand;
  }
  fail(`no walkable destination 4..8 tiles from (${from.x},${from.z})`);
}

function pickTree(fixture, bodies) {
  const { world, assessResourceHarvest, toolTier, seed } = fixture;
  const candidates = [];
  for (let r = 2; r <= 16; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = SPAWN.tx + dx;
        const ty = SPAWN.ty + dy;
        if (tileAt(fixture, tx, ty)?.kind !== "tree") continue;
        const assessment = assessResourceHarvest({
          seed, tx, ty, nodeKind: "tree", effectiveSkill: 14, discovered: true, toolTier,
        });
        if (assessment.status !== "ready") continue;
        const stands = [];
        for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const stand = { tx: tx + sx, ty: ty + sy };
          if (!fixture.walkable(world, stand.tx, stand.ty)) continue;
          if (bodies.every((b) => fixture.astar(world, b.x, b.z, stand.tx, stand.ty)?.length > 0)) {
            stands.push(stand);
          }
        }
        if (stands.length === 0) continue;
        candidates.push({
          tx, ty,
          resourceId: assessment.identity.resourceId,
          stands: [stands[0], stands[1] ?? stands[0]],
          preferred: assessment.identity.resourceId === "oak",
        });
      }
    }
    const oak = candidates.find((c) => c.preferred);
    if (oak) return oak;
    if (candidates.length > 0) return candidates[0];
  }
  fail("no harvestable wild tree within 16 tiles of spawn for lumberjack 14 + hatchet");
}

/* ------------------------------------------------------------------ */
/* WebSocket client (Node built-in WebSocket).                         */
/* ------------------------------------------------------------------ */
class ProofClient {
  constructor(name, key, url) {
    this.name = name;
    this.key = key;
    this.url = url;
    this.seq = 0;
    this.welcome = null;
    this.acks = new Map();
    this.obs = [];
    this.violations = [];
    this.closeInfo = null;
    this.errorText = null;
    this.prevTail = null;
    this.ws = null;
    this.onEvents = null; // (client, newLines, tick) => void
  }

  connect(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new ProofFailure(`${this.name}: welcome timeout`)), timeoutMs);
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ type: "hello", apiKey: this.key }));
      });
      ws.addEventListener("message", (event) => {
        let frame;
        try {
          frame = JSON.parse(String(event.data));
        } catch {
          this.violations.push(`non-JSON frame: ${String(event.data).slice(0, 120)}`);
          return;
        }
        if (!frame || !FRAME_TYPES.has(frame.type)) {
          this.violations.push(`unknown frame type: ${JSON.stringify(frame).slice(0, 120)}`);
          return;
        }
        if (frame.type === "welcome") {
          this.welcome = frame;
          this.prevTail = frame.observation?.logTail ?? [];
          clearTimeout(timer);
          resolve(frame);
        } else if (frame.type === "ack") {
          this.acks.set(frame.seq, frame);
        } else if (frame.type === "obs") {
          this.obs.push({ receivedAt: Date.now(), observation: frame.observation });
          this.pumpLog(frame.observation);
        } else if (frame.type === "error") {
          this.errorText = frame.reason;
        }
      });
      ws.addEventListener("close", (event) => {
        this.closeInfo = { code: event.code, reason: event.reason };
        clearTimeout(timer);
        reject(new ProofFailure(`${this.name}: socket closed before welcome (${event.code} ${event.reason})`));
      });
      ws.addEventListener("error", () => {
        this.errorText = this.errorText ?? "websocket error";
      });
    });
  }

  /** Exact physical new log lines: suffix-diff the sliding 20-entry tail. */
  pumpLog(observation) {
    const tail = observation.logTail ?? [];
    const prev = this.prevTail ?? [];
    this.prevTail = tail;
    let shift = prev.length;
    for (let s = 0; s <= prev.length; s += 1) {
      const overlap = prev.length - s;
      if (overlap > tail.length) continue;
      let match = true;
      for (let i = 0; i < overlap; i += 1) {
        if (prev[s + i] !== tail[i]) { match = false; break; }
      }
      if (match) { shift = s; break; }
    }
    const fresh = tail.slice(prev.length - shift);
    if (fresh.length > 0 && this.onEvents) this.onEvents(this, fresh, observation.tick);
  }

  sendIntent(intent) {
    this.seq += 1;
    this.ws.send(JSON.stringify({ type: "intent", seq: this.seq, intent }));
    return this.seq;
  }

  async waitAck(seq, timeoutMs = 6000) {
    return waitFor(`${this.name} ack seq=${seq}`, timeoutMs, () => this.acks.get(seq) ?? null);
  }

  latest() {
    return this.obs.length > 0 ? this.obs[this.obs.length - 1].observation : this.welcome?.observation;
  }

  person(id) {
    return this.latest()?.people.find((p) => p.id === id) ?? null;
  }

  async waitObs(label, timeoutMs, predicate) {
    return waitFor(label, timeoutMs, () => {
      const observation = this.latest();
      return observation && predicate(observation) ? observation : null;
    });
  }

  async close() {
    if (!this.ws) return;
    try { this.ws.close(1000, "proof done"); } catch { /* already closed */ }
    await waitFor(`${this.name} close`, 5000, () => this.closeInfo !== null).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* Shard child process.                                                */
/* ------------------------------------------------------------------ */
function bootSource(mainUrl, shardUrl) {
  return `import { runMain } from ${JSON.stringify(mainUrl)};
import { shardConfig } from ${JSON.stringify(shardUrl)};
const host = runMain({ ...shardConfig(process.env), port: Number(process.env.PROOF_PORT ?? "0") });
const port = await host.ready;
console.log("PROOF_READY " + port);
const stop = async () => { await host.shutdown(); process.exit(process.exitCode ?? 0); };
process.on("SIGTERM", () => { void stop(); });
process.on("SIGINT", () => { void stop(); });
process.stdin.setEncoding("utf8");
let buf = "";
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line === "shutdown") void stop();
  }
});
process.stdin.resume();
`;
}

class ShardProcess {
  constructor({ dataDir, seed, keysSpec, port }) {
    this.dataDir = dataDir;
    this.seed = seed;
    this.keysSpec = keysSpec;
    this.requestedPort = port;
    this.port = null;
    this.child = null;
    this.stdoutLines = [];
    this.stderrLines = [];
    this.exitInfo = null;
    this.bootMs = null;
  }

  async start() {
    const started = Date.now();
    const bootPath = path.join(this.dataDir, `boot-${started}.mjs`);
    writeFileSync(bootPath, bootSource(
      pathToFileURL(path.join(ROOT, "src", "server", "main.ts")).href,
      pathToFileURL(path.join(ROOT, "src", "server", "shard.ts")).href,
    ));
    const env = { ...process.env };
    delete env.PORT; // ephemeral port comes from PROOF_PORT, not the ambient env
    env.EMBERHALL_DATA_DIR = this.dataDir;
    env.EMBERHALL_SEED = String(this.seed);
    env.EMBERHALL_KEYS = this.keysSpec;
    env.PROOF_PORT = String(this.requestedPort);
    this.child = spawn(process.execPath, [bootPath], {
      cwd: ROOT, env, stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => {
      for (const line of chunk.split("\n")) if (line.trim()) this.stdoutLines.push(line.trim());
    });
    this.child.stderr.on("data", (chunk) => {
      for (const line of chunk.split("\n")) if (line.trim()) this.stderrLines.push(line.trim());
    });
    this.child.on("exit", (code, signal) => { this.exitInfo = { code, signal }; });
    this.port = await waitFor("shard PROOF_READY", 60000, () => {
      if (this.exitInfo) fail(`shard exited during boot: ${JSON.stringify(this.exitInfo)}; stderr: ${this.stderrLines.slice(-5).join(" | ")}`);
      const ready = this.stdoutLines.find((l) => l.startsWith("PROOF_READY "));
      return ready ? Number(ready.split(" ")[1]) : null;
    });
    const health = await waitFor("/healthz ok", 30000, async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/healthz`, { signal: AbortSignal.timeout(3000) });
        if (res.status !== 200) return null;
        const body = await res.json();
        return body.ok === true ? body : null;
      } catch { return null; }
    });
    this.bootMs = Date.now() - started;
    return health;
  }

  /** Orderly stop. POSIX: SIGTERM (runMain handler). Windows: SIGTERM is a
   *  hard TerminateProcess, so drive the same shutdown() via stdin line. */
  async stop(timeoutMs = 20000) {
    if (!this.child || this.exitInfo) return this.exitInfo;
    const method = IS_WIN ? "stdin-shutdown (Windows: SIGTERM is not deliverable)" : "SIGTERM";
    this.stopMethod = method;
    if (IS_WIN) this.child.stdin.write("shutdown\n");
    else this.child.kill("SIGTERM");
    await waitFor("shard exit", timeoutMs, () => this.exitInfo).catch(() => {
      this.child.kill("SIGKILL");
      this.stopMethod += " + SIGKILL fallback (UNCLEAN)";
    });
    await waitFor("shard exit after kill", 5000, () => this.exitInfo).catch(() => {});
    return this.exitInfo;
  }

  kill() {
    if (this.child && !this.exitInfo) {
      try { this.child.kill("SIGKILL"); } catch { /* gone */ }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Log-event union across both feeds.                                  */
/* ------------------------------------------------------------------ */
const OUTCOME_KINDS = new Set(["felled", "glance", "no_tree", "too_far", "identify"]);

function classify(text) {
  if (/^Recovered (a|an|\d+) .*logs?\.$/.test(text)) return "felled";
  if (/glances/.test(text)) return "glance";
  if (text === "No tree.") return "no_tree";
  if (text === "Too far.") return "too_far";
  if (/cannot identify/.test(text)) return "identify";
  return "other";
}

function felledQuantity(text) {
  const match = /^Recovered (a|an|\d+) /.exec(text);
  if (!match) return null;
  return match[1] === "a" || match[1] === "an" ? 1 : Number(match[1]);
}

function makeEventUnion() {
  const events = [];
  return {
    events,
    push(client, lines, tick) {
      for (const text of lines) {
        const kind = classify(text);
        // The same global line reaches both feeds within a tick or two;
        // distinct identical lines (sequential probes) are ticks apart.
        const existing = events.find((e) => e.text === text && Math.abs(e.tick - tick) <= 3);
        if (existing) {
          if (!existing.clients.includes(client.name)) existing.clients.push(client.name);
          existing.tick = Math.min(existing.tick, tick);
        } else {
          events.push({ text, kind, tick, clients: [client.name] });
        }
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Steps.                                                              */
/* ------------------------------------------------------------------ */
function check(step, name, pass, expected, observed, note) {
  step.assertions.push({ name, pass: Boolean(pass), expected, observed, ...(note ? { note } : {}) });
}

function beginStep(ctx, name, inputs) {
  const step = { step: ctx.steps.length + 1, name, status: "RUNNING", inputs, assertions: [], notes: [], startedAt: new Date().toISOString(), ms: 0 };
  ctx.steps.push(step);
  return step;
}

async function stepBoot(ctx, step) {
  if (ctx.remote) {
    const res = await fetch(`${ctx.httpBase}/healthz`, { signal: AbortSignal.timeout(10000) });
    const body = await res.json();
    check(step, "remote /healthz 200 ok", res.status === 200 && body.ok === true, "200 {ok:true}", { status: res.status, body });
    ctx.health = body;
    return;
  }
  ctx.shard = new ShardProcess({ dataDir: ctx.dataDir, seed: ctx.seed, keysSpec: ctx.keysSpec, port: ctx.cfg.port });
  ctx.health = await ctx.shard.start();
  ctx.port = ctx.shard.port;
  check(step, "shard boot + /healthz ok", ctx.health?.ok === true && ctx.port > 0, "ok:true, ephemeral port", { port: ctx.port, health: ctx.health, bootMs: ctx.shard.bootMs });
  step.notes.push(`child stdout: ${ctx.shard.stdoutLines.slice(0, 4).join(" | ")}`);
}

async function stepConnect(ctx, step) {
  const url = ctx.remote ? ctx.cfg.url : `ws://127.0.0.1:${ctx.port}`;
  ctx.clients = [];
  for (const pair of ctx.keys) {
    const client = new ProofClient(pair.name, pair.key, url);
    client.onEvents = (c, lines, tick) => ctx.union.push(c, lines, tick);
    const welcome = await client.connect();
    ctx.clients.push(client);
    check(step, `${pair.name} welcome shape`, Boolean(welcome.characterId && welcome.name === pair.name && welcome.observation && Number.isInteger(welcome.tick)),
      "welcome{characterId,name,tick,observation}", { characterId: welcome.characterId, name: welcome.name, tick: welcome.tick });
  }
  const [a, b] = ctx.clients;
  ctx.ids = { [a.name]: a.welcome.characterId, [b.name]: b.welcome.characterId };
  check(step, "distinct characterIds", a.welcome.characterId !== b.welcome.characterId, "distinct", ctx.ids);
  for (const [self, other] of [[a, b], [b, a]]) {
    const seen = self.welcome.observation.people.find((p) => p.id === ctx.ids[other.name]);
    const selfBody = self.welcome.observation.you;
    const d = seen ? dist(selfBody.x, selfBody.z, seen.x, seen.z) : null;
    check(step, `${self.name} initial observation contains ${other.name} near spawn`, Boolean(seen) && d <= 6,
      "other body within 6 tiles of spawn", seen ? { id: seen.id, x: seen.x, z: seen.z, distance: round1(d) } : null);
  }
  check(step, "no protocol violations", ctx.clients.every((c) => c.violations.length === 0), "0 violations", ctx.clients.map((c) => ({ name: c.name, violations: c.violations })));

  // Duplicate-hello rule: a second socket on the same key replaces the first.
  const dup = new ProofClient(a.name, a.key, url);
  await dup.connect();
  const oldClose = await waitFor("old socket replaced", 8000, () => a.closeInfo);
  check(step, "duplicate hello closes old socket (replaced)", oldClose?.code === 4000 && oldClose?.reason === "replaced",
    "close 4000 'replaced'", oldClose);
  await dup.close();
  const replaced = new ProofClient(a.name, a.key, url);
  replaced.onEvents = (c, lines, tick) => ctx.union.push(c, lines, tick);
  await replaced.connect();
  ctx.clients[0] = replaced;
  check(step, "reconnect after replacement keeps characterId", replaced.welcome.characterId === ctx.ids[a.name],
    ctx.ids[a.name], replaced.welcome.characterId);
}

async function walkAndVerify(ctx, step, client, peer, dest, label) {
  const id = ctx.ids[client.name];
  const startIndex = peer.obs.length;
  const seq = client.sendIntent({ kind: "walk", tx: dest.tx, ty: dest.ty });
  const ack = await client.waitAck(seq);
  check(step, `${label} walk ack ok`, ack.ok === true, "ok:true", ack);
  if (ack.ok !== true) return;
  await peer.waitObs(`${peer.name} sees ${client.name} arrive`, 30000, (obs) => {
    const p = obs.people.find((x) => x.id === id);
    return p && dist(p.x, p.z, dest.tx, dest.ty) <= 0.4;
  });
  const trace = [];
  for (const frame of peer.obs.slice(startIndex)) {
    const p = frame.observation.people.find((x) => x.id === id);
    if (!p) continue;
    const key = `${round1(p.x)},${round1(p.z)}`;
    if (trace.length === 0 || trace[trace.length - 1].key !== key) {
      trace.push({ key, x: round1(p.x), z: round1(p.z), tick: frame.observation.tick });
    }
  }
  const peerFinal = peer.person(id);
  const ownFinal = client.latest().you;
  check(step, `${label} peer-observed arrival at (${dest.tx},${dest.ty})`,
    peerFinal && dist(peerFinal.x, peerFinal.z, dest.tx, dest.ty) <= 0.4,
    `within 0.4 of (${dest.tx},${dest.ty})`, peerFinal ? { x: peerFinal.x, z: peerFinal.z } : null);
  check(step, `${label} own feed agrees`, dist(ownFinal.x, ownFinal.z, dest.tx, dest.ty) <= 0.4,
    `within 0.4 of (${dest.tx},${dest.ty})`, { x: ownFinal.x, z: ownFinal.z });
  check(step, `${label} position changing in peer feed (>=3 samples)`, trace.length >= 3, ">=3 distinct positions", { samples: trace.length, trace: trace.slice(0, 10) });
}

async function stepWalk(ctx, step) {
  const [a, b] = ctx.clients;
  const spawnA = { x: a.latest().you.x, z: a.latest().you.z };
  const spawnB = { x: b.latest().you.x, z: b.latest().you.z };
  const destA = pickWalkDest(ctx.fixture, spawnA, [{ tx: SPAWN.tx, ty: SPAWN.ty }]);
  const destB = pickWalkDest(ctx.fixture, spawnB, [{ tx: SPAWN.tx, ty: SPAWN.ty }, destA]);
  step.inputs.destinations = { [a.name]: destA, [b.name]: destB };
  await walkAndVerify(ctx, step, a, b, destA, `${a.name}->${b.name} feed`);
  await walkAndVerify(ctx, step, b, a, destB, `${b.name}->${a.name} feed`);
}

async function waitChopOutcome(ctx, cursor, timeoutMs = 8000) {
  return waitFor("chop outcome in shared logTail", timeoutMs, () => {
    for (let i = cursor; i < ctx.union.events.length; i += 1) {
      if (OUTCOME_KINDS.has(ctx.union.events[i].kind)) return ctx.union.events[i];
    }
    return null;
  });
}

async function sendChop(ctx, step, client, tree, label) {
  const cursor = ctx.union.events.length;
  const seq = client.sendIntent({ kind: "chop", tx: tree.tx, ty: tree.ty });
  const ack = await client.waitAck(seq);
  check(step, `${label} chop ack ok`, ack.ok === true, "ok:true", ack);
  if (ack.ok !== true) fail(`${label} chop rejected: ${ack.reason}`);
  const event = await waitChopOutcome(ctx, cursor);
  return { client: client.name, seq, event };
}

function packDeltas(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const deltas = {};
  for (const key of keys) {
    const d = (after[key] ?? 0) - (before[key] ?? 0);
    if (d !== 0) deltas[key] = d;
  }
  return deltas;
}

async function stepFell(ctx, step) {
  const [a, b] = ctx.clients;
  const bodies = ctx.clients.map((c) => ({ x: c.latest().you.x, z: c.latest().you.z }));
  const tree = pickTree(ctx.fixture, bodies);
  ctx.tree = tree;
  step.inputs.tree = { tx: tree.tx, ty: tree.ty, resourceId: tree.resourceId, stands: tree.stands };
  step.notes.push("P2-B observations expose no tiles/resources fields: the tree is selected from the deterministic fixture world (same seed + hydrateWorld as the shard); both clients chop the identical (tx,ty) and the felling transition is asserted from the shared logTail, pack deltas and (step 5) the persisted save.");

  // Walk both bodies to adjacent stands within WORK_REACH.
  for (const [client, peer, stand] of [[a, b, tree.stands[0]], [b, a, tree.stands[1]]]) {
    await walkAndVerify(ctx, step, client, peer, stand, `${client.name} to stand`);
    const p = client.latest().you;
    check(step, `${client.name} within WORK_REACH of tree`, dist(p.x, p.z, tree.tx, tree.ty) <= WORK_REACH,
      `<= ${WORK_REACH}`, round1(dist(p.x, p.z, tree.tx, tree.ty)));
  }

  const baseline = {};
  for (const client of ctx.clients) baseline[client.name] = { ...client.latest().you.pack };
  ctx.packBaseline = baseline;
  step.inputs.packBaseline = baseline;

  // Both clients chop the same tile, alternating, until one felling lands.
  const chops = [];
  let felled = null;
  for (let i = 0; i < 40 && !felled; i += 1) {
    const client = ctx.clients[i % 2];
    const result = await sendChop(ctx, step, client, tree, `${client.name} chop #${i + 1}`);
    chops.push({ client: result.client, seq: result.seq, kind: result.event.kind, text: result.event.text, tick: result.event.tick });
    if (result.event.kind === "felled") felled = result.event;
    else if (result.event.kind === "no_tree") fail("tree reported gone before any Recovered line — fixture/shard world mismatch (check --seed)");
    else if (result.event.kind === "too_far") fail("chop beat landed out of reach — stand positioning defect");
    else if (result.event.kind === "identify") fail("unexpected identify gate on a skill-14 oak fixture");
  }
  step.inputs.chops = chops;
  check(step, "a felling was observed", Boolean(felled), "one Recovered line", felled);
  if (!felled) return;

  // Post-fell probes: both clients keep chopping the same tile. Every beat
  // must report the tree gone; a second felling would double-reward.
  const probes = [];
  for (const client of ctx.clients) {
    for (let k = 0; k < 3; k += 1) {
      const result = await sendChop(ctx, step, client, tree, `${client.name} post-fell probe #${k + 1}`);
      probes.push({ client: result.client, kind: result.event.kind, text: result.event.text, tick: result.event.tick });
      check(step, `${client.name} post-fell probe #${k + 1} reports No tree.`, result.event.kind === "no_tree",
        "No tree.", result.event.text);
    }
  }
  step.inputs.postFellProbes = probes;

  const felledEvents = ctx.union.events.filter((e) => e.kind === "felled");
  ctx.felledEvents = felledEvents;
  check(step, "exactly ONE felling transition across both feeds", felledEvents.length === 1,
    "1 Recovered line in the union of both logTail feeds", felledEvents);
  const quantity = felled ? felledQuantity(felled.text) : null;
  check(step, "felling yield quantity is ONE tree's worth", quantity === 1, "1 (lumberjack 14 < 100)", { quantity, text: felled?.text });

  const deltas = {};
  let acornTotal = 0;
  let otherTotal = 0;
  for (const client of ctx.clients) {
    const after = client.latest().you.pack;
    const d = packDeltas(baseline[client.name], after);
    deltas[client.name] = d;
    for (const [item, n] of Object.entries(d)) {
      if (item === "acorn") acornTotal += n;
      else otherTotal += Math.abs(n);
    }
  }
  ctx.packDeltas = deltas;
  check(step, "aggregate loot equals one tree: acorn delta 0..1, every other pack item unchanged",
    acornTotal >= 0 && acornTotal <= 1 && otherTotal === 0,
    "acorn sum in {0,1}; all other pack deltas 0 (graded logs land in the resources inventory, asserted from the save in step 5)",
    { deltas, acornTotal, otherTotal });
  step.inputs.packDeltas = deltas;
}

function readSave(ctx) {
  const file = path.join(ctx.dataDir, "shard-save.json");
  if (!existsSync(file)) fail(`missing save file ${file}`);
  return JSON.parse(readFileSync(file, "utf8"));
}

function saveLogTotal(save, resourceId) {
  let total = 0;
  const stacks = [];
  for (const state of Object.values(save.playerStates ?? {})) {
    for (const [key, stack] of Object.entries(state.resources ?? {})) {
      if (key.startsWith(`${resourceId}:log:`)) {
        total += stack.quantity ?? 0;
        stacks.push({ key, quantity: stack.quantity });
      }
    }
  }
  return { total, stacks };
}

async function stepRestart(ctx, step) {
  const pre = {};
  for (const client of ctx.clients) {
    const you = client.latest().you;
    pre[client.name] = { id: ctx.ids[client.name], x: you.x, z: you.z, pack: { ...you.pack } };
  }
  step.inputs.preRestart = pre;

  if (ctx.remote) {
    step.notes.push("remote mode: the shard process cannot be signalled; step 5 verifies disconnect/reconnect persistence instead of SIGTERM/reboot.");
    for (const client of ctx.clients) await client.close();
    ctx.clients = [];
    for (const pair of ctx.keys) {
      const client = new ProofClient(pair.name, pair.key, ctx.cfg.url);
      client.onEvents = (c, lines, tick) => ctx.union.push(c, lines, tick);
      await client.connect();
      ctx.clients.push(client);
    }
  } else {
    for (const client of ctx.clients) await client.close();
    ctx.clients = [];
    const exitInfo = await ctx.shard.stop();
    ctx.stopInfo = { method: ctx.shard.stopMethod, exit: exitInfo, stderrTail: ctx.shard.stderrLines.slice(-5) };
    step.inputs.stop = ctx.stopInfo;
    check(step, "orderly shard stop (final save)", exitInfo?.code === 0 && !/UNCLEAN/.test(ctx.shard.stopMethod ?? ""),
      "exit 0 via SIGTERM/shutdown()", ctx.stopInfo);

    const save = readSave(ctx);
    ctx.saveAtStop = save;
    for (const name of Object.keys(pre)) {
      const person = (save.people ?? []).find((p) => p.id === pre[name].id);
      check(step, `save retains ${name} position`, person && Math.abs(person.x - pre[name].x) < 1e-6 && Math.abs(person.z - pre[name].z) < 1e-6,
        { x: pre[name].x, z: pre[name].z }, person ? { x: person.x, z: person.z } : null);
      const state = save.playerStates?.[pre[name].id];
      check(step, `save retains ${name} pack`, state && JSON.stringify(state.pack) === JSON.stringify(pre[name].pack),
        pre[name].pack, state?.pack ?? null);
    }
    const scar = save.scars?.[`${ctx.tree.tx},${ctx.tree.ty}`];
    check(step, "save scar keeps the tree felled (dirt)", scar?.kind === "dirt", "scars[tx,ty].kind === 'dirt'", scar ?? null);
    const loot = saveLogTotal(save, ctx.tree.resourceId);
    ctx.saveLogTotal = loot.total;
    check(step, "persisted resources: exactly ONE log stack unit across both characters (no double reward)",
      loot.total === 1, "sum of quantity over oak:log:* stacks == 1", loot);

    // Reboot on the SAME data dir; the registry must restore identities.
    const bootLinesBefore = ctx.shard.stdoutLines.length;
    ctx.shard = new ShardProcess({ dataDir: ctx.dataDir, seed: ctx.seed, keysSpec: ctx.keysSpec, port: ctx.cfg.port });
    ctx.health = await ctx.shard.start();
    ctx.port = ctx.shard.port;
    const restoreLine = ctx.shard.stdoutLines.find((l) => l.startsWith("shard restore tick="));
    check(step, "reboot restored the save (not a fresh world)", Boolean(restoreLine), "shard restore tick=N", ctx.shard.stdoutLines.slice(0, 4));
    step.inputs.reboot = { port: ctx.port, restoreLine, bootMs: ctx.shard.bootMs };
    for (const pair of ctx.keys) {
      const client = new ProofClient(pair.name, pair.key, `ws://127.0.0.1:${ctx.port}`);
      client.onEvents = (c, lines, tick) => ctx.union.push(c, lines, tick);
      await client.connect();
      ctx.clients.push(client);
    }
  }

  const [a2, b2] = ctx.clients;
  for (const client of ctx.clients) {
    const name = client.name;
    check(step, `${name} characterId stable across recovery`, client.welcome.characterId === pre[name].id, pre[name].id, client.welcome.characterId);
    const you = client.welcome.observation.you;
    check(step, `${name} body position retained`, Math.abs(you.x - pre[name].x) < 1e-6 && Math.abs(you.z - pre[name].z) < 1e-6,
      { x: pre[name].x, z: pre[name].z }, { x: you.x, z: you.z });
    check(step, `${name} pack retained`, JSON.stringify(you.pack) === JSON.stringify(pre[name].pack), pre[name].pack, you.pack);
  }

  // The tree must still be felled: fresh chops from both bodies report gone.
  const cursor = ctx.union.events.length;
  for (const client of ctx.clients) {
    const result = await sendChop(ctx, step, client, ctx.tree, `${client.name} post-restart probe`);
    check(step, `${client.name} post-restart chop reports No tree.`, result.event.kind === "no_tree", "No tree.", result.event.text);
  }
  const newFelled = ctx.union.events.slice(cursor).filter((e) => e.kind === "felled");
  check(step, "no second felling after recovery", newFelled.length === 0, "0 Recovered lines", newFelled);
  void a2; void b2;

  if (!ctx.remote) {
    const save2 = readSave(ctx);
    const scar2 = save2.scars?.[`${ctx.tree.tx},${ctx.tree.ty}`];
    check(step, "rebooted save still scars the tree as dirt", scar2?.kind === "dirt", "dirt", scar2 ?? null);
    const loot2 = saveLogTotal(save2, ctx.tree.resourceId);
    check(step, "rebooted resources still total ONE log", loot2.total === 1, "1", loot2);
  }
}

/* ------------------------------------------------------------------ */
/* Runner.                                                             */
/* ------------------------------------------------------------------ */
const STEP_DEFS = [
  ["boot", stepBoot],
  ["connect", stepConnect],
  ["walk-proof", stepWalk],
  ["exactly-once-fell", stepFell],
  ["restart-recovery", stepRestart],
];

export async function runProof(options = {}) {
  const cfg = {
    port: options.port ?? 0,
    url: options.url ?? null,
    httpBase: options.httpBase ?? null,
    quiet: options.quiet ?? false,
    evidencePath: options.evidencePath ?? DEFAULT_EVIDENCE,
  };
  const seed = options.seed ?? DEFAULT_SEED;
  const keysSpec = options.keys ?? DEFAULT_KEYS;
  const keys = parseKeys(keysSpec);
  const remote = Boolean(cfg.url);
  if (remote && !cfg.httpBase) cfg.httpBase = cfg.url.replace(/^ws/, "http").replace(/\/+$/, "");
  const dataDir = options.dataDir ?? (remote ? null : mkdtempSync(path.join(os.tmpdir(), "emberhall-p2c-")));
  const started = Date.now();
  const ctx = {
    cfg, seed, keysSpec, keys, remote, dataDir,
    httpBase: cfg.httpBase,
    steps: [], clients: [], ids: {}, union: makeEventUnion(),
    fixture: null, shard: null, port: null, tree: null,
    packBaseline: null, packDeltas: null, felledEvents: null, saveLogTotal: null,
    stopInfo: null, health: null,
  };
  const say = (line) => { if (!cfg.quiet) console.log(line); };

  try {
    ctx.fixture = await loadFixture(seed);
    for (const [name, fn] of STEP_DEFS) {
      const step = beginStep(ctx, name, {});
      const t0 = Date.now();
      try {
        await fn(ctx, step);
        step.status = step.assertions.some((x) => !x.pass) ? "FAIL" : "PASS";
      } catch (error) {
        step.status = "FAIL";
        step.error = String(error?.message ?? error);
      }
      step.ms = Date.now() - t0;
      say(`[${step.status}] ${name} (${step.ms}ms, ${step.assertions.filter((x) => x.pass).length}/${step.assertions.length} assertions)`);
      if (step.status === "FAIL") {
        for (const [restName] of STEP_DEFS.slice(STEP_DEFS.findIndex(([n]) => n === name) + 1)) {
          const skipped = beginStep(ctx, restName, {});
          skipped.status = "SKIP";
          skipped.notes.push(`skipped: ${name} failed`);
        }
        break;
      }
    }
  } catch (error) {
    const step = beginStep(ctx, "harness", {});
    step.status = "FAIL";
    step.error = String(error?.message ?? error);
  } finally {
    for (const client of ctx.clients) await client.close().catch(() => {});
    if (ctx.shard) {
      await ctx.shard.stop(15000).catch(() => ctx.shard.kill());
    }
  }

  const summary = {
    pass: ctx.steps.filter((s) => s.status === "PASS").length,
    fail: ctx.steps.filter((s) => s.status === "FAIL").length,
    skip: ctx.steps.filter((s) => s.status === "SKIP").length,
    total: ctx.steps.length,
  };
  const evidence = {
    proof: "emberhall-p2c-two-client",
    version: 1,
    generatedAt: new Date().toISOString(),
    gitSha: gitSha(),
    nodeVersion: process.version,
    platform: process.platform,
    mode: remote ? "remote" : "local",
    config: {
      portRequested: cfg.port,
      portActual: ctx.port,
      dataDir: ctx.dataDir,
      seed,
      keyNames: keys.map((k) => k.name),
      keysSpec,
      url: cfg.url,
      httpBase: cfg.httpBase,
      tickMs: 100,
    },
    protocol: {
      frameTypes: [...FRAME_TYPES],
      violations: ctx.clients.flatMap((c) => c.violations.map((v) => `${c.name}: ${v}`)),
    },
    exactlyOnce: {
      felledCount: ctx.felledEvents?.length ?? null,
      felledEvents: ctx.felledEvents ?? [],
      packDeltas: ctx.packDeltas,
      saveLogTotal: ctx.saveLogTotal,
      tree: ctx.tree ? { tx: ctx.tree.tx, ty: ctx.tree.ty, resourceId: ctx.tree.resourceId } : null,
    },
    steps: ctx.steps,
    summary,
    wallMs: Date.now() - started,
    childLog: ctx.shard ? { stdout: ctx.shard.stdoutLines.slice(0, 40), stderr: ctx.shard.stderrLines.slice(-20) } : null,
    notes: [
      "Read-only judge: no src/** edits; assertions read WS observations, plus the persisted shard-save.json (labelled) for durable exactly-once loot and restart state.",
      "P2-B observations carry no tiles/resources fields: the wild tree is selected from a deterministic fixture world (createWorld(seed)+hydrateWorld, same path as the shard) and both clients chop the identical (tx,ty); the felling transition is observed via the shared logTail (Recovered line, then No tree. probes) and pack deltas.",
      "Graded logs land in the actor resources inventory (not pack); observation-level loot proof is the single Recovered message (quantity 1) + acorn/pack deltas, and the save-level proof is sum(oak:log:* quantity) == 1 across both characters after orderly stop.",
      IS_WIN
        ? "Windows: SIGTERM is a hard TerminateProcess, so the orderly stop drives runMain's shutdown() through the boot wrapper's stdin 'shutdown' line — the same code path the SIGTERM handler runs on POSIX."
        : "POSIX: orderly stop via SIGTERM into runMain's handler (transport.close + shard.stop final save).",
      "P2-D remote reuse: node scripts/two-client-proof.mjs --url wss://<fly-app>.fly.dev [--http-base https://<fly-app>.fly.dev] --seed <deploy seed>; step 1 becomes a remote /healthz check and step 5 a disconnect/reconnect persistence check (no process signal, no save-file access).",
    ],
  };
  mkdirSync(path.dirname(cfg.evidencePath), { recursive: true });
  writeFileSync(cfg.evidencePath, JSON.stringify(evidence, null, 2) + "\n");
  say(`\n${summary.fail === 0 && summary.skip === 0 ? "PASS" : "FAIL"} — two-client proof: ${summary.pass} pass / ${summary.fail} fail / ${summary.skip} skip, ${evidence.wallMs}ms`);
  say(`evidence: ${cfg.evidencePath}`);
  if (summary.fail > 0) {
    for (const step of ctx.steps.filter((s) => s.status === "FAIL")) {
      say(`  FAILED ${step.name}: ${step.error ?? step.assertions.filter((a) => !a.pass).map((a) => a.name).join("; ")}`);
    }
  }
  return evidence;
}

/* ------------------------------------------------------------------ */
/* CLI.                                                                */
/* ------------------------------------------------------------------ */
function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === "--port") options.port = Number(next());
    else if (arg === "--seed") options.seed = Number(next());
    else if (arg === "--keys") options.keys = next();
    else if (arg === "--data-dir") options.dataDir = next();
    else if (arg === "--url") options.url = next();
    else if (arg === "--http-base") options.httpBase = next();
    else if (arg === "--evidence") options.evidencePath = next();
    else if (arg === "--help" || arg === "-h") {
      console.log("usage: node scripts/two-client-proof.mjs [--port 0] [--seed 1977] [--keys kett:proof-kett,bran:proof-bran] [--data-dir DIR] [--evidence PATH] [--url wss://host [--http-base https://host]]");
      process.exit(0);
    } else fail(`unknown argument: ${arg}`);
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const evidence = await runProof(parseArgs(process.argv.slice(2)));
  process.exitCode = evidence.summary.fail === 0 && evidence.summary.skip === 0 ? 0 : 1;
}
