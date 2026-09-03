import assert from "node:assert/strict";
import test from "node:test";
import { commandHouseItem, commandHouseTake } from "./house.ts";
import { addToPile, takeFromPile, takeGoldFromPile } from "./piles.ts";
import {
  PERSONAL_ACTION_DURATION,
  getPersonalActionFx,
  personalActionLabel,
  personalActionPose,
} from "./personal-action-animation.ts";
import { commandDrop, commandEat, commandEquip, commandEquipRare, commandUnequip, you } from "./player.ts";
import { createWorld } from "./world.ts";
import type { World } from "./types.ts";

function ownedHouse(world: World) {
  const player = you(world)!;
  const house = {
    id: "phase-13-house",
    kind: "porch" as const,
    tx: player.x,
    ty: player.z,
    beds: [],
    ownerId: world.player.id,
    chest: { ...world.player.chest },
    chestGold: 0,
  };
  world.buildings.push(house);
  return house;
}

test("personal actions - pose envelopes clamp and action families stay distinct", () => {
  for (const kind of ["eat", "equipment", "ground", "chest"] as const) {
    assert.ok(Object.values(personalActionPose({ kind }, 0)).every((value) => value === 0));
    assert.ok(Object.values(personalActionPose({ kind }, PERSONAL_ACTION_DURATION)).every((value) => value === 0));
  }
  assert.ok(personalActionPose({ kind: "eat" }, PERSONAL_ACTION_DURATION / 2).reach > 0.8);
  assert.ok(personalActionPose({ kind: "ground" }, PERSONAL_ACTION_DURATION / 2).crouch > 0.19);
  assert.ok(personalActionPose({ kind: "chest" }, PERSONAL_ACTION_DURATION / 2).lean > 0.15);
});

test("personal actions - eating records the consumed meal after preserving priority and hunger", () => {
  const world = createWorld();
  const player = you(world)!;
  player.hunger = 50;
  world.player.pack.cooked_meat = 1;
  world.player.pack.cabbage = 1;

  assert.equal(commandEat(world), "Hot meat. Proper food.");
  assert.equal(player.hunger, 90);
  assert.equal(world.player.pack.cooked_meat, 0);
  assert.equal(world.player.pack.cabbage, 1);
  assert.deepEqual(getPersonalActionFx(world), {
    kind: "eat", item: "cooked_meat", fill: 40, x: player.x, z: player.z, at: world.hour,
  });
  assert.equal(personalActionLabel(getPersonalActionFx(world)!), "EAT · COOKED MEAT");

  world.player.pack.stew = 1;
  player.hunger = 100;
  assert.equal(commandEat(world), "The stew warms you through.");
  const fullFx = getPersonalActionFx(world);
  assert.ok(fullFx?.kind === "eat");
  assert.equal(fullFx.fill, 0, "the historical full-belly consumption still emits its zero gain");
});

test("personal actions - mundane equipment changes record only after exact swaps", () => {
  const world = createWorld();
  const player = you(world)!;
  world.player.pack.sword = 1;
  world.player.pack.mace = 1;

  assert.equal(commandEquip(world, "sword"), "You take the sword.");
  assert.equal(world.player.wear.main, "sword");
  assert.equal(world.player.pack.sword, 0);
  assert.deepEqual(getPersonalActionFx(world), {
    kind: "equipment", direction: "equip", item: "sword", slot: "main", rare: false, uid: null,
    x: player.x, z: player.z, at: world.hour,
  });
  assert.equal(commandEquip(world, "mace"), "You take the mace.");
  assert.equal(world.player.wear.main, "mace");
  assert.equal(world.player.pack.sword, 1);
  assert.equal(commandUnequip(world, "main"), "You put it away.");
  assert.equal(world.player.wear.main, undefined);
  assert.equal(world.player.pack.mace, 1);
  const unequipFx = getPersonalActionFx(world);
  assert.ok(unequipFx?.kind === "equipment");
  assert.equal(unequipFx.direction, "unequip");
});

test("personal actions - equipment covers rare changes, no-body mutation, same-item no-op, and stale rare cleanup", () => {
  const noOp = createWorld();
  noOp.player.wear.main = "sword";
  noOp.player.pack.sword = 1;
  assert.equal(commandEquip(noOp, "sword"), "You take the sword.");
  assert.equal(getPersonalActionFx(noOp), null, "unchanged mundane identity is not presented as a change");

  const bodiless = createWorld();
  bodiless.people = bodiless.people.filter((person) => !person.isPlayer && person.id !== bodiless.player.id);
  bodiless.player.pack.mace = 1;
  assert.equal(commandEquip(bodiless, "mace"), "You take the mace.");
  const bodilessFx = getPersonalActionFx(bodiless);
  assert.ok(bodilessFx?.kind === "equipment");
  assert.equal(bodilessFx.x, null);
  assert.equal(bodilessFx.z, null);

  const rareWorld = createWorld();
  const rare = {
    uid: "phase-13-wonder", base: "sword" as const, affixes: ["of force"], seed: 1, hour: 1,
    workmanship: "ordinary" as const, components: [], inlays: [], recipeId: "loot", recipeVersion: 1, source: "loot" as const,
  };
  rareWorld.player.rares.push(rare);
  assert.match(commandEquipRare(rareWorld, rare.uid), /sword/i);
  const rareFx = getPersonalActionFx(rareWorld);
  assert.ok(rareFx?.kind === "equipment");
  assert.equal(rareFx.uid, rare.uid);
  assert.equal(rareFx.rare, true);

  const stale = createWorld();
  stale.player.wearRare.main = "missing-uid";
  assert.equal(commandUnequip(stale, "main"), "You put it away.");
  const staleFx = getPersonalActionFx(stale);
  assert.ok(staleFx?.kind === "equipment");
  assert.equal(staleFx.item, null);
  assert.equal(staleFx.uid, "missing-uid");
});

test("personal actions - ordinary drop and pickup preserve pile transfer and ignore corpse feedback scope", () => {
  const world = createWorld();
  const player = you(world)!;
  world.player.pack.cabbage = 1;
  assert.equal(commandDrop(world, "cabbage"), "Dropped cabbage.");
  const pile = world.piles.find((candidate) => candidate.source === "drop")!;
  assert.equal(world.player.pack.cabbage, 0);
  assert.deepEqual(getPersonalActionFx(world), {
    kind: "ground", direction: "drop", item: "cabbage", count: 1, gold: 0,
    x: Math.round(player.x), z: Math.round(player.z), at: world.hour,
  });

  assert.equal(takeFromPile(world, pile.id, "cabbage"), null);
  assert.equal(world.player.pack.cabbage, 1);
  const pickupFx = getPersonalActionFx(world);
  assert.ok(pickupFx?.kind === "ground");
  assert.equal(pickupFx.direction, "pickup");

  const goldPile = addToPile(world, pile.tx + 1, pile.ty, {}, "drop", world.hour + 1, "coins", 7);
  assert.equal(takeGoldFromPile(world, goldPile.id), 7);
  const goldFx = getPersonalActionFx(world);
  assert.ok(goldFx?.kind === "ground");
  assert.equal(goldFx.gold, 7);
});

test("personal actions - owned house transfers record direction without touching the bank box", () => {
  const world = createWorld();
  const house = ownedHouse(world);
  const bankBefore = world.player.chest.board ?? 0;
  world.player.pack.board = 3;

  assert.equal(commandHouseItem(world, house.id, "board", 2), "Into the chest.");
  assert.equal(world.player.pack.board, 1);
  assert.equal(house.chest.board, 2);
  assert.equal(world.player.chest.board ?? 0, bankBefore);
  assert.deepEqual(getPersonalActionFx(world), {
    kind: "chest", direction: "in", buildingId: house.id, item: "board", count: 2,
    x: house.tx, z: house.ty, at: world.hour,
  });

  assert.equal(commandHouseTake(world, house.id, "board", 1), "Out of the chest.");
  assert.equal(world.player.pack.board, 2);
  assert.equal(house.chest.board, 1);
  const outFx = getPersonalActionFx(world);
  assert.ok(outFx?.kind === "chest");
  assert.equal(outFx.direction, "out");
});

test("personal actions - rejected commands do not emit and effects are world-isolated", () => {
  const world = createWorld();
  for (const item of ["stew", "cooked_meat", "bread", "cabbage", "wheat", "meat"] as const) world.player.pack[item] = 0;
  assert.equal(commandEat(world), "Need meat, cabbage, or wheat.");
  assert.equal(commandDrop(world, "cabbage"), "You do not carry that.");
  assert.equal(commandEquip(world, "sword"), "You do not carry that.");
  assert.equal(commandUnequip(world, "off"), "Nothing there.");
  assert.equal(takeFromPile(world, "missing"), "Nothing there.");
  assert.equal(getPersonalActionFx(world), null);

  const other = createWorld();
  other.player.pack.bread = 1;
  assert.equal(commandEat(other), "Fresh bread.");
  assert.equal(getPersonalActionFx(world), null);
  assert.equal(getPersonalActionFx(other)?.kind, "eat");

  const empty = createWorld();
  const emptyPile = addToPile(empty, 1, 1, {}, "drop", empty.hour + 1, "empty");
  assert.equal(takeFromPile(empty, emptyPile.id), null);
  assert.equal(getPersonalActionFx(empty), null, "empty take-all preserves its old return but emits no false pickup");
});
