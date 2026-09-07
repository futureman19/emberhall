import assert from "node:assert/strict";
import test from "node:test";
import { LIVE_SKILLS } from "./catalog.ts";
import { commandCraft, recipeById } from "./craft.ts";
import { createWorld } from "./world.ts";
import type { ItemId, World } from "./types.ts";

function givePack(w: World, items: Partial<Record<ItemId, number>>) {
  w.player.pack = { ...items } as World["player"]["pack"];
}

function withRoll<T>(value: number, action: () => T): T {
  const original = Math.random;
  Math.random = () => value;
  try {
    return action();
  } finally {
    Math.random = original;
  }
}

test("tailoring - hide shirt trains the needle, not the saw", () => {
  assert.ok(LIVE_SKILLS.includes("tailoring"));
  assert.equal(recipeById("cut_leather")?.skill, "tailoring");
  const world = createWorld();
  givePack(world, { hide: 2 });
  world.player.wear.main = "knife";
  world.player.skills.tailoring = 20;
  world.player.skills.carpentry = 12;
  const note = withRoll(0.5, () => commandCraft(world, "cut_leather"));
  assert.match(note ?? "", /leather/i);
  assert.equal(world.player.pack.leather, 1);
  assert.ok(world.player.skills.tailoring > 20);
  assert.equal(world.player.skills.carpentry, 12);
});

test("tailoring - silk becomes a tunic with a blade", () => {
  const world = createWorld();
  givePack(world, { silk: 3 });
  world.player.wear.main = "knife";
  world.player.skills.tailoring = 40;
  const note = withRoll(0.5, () => commandCraft(world, "sew_tunic"));
  assert.match(note ?? "", /tunic/i);
  assert.equal(world.player.pack.tunic, 1);
  assert.equal(world.player.pack.silk, 0);
});

test("tailoring - a cloak wants four cloth and an edge", () => {
  const world = createWorld();
  givePack(world, { silk: 4 });
  world.player.wear.main = "mace";
  world.player.skills.tailoring = 80;
  assert.equal(commandCraft(world, "sew_cloak"), "The work wants an edge. Hold a blade — hatchet, knife, or sword.");
  world.player.wear.main = "hatchet";
  const note = withRoll(0.5, () => commandCraft(world, "sew_cloak"));
  assert.match(note ?? "", /cloak/i);
  assert.equal(world.player.pack.cloak, 1);
});

test("tailoring - a ghost cannot stitch", () => {
  const world = createWorld();
  world.player.ghost = true;
  givePack(world, { hide: 2, silk: 3 });
  world.player.wear.main = "knife";
  assert.equal(commandCraft(world, "cut_leather"), "A ghost cannot.");
  assert.equal(commandCraft(world, "sew_tunic"), "A ghost cannot.");
});
