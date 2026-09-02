import assert from "node:assert/strict";
import test from "node:test";
import { CRAFTING_DURATION, craftingPose, craftingVisualProfile } from "./crafting-animation.ts";
import { commandCraft, getCraftFx } from "./craft.ts";
import { addResource, makeResourceStackKey } from "./inventory/resources.ts";
import { you } from "./player.ts";
import type { World } from "./types.ts";
import { createWorld } from "./world.ts";

function standAt(world: World, kind: "yard" | "forge") {
  const building = world.buildings.find((candidate) => candidate.kind === kind);
  assert.ok(building);
  const player = you(world)!;
  player.x = building.tx;
  player.z = building.ty;
  player.path = [];
}

function withRoll<T>(value: number, action: () => T) {
  const random = Math.random;
  Math.random = () => value;
  try {
    return action();
  } finally {
    Math.random = random;
  }
}

test("smithing, carpentry, and cooking have distinct deterministic motion", () => {
  const age = CRAFTING_DURATION * 0.45;
  const smith = craftingPose("smithing", age);
  const carpenter = craftingPose("carpentry", age);
  const cook = craftingPose("cooking", age);
  assert.notDeepEqual(smith, carpenter);
  assert.notDeepEqual(carpenter, cook);
  assert.notDeepEqual(craftingVisualProfile("smithing"), craftingVisualProfile("cooking"));
  assert.deepEqual(craftingPose("smithing", CRAFTING_DURATION), { work: 0, strike: 0, stir: 0 });
});

test("successful bench work emits a carpentry event", () => {
  const world = createWorld();
  standAt(world, "yard");
  world.player.skills.carpentry = 100;
  world.player.pack.log = 1;
  assert.match(withRoll(0, () => commandCraft(world, "board")) ?? "", /boards/);
  assert.equal(getCraftFx()?.kind, "carpentry");
  assert.equal(getCraftFx()?.success, true);
});

test("successful forge work emits a smithing event", () => {
  const world = createWorld();
  standAt(world, "forge");
  world.player.skills.smithing = 100;
  addResource(world.player.resources, makeResourceStackKey("iron_ore", "ore", "rough"), 1);
  assert.match(withRoll(0, () => commandCraft(world, "smelt")) ?? "", /ingot/);
  assert.equal(getCraftFx()?.kind, "smithing");
  assert.equal(getCraftFx()?.success, true);
});

test("campfire work emits a cooking event", () => {
  const world = createWorld();
  world.player.skills.cooking = 100;
  world.player.pack.log = 3;
  assert.match(withRoll(0, () => commandCraft(world, "campfire")) ?? "", /fire crackles/);
  assert.equal(getCraftFx()?.kind, "cooking");
  assert.equal(getCraftFx()?.success, true);
});
