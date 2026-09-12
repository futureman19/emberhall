import assert from "node:assert/strict";
import test from "node:test";
import { commandCraft } from "./craft.ts";
import { LIVE_SKILLS } from "./catalog.ts";
import {
  commandDrink,
  potionHealAmount,
  potionNightHours,
  you,
} from "./player.ts";
import { createWorld } from "./world.ts";

function withRoll<T>(value: number, action: () => T): T {
  const original = Math.random;
  Math.random = () => value;
  try {
    return action();
  } finally {
    Math.random = original;
  }
}

test("alchemy - draught math", () => {
  assert.equal(potionHealAmount(0), 12);
  assert.equal(potionHealAmount(8), 13);
  assert.equal(potionHealAmount(100), 24);
  assert.equal(potionNightHours(0), 8);
  assert.equal(potionNightHours(25), 9);
  assert.equal(potionNightHours(100), 12);
  assert.ok(LIVE_SKILLS.includes("alchemy"));
});

test("alchemy - garlic and ginseng stir a heal draught in the field", () => {
  const world = createWorld();
  world.player.skills.alchemy = 100;
  world.player.pack.garlic = 1;
  world.player.pack.ginseng = 1;
  world.player.pack.potion_heal = 0;
  const note = withRoll(0, () => commandCraft(world, "potion_heal"));
  assert.match(note ?? "", /Heal potion|heal potion/i);
  assert.equal(world.player.pack.potion_heal, 1);
  assert.equal(world.player.pack.garlic, 0);
  assert.equal(world.player.pack.ginseng, 0);
  assert.ok(world.player.skills.alchemy >= 100);
});

test("alchemy - a red draught closes a wound", () => {
  const world = createWorld();
  const patient = you(world)!;
  patient.hp = 10;
  world.player.skills.alchemy = 8;
  world.player.pack.potion_heal = 1;
  assert.equal(commandDrink(world, "potion_heal"), "The draught takes hold.");
  assert.equal(patient.hp, 10 + potionHealAmount(8));
  assert.equal(world.player.pack.potion_heal, 0);
});

test("alchemy - silk and ash thin the dark", () => {
  const world = createWorld();
  world.player.skills.alchemy = 50;
  world.player.pack.silk = 1;
  world.player.pack.ash = 1;
  world.player.pack.potion_night = 0;
  withRoll(0, () => commandCraft(world, "potion_night"));
  assert.equal(world.player.pack.potion_night, 1);
  assert.equal(commandDrink(world, "potion_night"), "The dark thins.");
  assert.equal(world.player.nightSightUntil, world.hour + potionNightHours(50));
  assert.equal(world.player.pack.potion_night, 0);
});

test("alchemy - a ghost cannot brew or drink", () => {
  const world = createWorld();
  world.player.ghost = true;
  you(world)!.ghost = true;
  world.player.pack.garlic = 1;
  world.player.pack.ginseng = 1;
  world.player.pack.potion_heal = 1;
  assert.equal(commandCraft(world, "potion_heal"), "A ghost cannot.");
  assert.equal(commandDrink(world, "potion_heal"), "A ghost cannot.");
});
