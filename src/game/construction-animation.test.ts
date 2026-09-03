import assert from "node:assert/strict";
import test from "node:test";
import { siteError } from "./building-size.ts";
import { CONSTRUCTION_DURATION, constructionLabel, constructionPose, getConstructionFx } from "./construction-animation.ts";
import { HOUSE_DEEDS, houseSiteError, placeHouse } from "./house.ts";
import { you } from "./player.ts";
import { createWorld, placeBuilding } from "./world.ts";
import type { BuildingKind, World } from "./types.ts";

function clearSite(world: World, kind: BuildingKind, startX: number, startY: number) {
  const player = you(world)!;
  for (let ty = startY; ty < startY + 80; ty += 8) {
    for (let tx = startX; tx < startX + 80; tx += 8) {
      for (let z = ty - 8; z <= ty + 8; z += 1) {
        for (let x = tx - 8; x <= tx + 8; x += 1) {
          const tile = world.tiles[z]?.[x];
          if (tile) tile.kind = "grass";
        }
      }
      player.x = tx;
      player.z = ty;
      player.path = [];
      if (!siteError(world, kind, tx, ty)) return { tx, ty };
    }
  }
  throw new Error(`no construction test site for ${kind}`);
}

function clearHouseSite(world: World) {
  const player = you(world)!;
  const tx = Math.round(player.x) + 12;
  const ty = Math.round(player.z) + 12;
  for (let z = ty - 6; z <= ty + 6; z += 1) {
    for (let x = tx - 6; x <= tx + 6; x += 1) {
      const tile = world.tiles[z]?.[x];
      if (tile) tile.kind = "grass";
    }
  }
  player.x = tx;
  player.z = ty;
  player.path = [];
  return { tx, ty };
}

test("construction animation - pose rises, hammers, and returns to rest", () => {
  assert.deepEqual(constructionPose(0), { crouch: 0, lean: 0, hammer: 0, lift: 0 });
  const active = constructionPose(CONSTRUCTION_DURATION * 0.45);
  assert.ok(active.crouch > 0.1);
  assert.ok([0.28, 0.36, 0.44].some((phase) => Math.abs(constructionPose(CONSTRUCTION_DURATION * phase).hammer) > 0.4));
  assert.ok(active.lift > 0.7);
  assert.deepEqual(constructionPose(CONSTRUCTION_DURATION), { crouch: 0, lean: 0, hammer: 0, lift: 1 });
  assert.equal(constructionLabel("forge"), "Forge");
});

test("construction animation - civic placement emits after preserving cost and farm setup", () => {
  const world = createWorld();
  const { tx, ty } = clearSite(world, "farm", 300, 340);
  const gold = world.gold;
  const plots = world.plots.length;

  assert.equal(placeBuilding(world, "farm", tx, ty), null);
  const building = world.buildings.find((entry) => entry.kind === "farm" && entry.tx === tx && entry.ty === ty)!;
  assert.ok(building);
  assert.equal(world.gold, gold - 28);
  assert.equal(world.plots.length, plots + 8);
  assert.deepEqual(getConstructionFx(world), { buildingId: building.id, kind: "farm", x: tx, z: ty, at: world.hour, source: "gold" });
});

test("construction animation - deed house placement emits without changing ownership", () => {
  const world = createWorld();
  world.player.pack[HOUSE_DEEDS.porch] = 1;
  const { tx, ty } = clearHouseSite(world);
  assert.equal(houseSiteError(world, "porch", tx, ty), null);
  assert.equal(placeHouse(world, "porch", tx, ty), null);
  const house = world.buildings.find((entry) => entry.kind === "porch")!;
  assert.equal(world.player.pack.deed_porch, 0);
  assert.equal(house.ownerId, world.player.id);
  assert.deepEqual(getConstructionFx(world), { buildingId: house.id, kind: "porch", x: tx, z: ty, at: world.hour, source: "deed" });
});

test("construction animation - rejected sites emit nothing", () => {
  const world = createWorld();
  const before = { gold: world.gold, buildings: world.buildings.length, plots: world.plots.length };
  assert.ok(placeBuilding(world, "farm", -1, -1));
  assert.equal(getConstructionFx(world), null);
  assert.deepEqual({ gold: world.gold, buildings: world.buildings.length, plots: world.plots.length }, before);
});
