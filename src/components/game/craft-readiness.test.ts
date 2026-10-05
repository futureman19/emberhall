import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canMake, commandCraft, recipeById, stationsHere } from "../../game/craft.ts";
import { getWorld, setWorld } from "../../game/live.ts";
import { you } from "../../game/player.ts";
import { createWorld } from "../../game/world.ts";

const source = readFileSync(new URL("./craft-gump.tsx", import.meta.url), "utf8");

test("ordinary Recipes defaults to All with accessible ready toggle and recovery", () => {
  assert.match(source, /const \[readyOnly, setReadyOnly\] = useState\(false\)/);
  assert.match(source, /aria-pressed=\{readyOnly\}/);
  assert.match(source, /Ready to craft/);
  assert.match(source, /No recipes ready here/);
  assert.match(source, /Show all recipes/);
  assert.match(source, /visibleRecipes\(getWorld\(\), readyOnly\)/);
});

test("ready filter uses current materials, station, blade, ghost and fire without mutation", async () => {
  const { visibleRecipes } = await import("./recipe-filter.ts");
  const world = createWorld(1);
  const player = you(world)!;
  const yard = world.buildings.find((b) => b.kind === "yard")!;
  Object.assign(player, { x: yard.tx, z: yard.ty });
  for (const id of Object.keys(world.player.pack)) world.player.pack[id as keyof typeof world.player.pack] = 0;
  world.player.resources.stacks = { "oak:log:sound": 1, "highland_ore:ore:pristine": 8 };
  const has = (id: string) => visibleRecipes(world, true).some((r) => r.id === id);
  const before = structuredClone(world);
  assert.equal(has("board"), true);
  assert.equal(has("smelt"), false);
  assert.ok(visibleRecipes(world).length > visibleRecipes(world, true).length);
  assert.ok(visibleRecipes(world).every((r) => !r.exactRecipeId));
  assert.deepEqual(structuredClone(world), before);
  world.player.resources.stacks = {};
  assert.equal(has("board"), false);
  world.player.pack.silk = 3;
  world.player.wear.main = undefined;
  assert.equal(has("cut_bandage"), false);
  world.player.wear.main = "knife";
  assert.equal(has("cut_bandage"), true);
  world.player.ghost = true;
  assert.deepEqual(visibleRecipes(world, true), []);
  world.player.ghost = false;
  world.player.pack.log = 3;
  assert.equal(has("campfire"), true);
  const { placeCampfire } = await import("../../game/campfire.ts");
  placeCampfire(world);
  assert.equal(has("campfire"), false);
  world.player.pack.ore = 1;
  assert.equal(has("smelt"), false);
  const forge = world.buildings.find((b) => b.kind === "forge")!;
  Object.assign(player, { x: forge.tx, z: forge.ty });
  assert.equal(has("smelt"), true);
});

test("RecipeRow routes readiness through world-aware materials without removing station gate", () => {
  assert.match(source, /const ready = at && canMake\(getWorld\(\), rec\)/);
  assert.doesNotMatch(source, /haveNeed\(pack, rec\)/);
  assert.match(source, /disabled=\{!ready\}/);
  assert.match(source, /disabled=\{!ready \|\| max < 5\}/);
  assert.match(source, /const blocker = craftBlocker\(getWorld\(\), rec\)/);
  assert.match(source, /Next requirement: \{blocker\}/);
  assert.match(source, /&& !blocker/);
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
