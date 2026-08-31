import assert from "node:assert/strict";
import test from "node:test";
import {
  canMake,
  commandCraft,
  commandCraftBatch,
  maxCraftable,
  missingNeed,
  recipeById,
} from "./craft.ts";
import { addResource, makeResourceStackKey, resourceCount } from "./inventory/resources.ts";
import { you } from "./player.ts";
import type { ResourceStackKey, World } from "./types.ts";
import { createWorld } from "./world.ts";

const OAK = {
  rough: makeResourceStackKey("oak", "log", "rough"),
  sound: makeResourceStackKey("oak", "log", "sound"),
  choice: makeResourceStackKey("oak", "log", "choice"),
  pristine: makeResourceStackKey("oak", "log", "pristine"),
} as const;
const IRON_ROUGH = makeResourceStackKey("iron_ore", "ore", "rough");
const REDWOOD = makeResourceStackKey("redwood", "log", "rough");
const HIGHLAND = makeResourceStackKey("highland_ore", "ore", "rough");
const RUBY = makeResourceStackKey("ruby", "gem", "cracked");
const SAPPHIRE = makeResourceStackKey("sapphire", "gem", "cracked");

function standAt(world: World, kind: "yard" | "forge"): void {
  const building = world.buildings.find((candidate) => candidate.kind === kind);
  assert.ok(building, `world has a ${kind}`);
  const player = you(world)!;
  player.x = building.tx;
  player.z = building.ty;
  player.path = [];
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

test("craft compatibility - rough harvested oak and iron feed the existing utility loop", () => {
  const boardWorld = createWorld();
  standAt(boardWorld, "yard");
  boardWorld.player.pack.log = 0;
  addResource(boardWorld.player.resources, OAK.rough, 2);
  const board = recipeById("board")!;
  assert.equal(canMake(boardWorld, board), true);
  assert.equal(missingNeed(boardWorld, board), null);
  boardWorld.player.skills.carpentry = 100;
  assert.match(withRoll(0.5, () => commandCraft(boardWorld, "board")) ?? "", /2 boards/);
  assert.equal(boardWorld.player.pack.log, 0);
  assert.equal(resourceCount(boardWorld.player.resources, OAK.rough), 1);

  const smeltWorld = createWorld();
  standAt(smeltWorld, "forge");
  smeltWorld.player.pack.ore = 0;
  addResource(smeltWorld.player.resources, IRON_ROUGH, 1);
  const smelt = recipeById("smelt")!;
  assert.equal(canMake(smeltWorld, smelt), true);
  assert.equal(missingNeed(smeltWorld, smelt), null);
  smeltWorld.player.skills.smithing = 100;
  assert.match(withRoll(0.5, () => commandCraft(smeltWorld, "smelt")) ?? "", /1 ingot/);
  assert.equal(smeltWorld.player.pack.ore, 0);
  assert.equal(resourceCount(smeltWorld.player.resources, IRON_ROUGH), 0);
});

test("craft compatibility - generic utility recipes never consume rare resource families", () => {
  const world = createWorld();
  standAt(world, "yard");
  world.player.pack.log = 0;
  addResource(world.player.resources, REDWOOD, 2);
  addResource(world.player.resources, HIGHLAND, 2);
  addResource(world.player.resources, RUBY, 1);
  addResource(world.player.resources, SAPPHIRE, 1);
  const before = structuredClone(world.player.resources);

  assert.equal(canMake(world, recipeById("board")!), false);
  assert.equal(missingNeed(world, recipeById("board")!), "Need log.");
  assert.equal(commandCraft(world, "board"), "Need log.");
  assert.deepEqual(world.player.resources, before);

  standAt(world, "forge");
  assert.equal(canMake(world, recipeById("smelt")!), false);
  assert.equal(commandCraft(world, "smelt"), "Need iron ore.");
  assert.deepEqual(world.player.resources, before);
});

test("craft compatibility - legacy first then typed low-to-high is deterministic across batches", () => {
  const world = createWorld();
  standAt(world, "yard");
  world.player.pack.log = 1;
  for (const key of Object.values(OAK)) addResource(world.player.resources, key, 1);
  const board = recipeById("board")!;

  assert.equal(maxCraftable(world, board), 5);
  world.player.skills.carpentry = 100;
  assert.match(withRoll(0.5, () => commandCraftBatch(world, "board", 3)) ?? "", /6 boards/);
  assert.equal(
    world.player.pack.log,
    0,
    "legacy generic log is protected from migration but spent first",
  );
  assert.equal(resourceCount(world.player.resources, OAK.rough), 0);
  assert.equal(resourceCount(world.player.resources, OAK.sound), 0);
  assert.equal(resourceCount(world.player.resources, OAK.choice), 1);
  assert.equal(resourceCount(world.player.resources, OAK.pristine), 1);
  assert.equal(maxCraftable(world, board), 2);
});

test("craft compatibility - failed attempts still consume one atomic adapted debit", () => {
  const world = createWorld();
  standAt(world, "yard");
  world.player.pack.log = 0;
  addResource(world.player.resources, OAK.rough, 1);
  world.player.skills.carpentry = 0;

  assert.match(withRoll(0.99, () => commandCraft(world, "board")) ?? "", /work splits/i);
  assert.equal(resourceCount(world.player.resources, OAK.rough), 0);
  assert.equal(world.player.pack.board ?? 0, 0);
});

test("craft compatibility - malformed unrelated typed stacks abort without mutation or random", () => {
  const world = createWorld();
  standAt(world, "yard");
  world.player.pack.log = 1;
  world.player.resources.stacks["ruby:log:rough" as ResourceStackKey] = 1;
  const before = structuredClone(world.player);
  const original = Math.random;
  Math.random = () => {
    throw new Error("craft preflight must not invoke random");
  };
  try {
    assert.throws(
      () => commandCraft(world, "board"),
      /form log is incompatible with resource ruby/,
    );
  } finally {
    Math.random = original;
  }
  assert.deepEqual(world.player, before);
});
