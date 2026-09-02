import assert from "node:assert/strict";
import test from "node:test";
import { commandHarvest, commandPlant, commandTill, harvestNow, plantNow, tillNow } from "./farm.ts";
import { commandPlantTree, plantTreeNow } from "./forestry.ts";
import { GATHERING_DURATION, gatheringPose, gatheringVisualProfile, getGatheringFx } from "./gathering-animation.ts";
import { you } from "./player.ts";
import { createWorld } from "./world.ts";

function fieldWorld(tx = 240, ty = 280) {
  const world = createWorld();
  const player = you(world)!;
  player.x = tx;
  player.z = ty;
  player.path = [];
  world.tiles[ty]![tx]!.kind = "grass";
  world.player.wear.main = "hoe";
  world.player.skills.farming = 100;
  return world;
}

test("gathering poses are distinct, bounded, and return to rest", () => {
  const mid = GATHERING_DURATION / 2;
  assert.ok(gatheringPose("tilling", GATHERING_DURATION / 12).strike > 0);
  assert.ok(gatheringPose("sowing", mid).scatter > 0);
  assert.ok(gatheringPose("harvesting", GATHERING_DURATION / 4).pull > 0);
  assert.ok(gatheringPose("forestry", mid).settle > 0);
  for (const kind of ["tilling", "sowing", "harvesting", "forestry"] as const) {
    assert.equal(gatheringPose(kind, GATHERING_DURATION + 1).work, 0);
    assert.notEqual(gatheringVisualProfile(kind).label, "");
  }
});

test("tilling and sowing emit exact plot feedback", () => {
  const world = fieldWorld();
  assert.equal(commandTill(world, 240, 280), null);
  assert.match(tillNow(world), /bed/i);
  assert.deepEqual(getGatheringFx(), { kind: "tilling", success: true, x: 240, z: 280, at: world.hour, subject: null });

  world.player.pack.cabbage_seed = 1;
  assert.equal(commandPlant(world, 240, 280, "cabbage"), null);
  assert.match(plantNow(world), /seed takes/i);
  assert.deepEqual(getGatheringFx(), { kind: "sowing", success: true, x: 240, z: 280, at: world.hour, subject: "cabbage" });
});

test("harvesting records success and tree planting records its species", () => {
  const world = fieldWorld();
  commandTill(world, 240, 280);
  tillNow(world);
  world.player.pack.cabbage_seed = 1;
  commandPlant(world, 240, 280, "cabbage");
  plantNow(world);
  world.plots[0]!.stage = 3;
  assert.equal(commandHarvest(world, 240, 280), null);
  const random = Math.random;
  Math.random = () => 0;
  try {
    assert.match(harvestNow(world), /cabbage/i);
  } finally {
    Math.random = random;
  }
  assert.deepEqual(getGatheringFx(), { kind: "harvesting", success: true, x: 240, z: 280, at: world.hour, subject: "cabbage" });

  const treeWorld = fieldWorld(241, 281);
  treeWorld.player.pack.acorn = 1;
  treeWorld.player.skills.forestry = 0;
  assert.equal(commandPlantTree(treeWorld, 241, 281), null);
  assert.match(plantTreeNow(treeWorld), /oak takes/i);
  assert.deepEqual(getGatheringFx(), { kind: "forestry", success: true, x: 241, z: 281, at: treeWorld.hour, subject: "oak" });
});
