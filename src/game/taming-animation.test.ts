import assert from "node:assert/strict";
import test from "node:test";
import { TAMING_DURATION, tamingPose, tamingPulse } from "./taming-animation.ts";
import { commandTame, getTamingFx, tickPlayer, you } from "./player.ts";
import { createWorld } from "./world.ts";
import type { Creature } from "./types.ts";

function tamingWorld() {
  const world = createWorld();
  const player = you(world)!;
  const target: Creature = {
    id: "taming-hare",
    kind: "hare",
    x: player.x + 1,
    z: player.z,
    hp: 8,
    maxHp: 8,
    path: [],
    task: "idle",
    taskUntil: 0,
    corpseUntil: 0,
    home: { tx: Math.round(player.x + 1), ty: Math.round(player.z) },
    ownerId: null,
    loyalty: 0,
    stay: false,
  };
  world.fauna.push(target);
  player.path = [];
  return { world, target };
}

test("taming pose opens both hands and peaks before the bond resolves", () => {
  assert.deepEqual(tamingPose(0), { reach: 0, bow: 0 });
  const appeal = tamingPose(TAMING_DURATION * 0.55);
  assert.ok(appeal.reach > 0.9);
  assert.ok(appeal.bow > 0.15);
  assert.deepEqual(tamingPose(TAMING_DURATION), { reach: 0, bow: 0 });
  assert.ok(tamingPulse(TAMING_DURATION * 0.5) > 0.9);
});

test("successful taming emits a gold bond result on the target", () => {
  const { world, target } = tamingWorld();
  world.player.skills.taming = 100;
  assert.equal(commandTame(world, target.id), null);
  const random = Math.random;
  Math.random = () => 0;
  try {
    assert.match(String(tickPlayer(world, TAMING_DURATION + 0.01)), /is yours/);
  } finally {
    Math.random = random;
  }
  const fx = getTamingFx();
  assert.ok(fx);
  assert.equal(fx.targetId, target.id);
  assert.equal(fx.success, true);
  assert.equal(target.ownerId, world.player.id);
});

test("failed taming emits a refusal result before the animal flees", () => {
  const { world, target } = tamingWorld();
  world.player.skills.taming = 0;
  assert.equal(commandTame(world, target.id), null);
  const random = Math.random;
  Math.random = () => 0.999;
  try {
    assert.equal(tickPlayer(world, TAMING_DURATION + 0.01), "It will not yield.");
  } finally {
    Math.random = random;
  }
  const fx = getTamingFx();
  assert.ok(fx);
  assert.equal(fx.targetId, target.id);
  assert.equal(fx.success, false);
  assert.equal(target.task, "flee");
});
