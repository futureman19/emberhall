import assert from "node:assert/strict";
import test from "node:test";
import { addResource, makeResourceStackKey, resourceCount } from "./inventory/resources.ts";
import { refineResource } from "./refining.ts";
import { createWorld } from "./world.ts";

const HIGHLAND_CHOICE_ORE = makeResourceStackKey("highland_ore", "ore", "choice");
const HIGHLAND_CHOICE_INGOT = makeResourceStackKey("highland_ore", "ingot", "choice");
const IRON_ROUGH_ORE = makeResourceStackKey("iron_ore", "ore", "rough");
const IRON_ROUGH_INGOT = makeResourceStackKey("iron_ore", "ingot", "rough");

test("refining - ore family and grade survive exact forge processing", () => {
  const world = createWorld();
  addResource(world.player.resources, HIGHLAND_CHOICE_ORE, 2);
  const result = refineResource(world.player, HIGHLAND_CHOICE_ORE, "forge", 100);
  assert.deepEqual(result, {
    status: "refined",
    input: HIGHLAND_CHOICE_ORE,
    output: HIGHLAND_CHOICE_INGOT,
    quantity: 1,
  });
  assert.equal(resourceCount(world.player.resources, HIGHLAND_CHOICE_ORE), 1);
  assert.equal(resourceCount(world.player.resources, HIGHLAND_CHOICE_INGOT), 1);
});

test("refining - ordinary iron follows the same retained-identity route", () => {
  const world = createWorld();
  addResource(world.player.resources, IRON_ROUGH_ORE, 1);
  assert.equal(refineResource(world.player, IRON_ROUGH_ORE, "forge", 0).status, "refined");
  assert.equal(resourceCount(world.player.resources, IRON_ROUGH_ORE), 0);
  assert.equal(resourceCount(world.player.resources, IRON_ROUGH_INGOT), 1);
});

test("refining - station, skill, and shortage rejects are non-mutating", () => {
  const world = createWorld();
  addResource(world.player.resources, HIGHLAND_CHOICE_ORE, 1);
  for (const [station, skill, reason] of [
    ["bench", 100, "station"],
    ["forge", 34, "skill"],
  ] as const) {
    const before = structuredClone(world.player.resources);
    const result = refineResource(world.player, HIGHLAND_CHOICE_ORE, station, skill);
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") assert.equal(result.reason, reason);
    assert.deepEqual(world.player.resources, before);
  }
  world.player.resources.stacks = {};
  const shortage = refineResource(world.player, HIGHLAND_CHOICE_ORE, "forge", 100);
  assert.equal(shortage.status, "blocked");
  if (shortage.status === "blocked") assert.equal(shortage.reason, "materials");
});
