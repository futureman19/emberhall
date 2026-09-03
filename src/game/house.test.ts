import assert from "node:assert/strict";
import test from "node:test";
import { HOUSE_DEEDS, HOUSE_SLOTS, commandHouseItem, commandHouseTake, houseSiteError, isHouseKind, placeHouse } from "./house.ts";
import { setWorld } from "./live.ts";
import { you } from "./player.ts";
import { createWorld } from "./world.ts";
import { verbsFor } from "./context.ts";
import type { HouseKind } from "./house.ts";
import type { World } from "./types.ts";

function grassPlot(world: World) {
  const p = you(world)!;
  const tx = Math.round(p.x) + 12;
  const ty = Math.round(p.z) + 12;
  for (let z = ty - 6; z <= ty + 6; z++) {
    for (let x = tx - 6; x <= tx + 6; x++) {
      const tile = world.tiles[z]?.[x];
      if (tile) tile.kind = "grass";
    }
  }
  p.x = tx;
  p.z = ty;
  p.path = [];
  return { tx, ty };
}

function withDeed(world: World, kind: HouseKind) {
  world.player.pack[HOUSE_DEEDS[kind]] = 1;
}

test("house - three deeds, not carpentry-as-house", () => {
  assert.equal(HOUSE_DEEDS.porch, "deed_porch");
  assert.equal(HOUSE_DEEDS.hut, "deed_hut");
  assert.equal(HOUSE_DEEDS.homestead, "deed_homestead");
  assert.equal(isHouseKind("hall"), false);
  assert.equal(isHouseKind("hut"), true);
});

test("house - a deed plants a template on grass, not on the bank road", () => {
  const world = createWorld();
  const p = you(world)!;
  withDeed(world, "porch");
  assert.match(houseSiteError(world, "porch", Math.round(p.x), Math.round(p.z)) ?? "", /footing|taken|safe/i);

  const { tx, ty } = grassPlot(world);
  withDeed(world, "porch");
  assert.equal(houseSiteError(world, "porch", tx, ty), null);
  assert.equal(placeHouse(world, "porch", tx, ty), null);
  const house = world.buildings.find((b) => b.kind === "porch");
  assert.ok(house);
  assert.equal(house.ownerId, world.player.id);
  assert.equal(world.player.pack.deed_porch, 0);
  assert.equal(placeHouse(world, "porch", tx + 8, ty), "You already have a house.");
});

test("house - no deed, no house", () => {
  const world = createWorld();
  const { tx, ty } = grassPlot(world);
  assert.equal(houseSiteError(world, "hut", tx, ty), "Need a hut deed.");
});

test("house - ghost cannot raise or use the chest", () => {
  const world = createWorld();
  const { tx, ty } = grassPlot(world);
  withDeed(world, "hut");
  world.player.ghost = true;
  assert.equal(houseSiteError(world, "hut", tx, ty), "A ghost cannot.");
  world.player.ghost = false;
  assert.equal(placeHouse(world, "hut", tx, ty), null);
  const house = world.buildings.find((b) => b.kind === "hut")!;
  world.player.ghost = true;
  world.player.pack.board = 2;
  assert.equal(commandHouseItem(world, house.id, "board", 1), "A ghost cannot.");
});

test("house - locked chest holds goods, not the bank box", () => {
  const world = createWorld();
  const { tx, ty } = grassPlot(world);
  withDeed(world, "homestead");
  assert.equal(placeHouse(world, "homestead", tx, ty), null);
  const house = world.buildings.find((b) => b.kind === "homestead")!;
  world.player.pack.board = 3;
  const bankBefore = world.player.chest.board ?? 0;
  assert.equal(commandHouseItem(world, house.id, "board", 2), "Into the chest.");
  assert.equal(house.chest?.board, 2);
  assert.equal(world.player.pack.board, 1);
  assert.equal(world.player.chest.board ?? 0, bankBefore);
  assert.equal(commandHouseTake(world, house.id, "board", 1), "Out of the chest.");
  assert.equal(world.player.pack.board, 2);
  assert.equal(house.chest?.board, 1);
});

test("house - chest fills at eight kinds", () => {
  const world = createWorld();
  const { tx, ty } = grassPlot(world);
  withDeed(world, "porch");
  assert.equal(placeHouse(world, "porch", tx, ty), null);
  const house = world.buildings.find((b) => b.kind === "porch")!;
  const kinds = ["log", "board", "ore", "ingot", "meat", "hide", "bandage", "bread"] as const;
  assert.equal(kinds.length, HOUSE_SLOTS);
  for (const id of kinds) {
    world.player.pack[id] = 1;
    assert.equal(commandHouseItem(world, house.id, id, 1), "Into the chest.");
  }
  world.player.pack.wheat = 1;
  assert.equal(commandHouseItem(world, house.id, "wheat", 1), "The chest is full.");
});

test("house - a stranger cannot open the chest", () => {
  const world = createWorld();
  const { tx, ty } = grassPlot(world);
  withDeed(world, "porch");
  assert.equal(placeHouse(world, "porch", tx, ty), null);
  const house = world.buildings.find((b) => b.kind === "porch")!;
  house.ownerId = "someone-else";
  world.player.pack.log = 1;
  assert.equal(commandHouseItem(world, house.id, "log", 1), "That house is not yours.");
});

test("house - look hut is free on a live vale", () => {
  const world = createWorld();
  setWorld(world);
  const hut = world.buildings.find((b) => b.kind === "hut");
  assert.ok(hut);
  assert.equal(hut.ownerId, world.player.id);
  assert.equal(world.player.pack.deed_hut, 0);
  assert.equal(world.buildings.filter((b) => b.kind === "hut").length, 1);
});

test("house - the building offers the chest, not the civic bench", () => {
  const world = createWorld();
  setWorld(world);
  const verbs = verbsFor({ kind: "building", id: "h1", tx: 0, ty: 0, label: "hut" });
  assert.ok(verbs.some((v) => v.verb === "house" && v.label === "Open the chest"));
  assert.ok(!verbs.some((v) => v.verb === "use"));
});
