import assert from "node:assert/strict";
import test from "node:test";
import { createWorld, createStubWorld, createPerson, nid } from "./world.ts";
import { effectiveMain } from "./rare.ts";
import { spawn, strikePlayer } from "./ecology.ts";
import { gloomTorch } from "./gloomwraith.ts";
import { commandPick, pickNow } from "./herbs.ts";
import { addToPile, takeFromPile, tickPiles } from "./piles.ts";
import { placeZone, tickZones } from "./zones.ts";
import { tickRng } from "./rng.ts";

function fixture() {
  const world = createStubWorld();
  const solo = createPerson(world, () => 0.5, { x: 10, z: 10, isPlayer: true });
  const body = createPerson(world, () => 0.5, { x: 100, z: 100 });
  world.people.push(solo, body);
  world.player.id = solo.id;
  const actor = structuredClone(world.player);
  actor.id = body.id;
  world.playerStates = { [solo.id]: world.player, [body.id]: actor };
  world.hour = 100;
  return { world, solo, body, actor };
}

function withRoll(fn: () => void) {
  const old = Math.random;
  try { Math.random = () => 0; fn(); } finally { Math.random = old; }
}

test("effective equipment and torch select the explicit sheet", () => {
  const { world, body, actor } = fixture();
  world.player.wear.main = "dagger";
  actor.wear.main = "torch";
  assert.equal(effectiveMain(world, body.id), "torch");
  assert.equal(gloomTorch(world, body.id), true);
  actor.rares.push({ uid: "actor-rare", base: "bow", affixes: [], seed: 1, hour: 100 });
  actor.wearRare.main = "actor-rare";
  assert.equal(effectiveMain(world, body.id), "bow");
  assert.equal(effectiveMain(world), "dagger");
});

test("creature strike uses target torch, wards, poison and bite timestamp", () => {
  const { world, body, actor } = fixture();
  actor.wear = { main: "torch" };
  actor.blessUntil = 101;
  actor.ironwoodUntil = 101;
  const before = structuredClone(world.player);
  body.hp = 100;
  strikePlayer(world, spawn(world, "gloomwraith", 100, 100), body, body.id);
  assert.equal(body.hp, 99);
  // Venom is tick-keyed now (ambient determinism): pin a tick whose seeded
  // roll poisons instead of stubbing Math.random, which it no longer consults.
  const spider = spawn(world, "stonecrawl_spider", 100, 100);
  let poisonTick = 0;
  while (tickRng(world.seed, poisonTick, spider.id, "venom")() >= 0.35) poisonTick++;
  world.tickCount = poisonTick;
  strikePlayer(world, spider, body, body.id);
  assert.ok(actor.poisonUntil > world.hour);
  assert.ok(actor.poisonTickAt > world.hour);
  assert.equal(actor.lastBittenAt, world.hour);
  assert.deepEqual(world.player, before);
});

test("strike rejects mismatched target bodies before mutation", () => {
  const { world, solo, body } = fixture();
  const c = spawn(world, "wolf", 100, 100);
  const before = structuredClone(world);
  assert.throws(() => strikePlayer(world, c, solo, body.id), /actor|target/i);
  assert.deepEqual(structuredClone(world), before);
});

test("herb command paths and harvest credit only the selected actor", () => {
  const { world, solo, body, actor } = fixture();
  world.herbs = [{ id: "patch", kind: "ginseng", tx: 103, ty: 100, until: 0 }];
  const before = structuredClone(world.player);
  const count = actor.pack.ginseng;
  assert.equal(commandPick(world, "patch", body.id), null);
  assert.ok(body.path.length > 0);
  assert.deepEqual(solo.path, []);
  body.x = 103;
  withRoll(() => assert.match(pickNow(world, body.id), /pluck/));
  assert.equal(actor.pack.ginseng, count + 2);
  assert.equal(actor.intent.kind, "none");
  assert.deepEqual(world.player, before);
});

test("loot credits actor and clears only matching corpse markers", () => {
  const { world, body, actor } = fixture();
  world.player.corpseAt = { tx: 10, ty: 10 };
  actor.corpseAt = { tx: 100, ty: 100 };
  const before = structuredClone(world.player);
  const count = actor.pack.moss;
  const pile = addToPile(world, 100, 100, { moss: 2 }, "death", 101, "corpse");
  assert.equal(takeFromPile(world, pile.id, "moss", body.id), null);
  assert.equal(actor.pack.moss, count + 1);
  assert.notEqual(actor.corpseAt, null);
  assert.equal(takeFromPile(world, pile.id, undefined, body.id), null);
  assert.equal(actor.pack.moss, count + 2);
  assert.equal(actor.corpseAt, null);
  assert.deepEqual(world.player, before);
});

test("pile expiry clears secondary actor markers", () => {
  const { world, actor } = fixture();
  actor.corpseAt = { tx: 100, ty: 100 };
  tickPiles(world);
  assert.equal(actor.corpseAt, null);
});

for (const owner of ["solo", null, "missing", "toString"] as const) {
  test(`fresh solo zone kill awards a rare only to the exact player owner: ${owner}`, () => {
    const world = createWorld(1);
    assert.deepEqual(world.playerStates, {});
    assert.ok(world.player.id);
    const c = spawn(world, "wolf", 100, 100);
    c.hp = 1;
    world.fauna = [c];
    placeZone(world, "earthquake", 100, 100, owner === "solo" ? world.player.id : owner, 100);
    const before = structuredClone(world.player);
    withRoll(() => tickZones(world, 0));
    assert.equal(c.task, "dead");
    assert.equal(world.player.rares.length, before.rares.length + (owner === "solo" ? 1 : 0));
    if (owner !== "solo") assert.deepEqual(world.player, before);
    assert.deepEqual(world.playerStates, {});
  });
}

for (const owner of ["actor", null, "missing"] as const) {
  test(`zone kill attributes rare only to registered owner: ${owner}`, () => {
    const { world, body, actor } = fixture();
    const c = spawn(world, "wolf", 100, 100);
    c.hp = 1;
    world.fauna = [c];
    placeZone(world, "earthquake", 100, 100, owner === "actor" ? body.id : owner, 100);
    const before = structuredClone(world.player);
    withRoll(() => tickZones(world, 0));
    assert.equal(c.task, "dead");
    assert.equal(actor.rares.length, owner === "actor" ? 1 : 0);
    assert.deepEqual(world.player, before);
  });
}

test("allocator reserves every sheet's marks after reload", () => {
  const { world, actor } = fixture();
  const prior = nid(world, "mark");
  const next = Number(prior.split("-").at(-1)) + 1;
  actor.marks = [{ id: `mark-${next}`, name: "actor mark", tx: 100, ty: 100 }];
  assert.notEqual(nid(world, "mark"), actor.marks[0]!.id);
});

test("unknown actor dependencies fail closed", () => {
  const { world, body } = fixture();
  const c = spawn(world, "wolf", 100, 100);
  const before = structuredClone(world);
  for (const action of [
    () => effectiveMain(world, "missing"), () => gloomTorch(world, "missing"),
    () => strikePlayer(world, c, body, "missing"),
    () => commandPick(world, "patch", "missing"), () => pickNow(world, "missing"),
    () => takeFromPile(world, "pile", undefined, "missing"),
  ]) assert.throws(action, /Unknown actor/);
  assert.deepEqual(structuredClone(world), before);
});
