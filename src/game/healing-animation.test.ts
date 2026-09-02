import assert from "node:assert/strict";
import test from "node:test";
import { HEALING_DURATION, healingPose, healingPulse } from "./healing-animation.ts";
import { commandHeal, getHealingFx, you } from "./player.ts";
import { createWorld } from "./world.ts";

test("bandaging pose leans in, holds the wrap, and returns to rest", () => {
  assert.deepEqual(healingPose(0), { lean: 0, crouch: 0, wrap: 0 });
  const working = healingPose(HEALING_DURATION * 0.45);
  assert.ok(working.lean > 0.2);
  assert.ok(working.crouch > 0.1);
  assert.ok(working.wrap > 0.8);
  const recovered = healingPose(HEALING_DURATION);
  assert.ok(recovered.lean < 0.01);
  assert.ok(recovered.crouch < 0.01);
  assert.ok(recovered.wrap < 0.01);
});

test("recovery pulse rises and fades inside the healing window", () => {
  assert.equal(healingPulse(-1), 0);
  assert.equal(healingPulse(0), 0);
  assert.ok(healingPulse(HEALING_DURATION * 0.55) > 0.8);
  assert.equal(healingPulse(HEALING_DURATION), 0);
});

test("successful bandaging emits exact recovery feedback at the patient", () => {
  const world = createWorld();
  const patient = you(world)!;
  patient.hp = 10;
  world.player.skills.healing = 20;
  world.player.pack.bandage = 2;
  const before = patient.hp;
  assert.equal(commandHeal(world), "The cloth holds.");
  assert.equal(world.player.pack.bandage, 1);
  assert.equal(patient.hp, before + 10);
  const fx = getHealingFx();
  assert.ok(fx);
  assert.equal(fx.amount, 10);
  assert.equal(fx.x, patient.x);
  assert.equal(fx.z, patient.z);
  assert.equal(fx.at, world.hour);
});
