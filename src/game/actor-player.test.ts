import assert from "node:assert/strict";
import test from "node:test";
import { createPerson, createStubWorld } from "./world.ts";
import { commandHeal, commandHunt, commandTame, commandStay, tickPlayer, resurrect } from "./player.ts";
import { tickWorld } from "./sim.ts";

function fixture() {
  const world = createStubWorld();
  const solo = createPerson(world, () => 0.5, { x: 10, z: 10, isPlayer: true });
  const body = createPerson(world, () => 0.5, { x: 100, z: 100 });
  world.people.push(solo, body);
  world.player.id = solo.id;
  const actor = structuredClone(world.player);
  actor.id = body.id;
  world.playerStates = { [body.id]: actor };
  world.hour = 100;
  return { world, solo, body, actor };
}

test("actor bandages use its body, pack, skills and gains", () => {
  const { world, solo, body, actor } = fixture();
  actor.pack.bandage = 2;
  actor.skills.healing = 80;
  body.hp = 1;
  const before = structuredClone(world.player);
  const hp = solo.hp;
  assert.equal(commandHeal(world, body.id), "The cloth holds.");
  assert.ok(body.hp > 10);
  assert.equal(actor.pack.bandage, 1);
  assert.equal(solo.hp, hp);
  assert.deepEqual(world.player, before);
});

test("actor combat consumes its arrows and technique, not solo equipment", () => {
  const { world, body, actor } = fixture();
  actor.wear.main = "bow";
  actor.pack.arrows = 3;
  actor.skills.archery = 100;
  actor.armedTechnique = "aimed_shot";
  world.fauna.push({ id: "prey", kind: "hart", x: 102, z: 100, hp: 200, maxHp: 200, path: [], task: "idle", taskUntil: 999, corpseUntil: 0, home: { tx: 102, ty: 100 }, ownerId: null, loyalty: 0, stay: false });
  const before = structuredClone(world.player);
  commandHunt(world, "prey", body.id);
  tickPlayer(world, 3, body.id);
  assert.equal(actor.pack.arrows, 2);
  assert.equal(actor.armedTechnique, null);
  assert.ok(actor.techniqueCoolUntil.aimed_shot! > world.hour);
  assert.ok(world.fauna[0].hp < 200);
  assert.deepEqual(world.player, before);
});

test("actor taming assigns ownership and pet commands reject another owner", () => {
  const { world, body, actor } = fixture();
  actor.skills.taming = 100;
  world.fauna.push({ id: "pet", kind: "hart", x: 101, z: 100, hp: 20, maxHp: 20, path: [], task: "idle", taskUntil: 999, corpseUntil: 0, home: { tx: 101, ty: 100 }, ownerId: null, loyalty: 0, stay: false });
  const before = structuredClone(world.player);
  const random = Math.random;
  Math.random = () => 0;
  try { commandTame(world, "pet", body.id); tickPlayer(world, 3, body.id); }
  finally { Math.random = random; }
  assert.equal(world.fauna[0].ownerId, body.id);
  assert.equal(commandStay(world, "pet"), "It is not yours.");
  assert.match(commandStay(world, "pet", body.id), /stays/);
  assert.deepEqual(world.player, before);
});

test("actor death and resurrection affect only its sheet and body", () => {
  const { world, solo, body, actor } = fixture();
  const before = structuredClone(world.player);
  body.hp = 0;
  tickPlayer(world, 0.1, body.id);
  assert.equal(actor.ghost, true);
  assert.equal(solo.ghost, false);
  resurrect(world, undefined, body.id);
  assert.equal(actor.ghost, false);
  assert.ok(body.hp > 0);
  assert.deepEqual(world.player, before);
});

test("world beat processes registered actor work as well as solo work", () => {
  const { world, body, actor } = fixture();
  world.speed = 1;
  actor.wear.main = "pick";
  actor.intent = { kind: "dig", tx: 101, ty: 100, targetId: null, spell: null };
  actor.workT = 0.45;
  tickWorld(world, 0.1);
  assert.equal(world.tiles[100][101].kind, "pit");
  assert.equal(actor.intent.kind, "none");
  assert.equal(world.player.intent.kind, "none");
  assert.equal(body.path.length, 0);
});

test("registered player-marked bodies move with their own flight and intent", () => {
  const { world, solo, body, actor } = fixture();
  body.isPlayer = true;
  body.path = [{ tx: 101, ty: 100 }];
  solo.path = [{ tx: 11, ty: 10 }];
  actor.flyUntil = world.hour + 10;
  actor.intent = { kind: "walk", tx: 101, ty: 100, targetId: null, spell: null };
  tickWorld(world, 0.1);
  assert.ok(body.x - 100 > solo.x - 10, "registered body uses its own flight speed");
  assert.equal(actor.intent.kind, "walk");
});

test("actor poison, mana and skinning resolve without changing solo state", () => {
  const { world, body, actor } = fixture();
  actor.poisonUntil = world.hour + 1;
  actor.poisonTickAt = world.hour;
  actor.mana = 0;
  actor.intent = { kind: "skin", tx: 100, ty: 100, targetId: "corpse", spell: null };
  world.fauna.push({ id: "corpse", kind: "hart", x: 100, z: 100, hp: 0, maxHp: 20, path: [], task: "dead", taskUntil: 0, corpseUntil: 999, home: { tx: 100, ty: 100 }, ownerId: null, loyalty: 0, stay: false });
  const before = structuredClone(world.player);
  const hp = body.hp;
  const hide = actor.pack.hide ?? 0;
  tickPlayer(world, 3, body.id);
  assert.equal(body.hp, hp - 1);
  assert.ok(actor.mana > 0);
  assert.ok(actor.pack.hide > hide);
  assert.equal(actor.intent.kind, "none");
  assert.deepEqual(world.player, before);
});

test("world beat advances each owner's pet loyalty exactly once", () => {
  const { world, body } = fixture();
  for (const ownerId of [world.player.id, body.id]) {
    world.fauna.push({ id: `pet-${ownerId}`, kind: "hart", x: 100, z: 100, hp: 20, maxHp: 20, path: [], task: "idle", taskUntil: 999, corpseUntil: 0, home: { tx: 100, ty: 100 }, ownerId, loyalty: 40, stay: true });
  }
  tickWorld(world, 0.1);
  assert.ok(world.fauna[0].loyalty < 40);
  assert.equal(world.fauna[0].loyalty, world.fauna[1].loyalty);
});

test("explicit unknown actors fail closed before mutation", () => {
  const { world } = fixture();
  const before = JSON.stringify(world);
  for (const run of [() => commandHeal(world, "missing"), () => commandHunt(world, "prey", "missing"), () => tickPlayer(world, 1, "missing")]) {
    assert.throws(run, /Unknown actor/);
    assert.equal(JSON.stringify(world), before);
  }
});
