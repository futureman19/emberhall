import assert from "node:assert/strict";
import test from "node:test";
import { availableCraftIngredient, bladeInHand, canMake, commandCraft, commandCraftBatch, commandCraftExact, commandRefineExact, craftBlocker, getCraftFx, maxCraftable, missingNeed, recipeById, stationsHere } from "./craft.ts";
import { applyItemInlay } from "./inlay.ts";
import { addResource, makeResourceStackKey, resourceCount } from "./inventory/resources.ts";
import { createPerson, createStubWorld } from "./world.ts";

function fixture() {
  const world = createStubWorld();
  world.tiles = []; // Craft domain tests do not need terrain/pathfinding.
  const solo = createPerson(world, () => 0.5, { x: 10, z: 10, isPlayer: true });
  const npc = createPerson(world, () => 0.5, { x: 100, z: 100 });
  world.people.push(solo, npc);
  world.player.id = solo.id;
  const actor = structuredClone(world.player);
  actor.id = npc.id;
  actor.pack = {} as typeof actor.pack;
  actor.resources = { stacks: {} };
  actor.wear.main = "knife";
  actor.skills.cooking = 50;
  actor.skills.tailoring = 50;
  actor.skills.carpentry = 50;
  actor.skills.smithing = 50;
  actor.skills.alchemy = 50;
  actor.skills.healing = 50;
  world.playerStates = { [npc.id]: actor };
  world.hour = 100;
  return { world, solo, npc, actor };
}

function roll<T>(action: () => T): T {
  const original = Math.random;
  Math.random = () => 0.5;
  try { return action(); } finally { Math.random = original; }
}

function station(world: ReturnType<typeof fixture>["world"], definitionId: string) {
  world.placedObjects.push({ id: definitionId, definitionId, definitionVersion: 1, tx: 100, ty: 100, level: 0, rotation: 0, materialSlots: {}, ownerId: world.player.id, structureId: null, name: null, state: {} });
}

test("actor field bandages use its blade, cloth and skill; solo is unchanged", () => {
  const { world, npc, actor } = fixture();
  actor.pack.silk = 2;
  world.player.wear.main = "mace";
  const before = structuredClone(world.player);
  assert.equal(bladeInHand(world, npc.id), true);
  const rec = recipeById("cut_bandage")!;
  assert.equal(canMake(world, rec, npc.id), true);
  assert.equal(maxCraftable(world, rec, npc.id), 2);
  assert.equal(missingNeed(world, rec, true, npc.id), null);
  assert.equal(craftBlocker(world, rec, npc.id), null);
  roll(() => commandCraftBatch(world, rec.id, 2, npc.id));
  assert.equal(actor.pack.bandage, 4);
  assert.equal(actor.pack.silk, 0);
  assert.ok(actor.skills.healing > 50);
  assert.deepEqual(world.player, before);
});

test("actor sewing and alchemy use stations near its own body", () => {
  const { world, npc, actor } = fixture();
  station(world, "loom");
  station(world, "alchemy_bench");
  actor.pack.silk = 3;
  actor.pack.garlic = 1;
  actor.pack.ginseng = 1;
  const before = structuredClone(world.player);
  assert.ok(stationsHere(world, npc.id).includes("loom"));
  assert.ok(!stationsHere(world).includes("loom"));
  roll(() => commandCraft(world, "sew_tunic", npc.id));
  roll(() => commandCraft(world, "potion_heal", npc.id));
  assert.equal(actor.pack.tunic, 1);
  assert.equal(actor.pack.potion_heal, 1);
  assert.ok(actor.skills.tailoring > 50);
  assert.ok(actor.skills.alchemy > 50);
  assert.equal(getCraftFx()?.x, npc.x);
  assert.deepEqual(world.player, before);
});

test("actor campfire and cooking use its harvested wood, location and food", () => {
  const { world, npc, actor } = fixture();
  const wood = makeResourceStackKey("oak", "log", "sound");
  addResource(actor.resources, wood, 3);
  actor.pack.meat = 1;
  actor.pack.bread = 1;
  const before = structuredClone(world.player);
  assert.equal(availableCraftIngredient(world, "log", npc.id), 3);
  roll(() => commandCraft(world, "campfire", npc.id));
  assert.equal(resourceCount(actor.resources, wood), 0);
  assert.equal(world.campfires[0]?.tx, npc.x);
  roll(() => commandCraft(world, "roast_meat", npc.id));
  roll(() => commandCraft(world, "trail_rations", npc.id));
  assert.equal(actor.pack.trail_rations, 1);
  assert.equal(getCraftFx()?.x, npc.x);
  assert.deepEqual(world.player, before);
});

test("actor exact refinement spends only its ore at its forge", () => {
  const { world, npc, actor } = fixture();
  station(world, "smith_working_forge");
  const ore = makeResourceStackKey("iron_ore", "ore", "sound");
  const ingot = makeResourceStackKey("iron_ore", "ingot", "sound");
  addResource(actor.resources, ore, 1);
  const before = structuredClone(world.player);
  assert.match(commandRefineExact(world, ore, npc.id), /Refined/);
  assert.equal(resourceCount(actor.resources, ore), 0);
  assert.equal(resourceCount(actor.resources, ingot), 1);
  assert.deepEqual(world.player, before);
});

test("actor exact bow, fletching and inlay preserve inventory and maker ownership", () => {
  const { world, npc, actor } = fixture();
  station(world, "bench_work");
  const wood = makeResourceStackKey("redwood", "log", "choice");
  const cloth = makeResourceStackKey("common_cloth", "cloth", "sound");
  const gem = makeResourceStackKey("ruby", "gem", "flawed");
  addResource(actor.resources, wood, 5);
  addResource(actor.resources, cloth, 1);
  addResource(actor.resources, gem, 1);
  actor.pack.board = 1;
  const before = structuredClone(world.player);
  roll(() => commandCraft(world, "fletch", npc.id));
  assert.equal(actor.pack.arrows, 5);
  roll(() => commandCraftExact(world, "bow", [{ role: "body", key: wood }, { role: "binding", key: cloth }], npc.id));
  assert.equal(actor.rares.length, 1);
  const item = actor.rares[0]!;
  assert.equal(item.maker, npc.name);
  assert.equal(resourceCount(actor.resources, wood), 0);
  assert.equal(applyItemInlay(actor, item.uid, gem).status, "inlaid");
  assert.equal(resourceCount(actor.resources, gem), 0);
  assert.deepEqual(world.player, before);
});

test("explicit unknown actor ids fail closed across craft commands and previews", () => {
  const { world } = fixture();
  const rec = recipeById("trail_rations")!;
  const ore = makeResourceStackKey("iron_ore", "ore", "sound");
  for (const id of ["missing", "", "__proto__", "toString"]) {
    const before = structuredClone(world);
    for (const action of [
      () => commandCraft(world, "trail_rations", id),
      () => commandCraftBatch(world, "trail_rations", 1, id),
      () => commandCraftExact(world, "bow", [], id),
      () => commandRefineExact(world, ore, id),
      () => stationsHere(world, id),
      () => bladeInHand(world, id),
      () => canMake(world, rec, id),
      () => maxCraftable(world, rec, id),
      () => missingNeed(world, rec, false, id),
      () => craftBlocker(world, rec, id),
      () => availableCraftIngredient(world, "log", id),
    ]) assert.throws(action, /Unknown actor/);
    assert.deepEqual(structuredClone(world), before);
  }
});

test("actor without a body cannot consume crafting materials", () => {
  const { world, actor, npc } = fixture();
  actor.pack.bread = 1;
  actor.pack.cooked_meat = 1;
  world.people = world.people.filter(p => p.id !== npc.id);
  const before = structuredClone(actor);
  const ore = makeResourceStackKey("iron_ore", "ore", "sound");
  for (const action of [
    () => commandCraft(world, "trail_rations", npc.id),
    () => commandCraftBatch(world, "trail_rations", 2, npc.id),
    () => commandCraftExact(world, "bow", [], npc.id),
    () => commandRefineExact(world, ore, npc.id),
  ]) assert.match(action() ?? "", /body/i);
  assert.deepEqual(actor, before);
});

test("explicit actor body-only ghosts cannot craft even with a living sheet", () => {
  const { world, npc, actor } = fixture();
  npc.ghost = true;
  actor.pack.bread = 1;
  actor.pack.cooked_meat = 1;
  const before = structuredClone(actor);
  const ore = makeResourceStackKey("iron_ore", "ore", "sound");
  assert.match(craftBlocker(world, recipeById("trail_rations")!, npc.id)!, /ghost/);
  for (const action of [
    () => commandCraft(world, "trail_rations", npc.id),
    () => commandCraftBatch(world, "trail_rations", 1, npc.id),
    () => commandCraftExact(world, "bow", [], npc.id),
    () => commandRefineExact(world, ore, npc.id),
  ]) assert.match(action()!, /ghost/);
  assert.deepEqual(actor, before);
});

test("omitted actor retains legacy solo crafting without a state map", () => {
  const { world, actor } = fixture();
  delete world.playerStates;
  world.player.pack.bread = 1;
  world.player.pack.cooked_meat = 1;
  world.player.skills.cooking = 50;
  const before = structuredClone(actor);
  roll(() => commandCraft(world, "trail_rations"));
  assert.equal(world.player.pack.trail_rations, 1);
  assert.deepEqual(actor, before);
});
