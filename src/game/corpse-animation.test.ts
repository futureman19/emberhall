import assert from "node:assert/strict";
import test from "node:test";
import { addToPile, takeFromPile, takeGoldFromPile } from "./piles.ts";
import { clearCorpseFx, CORPSE_DURATION, corpsePose, getCorpseFx } from "./corpse-animation.ts";
import { commandLoot, commandSkin, tickPlayer, you } from "./player.ts";
import { createWorld } from "./world.ts";
import type { Creature } from "./types.ts";

function deadHare(x: number, z: number): Creature {
  return {
    id: "corpse-hare",
    kind: "hare",
    x,
    z,
    hp: 0,
    maxHp: 8,
    path: [],
    task: "dead",
    taskUntil: 0,
    corpseUntil: 0,
    home: { tx: Math.round(x), ty: Math.round(z) },
    ownerId: null,
    loyalty: 0,
    stay: false,
  };
}

test("corpse animation - skinning emits only after the result resolves", () => {
  clearCorpseFx();
  const world = createWorld();
  const player = you(world)!;
  const corpse = deadHare(player.x + 1, player.z);
  world.fauna.push(corpse);
  world.player.wear.main = "knife";

  assert.equal(commandSkin(world, corpse.id), null);
  assert.equal(getCorpseFx(), null, "walking to a corpse is not a completed result");
  const hide = world.player.pack.hide ?? 0;
  const meat = world.player.pack.meat ?? 0;
  tickPlayer(world, 0.8);
  assert.deepEqual(getCorpseFx(), {
    kind: "skinning",
    targetId: corpse.id,
    x: corpse.x,
    z: corpse.z,
    at: world.hour,
  });
  const pose = corpsePose("skinning", CORPSE_DURATION / 2);
  assert.ok(pose.crouch > 0.2);
  assert.ok(pose.reach > 0.7);
  assert.equal(world.fauna.some((entry) => entry.id === corpse.id), false);
  assert.equal(world.player.pack.hide, hide + 1);
  assert.equal(world.player.pack.meat, meat + 1);
});

test("corpse animation - looting emits at the pile without changing its transfer", () => {
  clearCorpseFx();
  const world = createWorld();
  const player = you(world)!;
  const pile = addToPile(world, Math.round(player.x + 1), Math.round(player.z), { rabbit_foot: 1 }, "corpse", world.hour + 8, "hare corpse", 3);
  const foot = world.player.pack.rabbit_foot ?? 0;
  const gold = world.gold;

  assert.equal(commandLoot(world, pile.id), null);
  assert.deepEqual(getCorpseFx(), {
    kind: "looting",
    targetId: pile.id,
    x: pile.tx,
    z: pile.ty,
    at: world.hour,
  });
  assert.equal(world.player.pack.rabbit_foot, foot + 1);
  assert.equal(world.gold, gold + 3);
  assert.equal(world.piles.some((entry) => entry.id === pile.id), false);
  const pose = corpsePose("looting", CORPSE_DURATION / 2);
  assert.ok(pose.crouch > 0.15);
  assert.ok(pose.reach > 0.8);
});

test("corpse animation - item and gold gump paths emit after positive corpse transfers", () => {
  clearCorpseFx();
  const world = createWorld();
  const player = you(world)!;
  const pile = addToPile(world, Math.round(player.x), Math.round(player.z), { rabbit_foot: 2 }, "corpse", world.hour + 8, "hare corpse", 3);
  const foot = world.player.pack.rabbit_foot ?? 0;

  assert.equal(takeFromPile(world, pile.id, "rabbit_foot"), null);
  assert.equal(world.player.pack.rabbit_foot, foot + 1);
  assert.equal(world.piles.includes(pile), true);
  assert.equal(getCorpseFx()?.kind, "looting");

  clearCorpseFx();
  const gold = world.gold;
  assert.equal(takeGoldFromPile(world, pile.id), 3);
  assert.equal(world.gold, gold + 3);
  assert.equal(world.piles.includes(pile), true, "the remaining item keeps the pile");
  assert.equal(getCorpseFx()?.kind, "looting");

  clearCorpseFx();
  const dropped = addToPile(world, Math.round(player.x), Math.round(player.z + 1), { cabbage: 1 }, "drop", world.hour + 8, "sack");
  assert.equal(takeFromPile(world, dropped.id), null);
  assert.equal(getCorpseFx(), null, "ordinary dropped sacks do not use corpse feedback");
});

test("corpse animation - rejected interactions emit nothing", () => {
  clearCorpseFx();
  const world = createWorld();
  world.player.wear.main = undefined;
  assert.equal(commandSkin(world, "missing"), "Nothing to dress.");
  assert.equal(commandLoot(world, "missing"), "Nothing to loot.");
  assert.equal(getCorpseFx(), null);
});
