import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "./world.ts";
import { ensureCity } from "./city.ts";
import { commandBuy, commandSell, commandTalk } from "./npcs.ts";
import { APOTHECARY_STOCK, BUILDING_META, ITEM_META, NPC_META, SHOP_STOCK } from "./catalog.ts";
import type { Person, World } from "./types.ts";

function self(world: World): Person {
  const p = world.people.find((person) => person.isPlayer);
  assert.ok(p, "the player stands in the world");
  return p;
}

function alchemist(world: World): Person {
  const p = world.people.find((person) => person.role === "alchemist");
  assert.ok(p, "the Master Alchemist holds the apothecary");
  return p;
}

/** Stand the player at the counter, within counter reach of the master. */
function atApothecary(world: World): Person {
  const master = alchemist(world);
  const you = self(world);
  you.x = master.x + 0.5;
  you.z = master.z;
  you.path = [];
  return master;
}

test("apothecary - Kingsford stamps the shop and its Master Alchemist", () => {
  const world = createWorld();
  const building = world.buildings.find((b) => b.kind === "apothecary");
  assert.ok(building, "an apothecary stands on market row");
  assert.deepEqual({ tx: building.tx, ty: building.ty }, { tx: 176, ty: 343 });
  assert.equal(BUILDING_META.apothecary.label, "Apothecary");
  const master = alchemist(world);
  assert.equal(master.name, "Severin Ashe");
  assert.equal(NPC_META.alchemist.label, "Master Alchemist");
  // He keeps the shopfront, within counter reach of the door.
  assert.ok(Math.hypot(master.x - building.tx, master.z - building.ty) <= 3);
});

test("apothecary - old saves gain the shop on load, idempotently", () => {
  const world = createWorld();
  world.buildings = world.buildings.filter((b) => b.kind !== "apothecary");
  world.people = world.people.filter((p) => p.role !== "alchemist");
  const buildings = world.buildings.length;
  const people = world.people.length;
  ensureCity(world);
  assert.equal(world.buildings.length, buildings + 1, "the shop is stamped once");
  assert.equal(world.people.length, people + 1, "the master arrives once");
  assert.ok(world.buildings.some((b) => b.kind === "apothecary"));
  assert.ok(world.people.some((p) => p.role === "alchemist"));
  ensureCity(world);
  assert.equal(world.buildings.length, buildings + 1, "a second load adds nothing");
  assert.equal(world.people.length, people + 1);
});

test("apothecary - the counter stocks draughts and every reagent, nightshade among them", () => {
  for (const id of APOTHECARY_STOCK) assert.ok(ITEM_META[id].buy > 0, `${id} is priced`);
  assert.ok(APOTHECARY_STOCK.includes("potion_heal") && APOTHECARY_STOCK.includes("potion_night"));
  assert.ok(APOTHECARY_STOCK.includes("nightshade"), "the apothecary keeps what the provisioner will not");
  assert.ok(!SHOP_STOCK.includes("nightshade"));
  const world = createWorld();
  world.gold = 200;
  atApothecary(world);
  assert.equal(commandBuy(world, "potion_heal"), "Bought heal potion.");
  assert.equal(world.player.pack.potion_heal, 1);
  const shadeBefore = world.player.pack.nightshade ?? 0;
  assert.equal(commandBuy(world, "nightshade"), "Bought nightshade.");
  assert.equal(world.player.pack.nightshade, shadeBefore + 1);
});

test("apothecary - steel is not kept at the counter", () => {
  const world = createWorld();
  world.gold = 200;
  atApothecary(world);
  assert.equal(commandBuy(world, "hatchet"), "They do not keep that.");
  assert.equal(world.player.pack.hatchet ?? 0, 0);
});

test("apothecary - he buys reagents and draughts, not blades", () => {
  const world = createWorld();
  atApothecary(world);
  world.player.pack.garlic = 1;
  world.player.pack.potion_night = 1;
  world.player.pack.sword = 1;
  const gold = world.gold;
  assert.equal(commandSell(world, "garlic"), "Sold garlic.");
  assert.equal(commandSell(world, "potion_night"), "Sold night sight potion.");
  assert.equal(world.gold, gold + ITEM_META.garlic.sell + ITEM_META.potion_night.sell);
  assert.equal(commandSell(world, "sword"), "They will not take it.");
  assert.equal(world.player.pack.sword, 1);
});

test("apothecary - no keeper near means no trade (control)", () => {
  const world = createWorld();
  world.gold = 80;
  const you = self(world);
  you.x = 300;
  you.z = 300;
  you.path = [];
  assert.equal(commandBuy(world, "potion_heal"), "The keeper is not here.");
  assert.equal(world.gold, 80);
});

test("apothecary - the provisioner's counter is unchanged", () => {
  const world = createWorld();
  world.gold = 100;
  const wren = world.people.find((p) => p.name === "Wren Hall");
  assert.ok(wren);
  const you = self(world);
  you.x = wren.x + 0.5;
  you.z = wren.z;
  you.path = [];
  assert.equal(commandBuy(world, "potion_heal"), "They do not keep that.");
  assert.equal(commandBuy(world, "garlic"), "Bought garlic.");
});

test("apothecary - talk and the ghost's refusal", () => {
  const world = createWorld();
  const master = atApothecary(world);
  const line = commandTalk(world, master.id);
  assert.match(line ?? "", /Severin Ashe:/);
  const you = self(world);
  you.ghost = true;
  world.player.ghost = true;
  assert.equal(commandTalk(world, master.id), "Severin Ashe: The dead lack the blood for draughts.");
});
