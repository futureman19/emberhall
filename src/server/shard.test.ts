import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { COURT } from "../game/atlas.ts";
import { createWorld } from "../game/world.ts";
import { setWorld, getWorld } from "../game/live.ts";
import { decodeSave, encodeSave } from "../game/save.ts";
import { hashObservation } from "../game/agent/log.ts";
import { assessResourceHarvest } from "../game/resources/harvest.ts";
import { mulberry32 } from "../game/rng.ts";
import type { Intent, World } from "../game/types.ts";
import { createShard, shardConfig, TICK_MS, clampElapsed } from "./shard.ts";
import { hydrateWorld } from "./hydrate.ts";

function directory(t: test.TestContext) {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "emberhall-shard-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const intent = (kind: string, tx = COURT.tx, ty = COURT.ty): Intent => ({ kind, tx, ty, targetId: null, spell: null } as Intent);
const config = (dataDir: string) => shardConfig({ EMBERHALL_DATA_DIR: dataDir });
const silent = () => {};
function state(shard: ReturnType<typeof createShard>): World { return JSON.parse(shard.checkpoint()) as World; }

// IDs are allocated by a process-global counter, not by the seed. Ignore only
// generated identity strings when comparing two independently hydrated clones.
function identities(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/\b(?:p|b|c|f|pile|herb|plot)-\d+\b/g, "<id>");
  if (Array.isArray(value)) return value.map(identities);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, identities(v)]));
  return value;
}

test("fresh hydration mirrors the live world's complete setup", () => {
  const raw = createWorld(20261121);
  setWorld(structuredClone(raw));
  const hosted = hydrateWorld(structuredClone(raw));
  assert.deepEqual(identities(hosted), identities(getWorld()));
});

test("config defaults, validation and elapsed clamp", () => {
  assert.equal(TICK_MS, 100);
  assert.deepEqual(shardConfig({}), { port: 8080, dataDir: "./shard-data", seed: 20261121, keys: [{ name: "kett", key: "dev-kett" }, { name: "bran", key: "dev-bran" }] });
  assert.equal(shardConfig({ PORT: "9090", EMBERHALL_SEED: "7", EMBERHALL_KEYS: "" }).seed, 7);
  for (const env of [{ PORT: "0" }, { PORT: "x" }, { EMBERHALL_SEED: "NaN" }, { EMBERHALL_KEYS: "bad" }, { EMBERHALL_KEYS: "a:x,b:x" }, { EMBERHALL_KEYS: "a:x,a:y" }]) assert.throws(() => shardConfig(env));
  assert.equal(clampElapsed(10), 1);
  assert.equal(clampElapsed(0.1), 0.1);
  assert.equal(clampElapsed(-1), 0);
  assert.equal(clampElapsed(NaN), 0);
});

test("registry, private world, deferred queue, detached observations and rejects", t => {
  const dir = directory(t);
  const shard = createShard(config(dir), { log: silent });
  const a = shard.resolveKey("dev-kett")!; const b = shard.resolveKey("dev-bran")!;
  assert.ok(a && b && a !== b);
  assert.equal(shard.resolveKey("missing"), null);
  const before = state(shard);
  assert.notEqual(a, before.player.id);
  assert.equal(before.people.find(p => p.id === a)?.isPlayer, false);
  assert.equal(before.people.find(p => p.id === a)?.x, COURT.tx);
  assert.equal(before.people.find(p => p.id === a)?.z, COURT.ty + 1);
  assert.notEqual(before.playerStates![a], before.playerStates![b]);
  assert.notEqual(before.playerStates![a].pack, before.playerStates![b].pack);
  for (const bad of [intent("bogus"), intent("chop", -1), intent("chop", 999999), { ...intent("none"), spell: "not-a-spell" } as unknown as Intent, null as unknown as Intent]) {
    assert.ok(shard.enqueueIntent(a, bad));
    assert.equal(shard.checkpoint(), JSON.stringify(before));
  }
  assert.ok(shard.enqueueIntent("missing", intent("none")));
  const observation = shard.observationFor(a);
  assert.equal(shard.obsHash(a), hashObservation(observation));
  observation.you.pack.log = 999;
  assert.notEqual(shard.observationFor(a).you.pack.log, 999);
  const request = intent("none", 12, 13);
  assert.equal(shard.enqueueIntent(a, request), null);
  request.tx = -1;
  assert.equal(shard.checkpoint(), JSON.stringify(before));
  shard.step(0.1);
  assert.equal(state(shard).playerStates![a].intent.tx, 12);
  assert.equal(state(shard).playerStates![b].intent.tx, 0);
  assert.equal("world" in shard, false);
  shard.stop();
  assert.ok(existsSync(join(dir, "shard-save.json")));
  assert.equal(existsSync(join(dir, "shard-save.json.tmp")), false);
  const reboot = createShard(config(dir), { log: silent });
  assert.equal(reboot.resolveKey("dev-kett"), a);
  assert.deepEqual(reboot.observationFor(a), shard.observationFor(a));
});

test("two queued chops serialize one wild tree yield and survive restart", t => {
  const dir = directory(t);
  const initial = createShard(config(dir), { log: silent });
  const a = initial.resolveKey("dev-kett")!; const b = initial.resolveKey("dev-bran")!;
  const w = hydrateWorld(decodeSave(initial.checkpoint())!);
  let target: { tx: number; ty: number; quantity: number } | undefined;
  for (let ty = 50; ty < 180 && !target; ty++) for (let tx = 50; tx < 180 && !target; tx++) {
    if (w.tiles[ty][tx].kind !== "tree") continue;
    const assessment = assessResourceHarvest({ seed: w.seed, tx, ty, nodeKind: "tree", effectiveSkill: 100, toolTier: 2, discovered: true });
    if (assessment.status === "ready" && assessment.yield.resourceId === "oak") target = { tx, ty, quantity: assessment.yield.quantity };
  }
  assert.ok(target);
  for (const id of [a,b]) {
    const p = w.people.find(p => p.id === id)!; p.x = target.tx; p.z = target.ty + 1;
    const sheet = w.playerStates![id]; sheet.skills.lumberjack = 100; sheet.wear.main = "hatchet";
  }
  writeFileSync(join(dir, "shard-save.json"), encodeSave(w));
  const shard = createShard(config(dir), { log: silent });
  const random = Math.random; Math.random = mulberry32(44);
  try {
    for (const id of [a,b]) assert.equal(shard.enqueueIntent(id, intent("chop", target.tx, target.ty)), null);
    let transitions = 0; let wasFelled = false;
    for (let i = 0; i < 40; i++) {
      shard.step(0.1);
      const felled = state(shard).scars[`${target.tx},${target.ty}`]?.kind === "dirt";
      if (felled && !wasFelled) transitions++;
      wasFelled = felled;
    }
    assert.equal(transitions, 1, JSON.stringify({ target, log: state(shard).log, sheets: state(shard).playerStates }));
    const after = state(shard);
    const total = [a,b].flatMap(id => Object.values(after.playerStates![id].resources.stacks)).reduce((sum, s) => sum + s, 0);
    assert.equal(total, target.quantity);
    shard.stop();
    const reboot = createShard(config(dir), { log: silent });
    const restored = state(reboot);
    assert.equal(restored.tickCount, after.tickCount);
    assert.deepEqual(restored.playerStates, after.playerStates);
    assert.deepEqual(restored.scars, after.scars);
    for (const id of [a,b]) assert.deepEqual(restored.people.find(p => p.id === id), after.people.find(p => p.id === id));
    assert.equal(reboot.resolveKey("dev-bran"), b);
  } finally { Math.random = random; }
});

test("300-tick autosave and invalid save recovery reconcile registry", t => {
  const dir = directory(t); const logs: string[] = [];
  const shard = createShard(config(dir), { log: line => logs.push(line) });
  const a = shard.resolveKey("dev-kett");
  const random = Math.random; Math.random = mulberry32(23);
  try { for (let i = 0; i < 300; i++) shard.step(0.1); } finally { Math.random = random; }
  assert.equal(JSON.parse(readFileSync(join(dir, "shard-save.json"), "utf8")).tickCount, 300);
  assert.ok(logs.some(line => line.includes("save")));
  writeFileSync(join(dir, "shard-save.json"), "invalid");
  const recovered = createShard(config(dir), { log: silent });
  assert.equal(recovered.resolveKey("dev-kett"), a);
  assert.ok(recovered.observationFor(a!));
});
