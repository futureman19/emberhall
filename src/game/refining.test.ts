import assert from "node:assert/strict";
import test from "node:test";
import { addResource, makeResourceStackKey, resourceCount } from "./inventory/resources.ts";
import { findProcessingRoute, refineResource } from "./refining.ts";
import { createWorld } from "./world.ts";

const HIGHLAND_CHOICE_ORE = makeResourceStackKey("highland_ore", "ore", "choice");
const HIGHLAND_CHOICE_INGOT = makeResourceStackKey("highland_ore", "ingot", "choice");
const IRON_ROUGH_ORE = makeResourceStackKey("iron_ore", "ore", "rough");
const IRON_ROUGH_INGOT = makeResourceStackKey("iron_ore", "ingot", "rough");
const COPPER_SOUND_ORE = makeResourceStackKey("copper_ore", "ore", "sound");
const COPPER_SOUND_INGOT = makeResourceStackKey("copper_ore", "ingot", "sound");
const EMBERITE_CHOICE_ORE = makeResourceStackKey("emberite", "ore", "choice");
const EMBERITE_CHOICE_INGOT = makeResourceStackKey("emberite", "ingot", "choice");

test("refining - route discovery is shared between the command and the work gump", () => {
  const copper = findProcessingRoute("copper_ore", "ore");
  assert.equal(copper?.route.id, "smelt_copper_ore");
  assert.equal(copper?.owner.id, "copper_ore");
  const bronze = findProcessingRoute("copper_ore", "ingot");
  assert.equal(bronze?.route.id, "smelt_bronze", "copper ingots primary the bronze alloy route");
  assert.equal(bronze?.owner.id, "bronze");
  const emberite = findProcessingRoute("emberite", "ore");
  assert.equal(emberite?.route.id, "smelt_emberite");
  assert.equal(emberite?.owner.id, "emberite");
  assert.equal(findProcessingRoute("oak", "board"), null);
  assert.equal(findProcessingRoute("oak", "log")?.route.id, "saw_oak");
});

test("refining - bronze alloy debits both metals at the weakest-link grade", () => {
  const world = createWorld();
  const COPPER_CHOICE_INGOT = makeResourceStackKey("copper_ore", "ingot", "choice");
  const TIN_SOUND_INGOT = makeResourceStackKey("tin_ore", "ingot", "sound");
  const BRONZE_SOUND_INGOT = makeResourceStackKey("bronze", "ingot", "sound");
  addResource(world.player.resources, COPPER_CHOICE_INGOT, 3);
  addResource(world.player.resources, TIN_SOUND_INGOT, 2);
  const result = refineResource(world.player, COPPER_CHOICE_INGOT, "forge", 40);
  assert.deepEqual(result, {
    status: "refined",
    input: COPPER_CHOICE_INGOT,
    output: BRONZE_SOUND_INGOT,
    quantity: 3,
  });
  assert.equal(resourceCount(world.player.resources, COPPER_CHOICE_INGOT), 1, "2 copper consumed");
  assert.equal(resourceCount(world.player.resources, TIN_SOUND_INGOT), 1, "1 tin consumed");
  assert.equal(resourceCount(world.player.resources, BRONZE_SOUND_INGOT), 3, "weakest link sets the melt grade");
});

test("refining - bronze alloy names the missing secondary metal", () => {
  const world = createWorld();
  const COPPER_ROUGH_INGOT = makeResourceStackKey("copper_ore", "ingot", "rough");
  addResource(world.player.resources, COPPER_ROUGH_INGOT, 2);
  const result = refineResource(world.player, COPPER_ROUGH_INGOT, "forge", 40);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.equal(result.reason, "materials");
    assert.match(result.message, /tin/i);
  }
  assert.equal(resourceCount(world.player.resources, COPPER_ROUGH_INGOT), 2, "nothing consumed on a failed melt");
});

test("refining - bronze alloy respects its smithing gate", () => {
  const world = createWorld();
  const COPPER_ROUGH_INGOT = makeResourceStackKey("copper_ore", "ingot", "rough");
  const TIN_ROUGH_INGOT = makeResourceStackKey("tin_ore", "ingot", "rough");
  addResource(world.player.resources, COPPER_ROUGH_INGOT, 2);
  addResource(world.player.resources, TIN_ROUGH_INGOT, 1);
  const result = refineResource(world.player, COPPER_ROUGH_INGOT, "forge", 34);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") assert.equal(result.reason, "skill");
});

test("refining - bronze alloy melts the lowest-grade secondary stock first", () => {
  const world = createWorld();
  const COPPER_CHOICE_INGOT = makeResourceStackKey("copper_ore", "ingot", "choice");
  const TIN_SOUND_INGOT = makeResourceStackKey("tin_ore", "ingot", "sound");
  const TIN_PRISTINE_INGOT = makeResourceStackKey("tin_ore", "ingot", "pristine");
  addResource(world.player.resources, COPPER_CHOICE_INGOT, 2);
  addResource(world.player.resources, TIN_SOUND_INGOT, 1);
  addResource(world.player.resources, TIN_PRISTINE_INGOT, 1);
  const result = refineResource(world.player, COPPER_CHOICE_INGOT, "forge", 40);
  assert.equal(result.status, "refined");
  assert.equal(resourceCount(world.player.resources, TIN_SOUND_INGOT), 0, "weakest tin feeds the melt first");
  assert.equal(resourceCount(world.player.resources, TIN_PRISTINE_INGOT), 1, "pristine tin is saved for later");
  if (result.status === "refined") assert.equal(result.output, makeResourceStackKey("bronze", "ingot", "sound"));
});

test("refining - copper family and grade survive the forge at its lower gate", () => {
  const world = createWorld();
  addResource(world.player.resources, COPPER_SOUND_ORE, 2);
  const result = refineResource(world.player, COPPER_SOUND_ORE, "forge", 20);
  assert.deepEqual(result, {
    status: "refined",
    input: COPPER_SOUND_ORE,
    output: COPPER_SOUND_INGOT,
    quantity: 1,
  });
  assert.equal(resourceCount(world.player.resources, COPPER_SOUND_ORE), 1);
  assert.equal(resourceCount(world.player.resources, COPPER_SOUND_INGOT), 1);

  const before = structuredClone(world.player.resources);
  const unskilled = refineResource(world.player, COPPER_SOUND_ORE, "forge", 14);
  assert.equal(unskilled.status, "blocked");
  if (unskilled.status === "blocked") assert.equal(unskilled.reason, "skill");
  assert.deepEqual(world.player.resources, before);
});

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

test("refining - emberite holds its grade through the grandmaster smelt", () => {
  const world = createWorld();
  addResource(world.player.resources, EMBERITE_CHOICE_ORE, 2);
  const result = refineResource(world.player, EMBERITE_CHOICE_ORE, "forge", 80);
  assert.deepEqual(result, {
    status: "refined",
    input: EMBERITE_CHOICE_ORE,
    output: EMBERITE_CHOICE_INGOT,
    quantity: 1,
  });
  assert.equal(resourceCount(world.player.resources, EMBERITE_CHOICE_ORE), 1);
  assert.equal(resourceCount(world.player.resources, EMBERITE_CHOICE_INGOT), 1);

  const before = structuredClone(world.player.resources);
  const unskilled = refineResource(world.player, EMBERITE_CHOICE_ORE, "forge", 79);
  assert.equal(unskilled.status, "blocked");
  if (unskilled.status === "blocked") assert.equal(unskilled.reason, "skill");
  assert.deepEqual(world.player.resources, before);
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
