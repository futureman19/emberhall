import assert from "node:assert/strict";
import test from "node:test";
import { BUILD_ORDER } from "./catalog.ts";
import { FARM_BEDS } from "./farm.ts";
import { siteError } from "./building-size.ts";
import { createStubWorld, placeBuilding } from "./world.ts";
import type { BuildingKind, TileKind, World } from "./types.ts";

const TX = 100;
const TY = 100;

function snapshot(world: World) {
  return JSON.stringify(world);
}

function paint(world: World, kind: TileKind, tx = TX, ty = TY) {
  world.tiles[ty]![tx]!.kind = kind;
}

test("building-placement - hall, bank, and house kinds stay off the gold list", () => {
  const world = createStubWorld();
  const before = snapshot(world);
  assert.equal(siteError(world, "hall", TX, TY), "The hall already stands.");
  assert.equal(placeBuilding(world, "hall", TX, TY), "The hall already stands.");
  assert.equal(siteError(world, "bank", TX, TY), "The bank already stands.");
  assert.equal(placeBuilding(world, "bank", TX, TY), "The bank already stands.");
  for (const kind of ["porch", "hut", "homestead"] as const) {
    assert.equal(siteError(world, kind, TX, TY), "Raise a house from a deed.");
    assert.equal(placeBuilding(world, kind, TX, TY), "Raise a house from a deed.");
  }
  assert.equal(snapshot(world), before);
});

test("building-placement - water, wall, and pit are no footing", () => {
  for (const tile of ["water", "wall", "pit"] as const) {
    const world = createStubWorld();
    world.gold = 80;
    paint(world, tile);
    const before = snapshot(world);
    assert.equal(siteError(world, "kitchen", TX, TY), "No footing.");
    assert.equal(placeBuilding(world, "kitchen", TX, TY), "No footing.");
    assert.equal(snapshot(world), before);
  }
});

test("building-placement - one of each civic kind, gold 28, no mutation on refuse", () => {
  const world = createStubWorld();
  world.gold = 80;
  assert.equal(placeBuilding(world, "kitchen", TX, TY), null);
  assert.equal(world.gold, 52);
  const kitchen = world.buildings.find((b) => b.kind === "kitchen");
  assert.ok(kitchen);
  assert.equal(kitchen.tx, TX);
  assert.equal(kitchen.ty, TY);
  assert.deepEqual(kitchen.beds, []);
  const afterFirst = snapshot(world);
  assert.equal(siteError(world, "kitchen", TX + 20, TY), "The kitchen already stands.");
  assert.equal(placeBuilding(world, "kitchen", TX + 20, TY), "The kitchen already stands.");
  assert.equal(snapshot(world), afterFirst);
});

test("building-placement - overlap of a second kind is taken ground", () => {
  const world = createStubWorld();
  world.gold = 80;
  assert.equal(placeBuilding(world, "kitchen", TX, TY), null);
  const before = snapshot(world);
  assert.equal(siteError(world, "forge", TX, TY), "That ground is taken.");
  assert.equal(placeBuilding(world, "forge", TX, TY), "That ground is taken.");
  assert.equal(snapshot(world), before);
});

test("building-placement - short gold refuses without a building", () => {
  const world = createStubWorld();
  world.gold = 27;
  const before = snapshot(world);
  assert.equal(siteError(world, "forge", TX, TY), "Need 28 gold.");
  assert.equal(placeBuilding(world, "forge", TX, TY), "Need 28 gold.");
  assert.equal(snapshot(world), before);
  world.gold = 39;
  assert.equal(siteError(world, "dormitory", TX, TY), "Need 40 gold.");
  assert.equal(placeBuilding(world, "dormitory", TX, TY), "Need 40 gold.");
});

test("building-placement - dormitory costs 40 and plants two empty beds", () => {
  const world = createStubWorld();
  world.gold = 40;
  assert.equal(world.objectives.find((o) => o.id === "dorm")?.done, false);
  assert.equal(placeBuilding(world, "dormitory", TX, TY), null);
  assert.equal(world.gold, 0);
  const dorm = world.buildings.find((b) => b.kind === "dormitory");
  assert.ok(dorm);
  assert.deepEqual(dorm.beds, [{ occupantId: null }, { occupantId: null }]);
  assert.equal(world.objectives.find((o) => o.id === "dorm")?.done, true);
  assert.match(world.log[0]?.text ?? "", /dormitory/);
});

test("building-placement - farm costs 28, seeds beds, and ticks the farm objective", () => {
  const world = createStubWorld();
  world.gold = 28;
  assert.equal(world.plots.length, 0);
  assert.equal(world.objectives.find((o) => o.id === "farm")?.done, false);
  assert.equal(placeBuilding(world, "farm", TX, TY), null);
  assert.equal(world.gold, 0);
  assert.equal(world.plots.length, FARM_BEDS.length);
  assert.equal(world.objectives.find((o) => o.id === "farm")?.done, true);
  assert.ok(world.buildings.some((b) => b.kind === "farm"));
});

test("building-placement - BUILD_ORDER kinds are the gold-raised civic set", () => {
  assert.deepEqual(BUILD_ORDER, ["dormitory", "kitchen", "farm", "market", "forge", "tavern"]);
  for (const kind of BUILD_ORDER as BuildingKind[]) {
    const world = createStubWorld();
    world.gold = 80;
    assert.equal(siteError(world, kind, TX, TY), null);
    assert.equal(placeBuilding(world, kind, TX, TY), null);
  }
});
