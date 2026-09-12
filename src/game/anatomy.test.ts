import assert from "node:assert/strict";
import test from "node:test";
import {
  anatomyBonus,
  anatomyCritChance,
  bandageHealAmount,
  commandHeal,
  tickPlayer,
  you,
} from "./player.ts";
import { createWorld } from "./world.ts";
import type { Creature } from "./types.ts";

test("anatomy - bonus and crit scale, bandage uses both skills", () => {
  assert.equal(anatomyBonus(0), 0);
  assert.equal(anatomyBonus(19), 0);
  assert.equal(anatomyBonus(20), 1);
  assert.equal(anatomyBonus(100), 5);
  assert.equal(anatomyCritChance(0), 0);
  assert.equal(anatomyCritChance(100), 0.2);
  assert.equal(bandageHealAmount(20, 0), 10);
  assert.equal(bandageHealAmount(20, 40), 12);
});

test("anatomy - a wrap knows the wound", () => {
  const world = createWorld();
  const patient = you(world)!;
  patient.hp = 10;
  world.player.skills.healing = 20;
  world.player.skills.anatomy = 40;
  world.player.pack.bandage = 1;
  assert.equal(commandHeal(world), "The cloth holds.");
  assert.equal(patient.hp, 22);
});

function withRoll(v: number, fn: () => void) {
  const old = Math.random;
  Math.random = () => v;
  try {
    fn();
  } finally {
    Math.random = old;
  }
}

function hareBeside(world: ReturnType<typeof createWorld>, hp: number): Creature {
  const p = you(world)!;
  const hare: Creature = {
    id: "anatomy-hare",
    kind: "hare",
    x: p.x + 1,
    z: p.z,
    hp,
    maxHp: hp,
    path: [],
    task: "idle",
    taskUntil: 0,
    corpseUntil: 0,
    home: { tx: Math.round(p.x + 1), ty: Math.round(p.z) },
    ownerId: null,
    loyalty: 0,
    stay: false,
  };
  world.fauna.push(hare);
  world.player.skills.swords = 100;
  world.player.intent = {
    kind: "hunt",
    tx: Math.round(hare.x),
    ty: Math.round(hare.z),
    targetId: hare.id,
    spell: null,
  };
  return hare;
}

test("anatomy - a sure arm hits harder when it knows the body", () => {
  const weak = createWorld();
  weak.player.skills.anatomy = 0;
  const weakHare = hareBeside(weak, 80);
  withRoll(0, () => {
    tickPlayer(weak, 0.6);
  });
  const weakDmg = 80 - weakHare.hp;
  assert.ok(weakDmg > 0, "the swing must land");
  assert.equal(weakHare.task, "idle");

  const strong = createWorld();
  strong.player.skills.anatomy = 100;
  const strongHare = hareBeside(strong, 80);
  withRoll(0, () => {
    tickPlayer(strong, 0.6);
  });
  const strongDmg = 80 - strongHare.hp;
  assert.ok(strongDmg >= weakDmg + anatomyBonus(100), "anatomy adds at least its dice, more on a seam");
});
