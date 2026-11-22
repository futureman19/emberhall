import assert from "node:assert/strict";
import test from "node:test";
import { commandDrink, commandEat, commandCook, potionHealAmount, potionNightHours } from "./player.ts";
import { commandBankItem } from "./npcs.ts";
import { createPerson, createStubWorld } from "./world.ts";

function fixture() {
  const world = createStubWorld();
  const solo = createPerson(world, () => 0.5, { x: 10, z: 10, isPlayer: true });
  const npc = createPerson(world, () => 0.5, { x: 100, z: 100 });
  world.people = [solo, npc];
  world.player.id = solo.id;
  const sheet = structuredClone(world.player);
  sheet.id = npc.id;
  sheet.skills.alchemy = 50;
  sheet.pack.potion_heal = 1;
  sheet.pack.potion_night = 1;
  sheet.pack.trail_rations = 2;
  world.playerStates = { [npc.id]: sheet };
  world.hour = 100;
  return { world, solo, npc, sheet };
}

test("actor draughts heal its body and use its alchemy, inventory and night sight", () => {
  const { world, solo, npc, sheet } = fixture();
  npc.hp = 1;
  npc.maxHp = 100;
  const before = structuredClone(world.player);
  const body = structuredClone(solo);
  assert.equal(commandDrink(world, "potion_heal", npc.id), "The draught takes hold.");
  assert.equal(npc.hp, 1 + potionHealAmount(50));
  const skill = sheet.skills.alchemy;
  assert.equal(commandDrink(world, "potion_night", npc.id), "The dark thins.");
  assert.equal(sheet.nightSightUntil, world.hour + potionNightHours(skill));
  assert.equal(sheet.pack.potion_heal, 0);
  assert.equal(sheet.pack.potion_night, 0);
  assert.ok(sheet.skills.alchemy > 50);
  assert.deepEqual(world.player, before);
  assert.deepEqual(solo, body);
});

test("actor eats only its food and restores only its hunger through both aliases", () => {
  const { world, solo, npc, sheet } = fixture();
  npc.hunger = 0;
  const before = structuredClone(world.player);
  const body = structuredClone(solo);
  assert.match(commandEat(world, "trail_rations", npc.id), /rations/);
  assert.equal(npc.hunger, 60);
  assert.match(commandCook(world, undefined, npc.id), /rations/);
  assert.equal(npc.hunger, 100);
  assert.equal(sheet.pack.trail_rations, 0);
  assert.deepEqual(world.player, before);
  assert.deepEqual(solo, body);
});

test("consumption rejects unknown actors, ghosts and missing bodies before debit", () => {
  const { world, npc, sheet } = fixture();
  const before = structuredClone(world);
  for (const action of [() => commandDrink(world, "potion_heal", "missing"), () => commandEat(world, "trail_rations", "missing")]) assert.throws(action, /Unknown actor/);
  assert.deepEqual(structuredClone(world), before);
  sheet.ghost = true;
  assert.equal(commandDrink(world, "potion_heal", npc.id), "A ghost cannot.");
  assert.equal(commandEat(world, "trail_rations", npc.id), "A ghost cannot.");
  sheet.ghost = false;
  world.people = world.people.filter(p => p.id !== npc.id);
  assert.equal(commandDrink(world, "potion_heal", npc.id), "You are not in the vale.");
  assert.equal(commandEat(world, "trail_rations", npc.id), "You are not in the vale.");
  assert.equal(sheet.pack.potion_heal, 1);
  assert.equal(sheet.pack.trail_rations, 2);
});

test("legacy NPC bank export forwards explicit actor IDs", () => {
  const { world, npc, sheet } = fixture();
  const banker = createPerson(world, () => 0.5, { x: npc.x, z: npc.z });
  banker.role = "banker";
  world.people.push(banker);
  const before = structuredClone(world.player);
  assert.equal(commandBankItem(world, "trail_rations", 1, npc.id), "Into the box.");
  assert.equal(sheet.pack.trail_rations, 1);
  assert.equal(sheet.chest.trail_rations, 1);
  assert.deepEqual(world.player, before);
});
