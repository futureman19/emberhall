import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canMake, commandCraft, recipeById, stationsHere } from "../../game/craft.ts";
import { getWorld, setWorld } from "../../game/live.ts";
import { you } from "../../game/player.ts";
import { createWorld } from "../../game/world.ts";

const source = readFileSync(new URL("./craft-gump.tsx", import.meta.url), "utf8");

test("RecipeRow routes readiness through world-aware materials without removing station gate", () => {
  assert.match(source, /const ready = at && canMake\(getWorld\(\), rec\)/);
  assert.doesNotMatch(source, /haveNeed\(pack, rec\)/);
  assert.match(source, /disabled=\{!ready\}/);
  assert.match(source, /disabled=\{!ready \|\| max < 5\}/);
});

test("live world typed iron readiness is pure, exact cost is retained, and rares never substitute", () => {
  setWorld(createWorld());
  const world = getWorld();
  const forge = world.buildings.find((b) => b.kind === "forge")!;
  const player = you(world)!;
  player.x = forge.tx;
  player.z = forge.ty;
  world.player.pack.ore = 0;
  world.player.pack.ingot = 0;
  world.player.skills.smithing = 100;
  world.player.resources.stacks = { "iron_ore:ore:sound": 1, "highland_ore:ore:pristine": 7, "ruby:gem:flawless": 5 };
  const rec = recipeById("smelt")!;
  const before = structuredClone(world.player);
  assert.equal(stationsHere(getWorld()).includes("forge"), true);
  assert.equal(canMake(getWorld(), rec), true);
  assert.deepEqual(world.player, before, "readiness must not spend materials");
  const random = Math.random;
  try {
    Math.random = () => 0.5;
    assert.match(commandCraft(getWorld(), "smelt") ?? "", /1 ingot/);
  } finally { Math.random = random; }
  assert.equal(world.player.pack.ingot, 1);
  assert.equal(world.player.pack.ore, 0);
  assert.equal(world.player.resources.stacks["iron_ore:ore:sound"] ?? 0, 0);
  assert.equal(world.player.resources.stacks["highland_ore:ore:pristine"], 7);
  assert.equal(world.player.resources.stacks["ruby:gem:flawless"], 5);
  const rareOnly = structuredClone(world.player);
  assert.equal(canMake(getWorld(), rec), false);
  assert.deepEqual(world.player, rareOnly);
  world.player.resources.stacks["iron_ore:ore:sound"] = 1;
  player.x = 0; player.z = 0;
  assert.equal(stationsHere(getWorld()).includes("forge"), false);
  assert.equal(stationsHere(getWorld()).includes("forge") && canMake(getWorld(), rec), false);
  const away = structuredClone(world.player);
  assert.match(commandCraft(getWorld(), "smelt") ?? "", /forge|stand/i);
  assert.deepEqual(world.player, away, "away from station cannot consume materials");
});
