import assert from "node:assert/strict";
import test from "node:test";
import { commandCast, getFizzleFx } from "./magery.ts";
import { tickPlayer, you } from "./player.ts";
import { createWorld } from "./world.ts";

test("failed spellcasting emits a visible fizzle event at the caster", () => {
  const world = createWorld();
  const player = you(world)!;
  world.player.pack.spellbook = 1;
  world.player.pack.silk = 2;
  world.player.pack.ash = 2;
  world.player.mana = 100;
  world.player.skills.magery = 0;
  assert.equal(commandCast(world, "nightsight", { kind: "self", id: player.id }), null);
  const random = Math.random;
  Math.random = () => 0.999;
  try {
    assert.match(String(tickPlayer(world, 0.93)), /fizzles/);
  } finally {
    Math.random = random;
  }
  const fx = getFizzleFx();
  assert.ok(fx);
  assert.equal(fx.spell, "nightsight");
  assert.equal(fx.x, player.x);
  assert.equal(fx.z, player.z);
});
