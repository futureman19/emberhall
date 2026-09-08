import assert from "node:assert/strict";
import test from "node:test";
import { placeById } from "./atlas.ts";
import { FAUNA_META } from "./catalog.ts";
import {
  ensureStarterFauna,
  STARTER_FAUNA_KINDS,
  STARTER_FAUNA_RADIUS,
  STARTER_FAUNA_REFILL_HOURS,
  STARTER_FAUNA_TARGET,
  spawn,
  tickEcology,
} from "./ecology.ts";
import { commandHunt, tickPlayer, you } from "./player.ts";
import { createWorld } from "./world.ts";

function starterWildlife(world: ReturnType<typeof createWorld>) {
  const hall = placeById("emberhall");
  return world.fauna.filter((creature) =>
    creature.task !== "dead" &&
    !creature.ownerId &&
    STARTER_FAUNA_KINDS.has(creature.kind) &&
    Math.hypot(creature.x - hall.tx, creature.z - hall.ty) <= STARTER_FAUNA_RADIUS + 3
  );
}

test("Emberhall begins with a full ring of low-risk wildlife", () => {
  const world = createWorld();
  world.fauna = [];
  ensureStarterFauna(world);
  const local = starterWildlife(world);
  assert.equal(local.length, STARTER_FAUNA_TARGET);
  for (const kind of ["field_rat", "hare", "hart", "saltback_tortoise"] as const) {
    assert.ok(local.some((creature) => creature.kind === kind), `${kind} is guaranteed near the hall`);
  }
  for (const creature of local) {
    assert.ok(FAUNA_META[creature.kind].dmg <= 6, `${creature.kind} stays starter-safe`);
    assert.ok(FAUNA_META[creature.kind].tameDiff < 90, `${creature.kind} can be tamed`);
  }
});

test("starter wildlife stays peaceful at night", () => {
  const world = createWorld();
  world.fauna = [];
  ensureStarterFauna(world);
  const player = you(world)!;
  const local = starterWildlife(world);
  player.x = local[0]!.x;
  player.z = local[0]!.z + 1;
  world.hour = 22;
  tickEcology(world, 0.016);
  assert.ok(local.every((creature) => creature.task !== "fight"));
});

test("a new hunter can train on a field rat without taking damage", () => {
  const world = createWorld();
  const player = you(world)!;
  world.fauna = [spawn(world, "field_rat", player.x + 1, player.z)];
  world.player.wear.main = "sword";
  world.player.skills.swords = 8;
  const hpBefore = player.hp;
  const skillBefore = world.player.skills.swords;
  assert.equal(commandHunt(world, world.fauna[0]!.id), null);
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    for (let i = 0; i < 12 && world.fauna[0]!.task !== "dead"; i++) tickPlayer(world, 0.6);
  } finally {
    Math.random = random;
  }
  assert.equal(world.fauna[0]!.task, "dead");
  assert.equal(player.hp, hpBefore, "field rats never retaliate");
  assert.ok(world.player.skills.swords > skillBefore, "the safe kill still trains swords");
});

test("the starter ring replenishes to its cap every six game hours", () => {
  const world = createWorld();
  world.fauna = [];
  ensureStarterFauna(world);
  tickEcology(world, 0); // arms the refill clock
  const removed = new Set(starterWildlife(world).slice(0, 5).map((creature) => creature.id));
  world.fauna = world.fauna.filter((creature) => !removed.has(creature.id));
  assert.equal(starterWildlife(world).length, STARTER_FAUNA_TARGET - 5);
  world.hour += STARTER_FAUNA_REFILL_HOURS + 0.01;
  tickEcology(world, 0);
  assert.equal(starterWildlife(world).length, STARTER_FAUNA_TARGET);
});

test("starter replenishment is capped and idempotent", () => {
  const world = createWorld();
  world.fauna = [];
  ensureStarterFauna(world);
  ensureStarterFauna(world);
  assert.equal(starterWildlife(world).length, STARTER_FAUNA_TARGET);
});