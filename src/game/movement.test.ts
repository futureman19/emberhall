import assert from "node:assert/strict";
import test from "node:test";
import { ARROW_RANGE } from "./magery.ts";
import { lineWalkable } from "./pathfinding.ts";
import { commandHunt, commandWalk, tickPlayer } from "./player.ts";
import { tickWorld } from "./sim.ts";
import type { Creature } from "./types.ts";
import { createPerson, createStubWorld } from "./world.ts";

function playerWorld() {
  const world = createStubWorld();
  const player = createPerson(world, () => 0.5, {
    x: 10,
    z: 10,
    isPlayer: true,
    member: true,
  });
  world.people.push(player);
  world.player.id = player.id;
  return { world, player };
}

function creature(x: number, z: number): Creature {
  return {
    id: "moving-wolf",
    kind: "wolf",
    x,
    z,
    hp: 28,
    maxHp: 28,
    path: [],
    task: "wander",
    taskUntil: 0,
    corpseUntil: 0,
    home: { tx: Math.round(x), ty: Math.round(z) },
    ownerId: null,
    loyalty: 0,
    stay: false,
  };
}

test("a newly blocked smoothed route is replanned instead of walking through it", () => {
  const { world, player } = playerWorld();
  assert.equal(commandWalk(world, 14, 10), null);
  assert.deepEqual(player.path, [{ tx: 14, ty: 10 }]);
  tickWorld(world, 0.1);
  const beforeBlock = player.x;

  world.tiles[10]![12]!.kind = "wall";
  world.landRev += 1;
  tickWorld(world, 0.1);

  assert.equal(world.player.intent.kind, "walk");
  assert.ok(player.path.length > 1);
  assert.deepEqual(player.path.at(-1), { tx: 14, ty: 10 });
  assert.equal(player.x, beforeBlock);
  assert.equal(player.z, 10);
});

test("waypoint handoff consumes the remaining frame distance without pausing", () => {
  const { world, player } = playerWorld();
  world.player.intent = { kind: "walk", tx: 11, ty: 10, targetId: null, spell: null };
  player.x = 10.9;
  player.path = [
    { tx: 11, ty: 10 },
    { tx: 12, ty: 10 },
  ];

  tickWorld(world, 0.1);

  assert.ok(Math.abs(player.x - 11.16) < 1e-9);
  assert.equal(player.z, 10);
  assert.deepEqual(player.path, [{ tx: 12, ty: 10 }]);
});

test("a valid smoothed segment does not pause when fractional tile rounding changes its raster", () => {
  const { world, player } = playerWorld();
  // The original legal segment approaches around the west side of this wall.
  // Mid-segment rounding places the player in (11,10); rerasterizing the whole
  // remaining diagonal from that tile would incorrectly require (12,10) as a
  // clear corner shoulder and trigger a one-frame replan pause.
  world.tiles[10]![12]!.kind = "wall";
  player.x = 10.5408;
  player.z = 10.3606;
  player.path = [{ tx: 13, ty: 12 }];
  world.player.intent = { kind: "walk", tx: 13, ty: 12, targetId: null, spell: null };
  const before = { x: player.x, z: player.z };

  tickWorld(world, 0.1);

  assert.ok(Math.abs(Math.hypot(player.x - before.x, player.z - before.z) - 0.26) < 1e-9);
  assert.deepEqual(player.path, [{ tx: 13, ty: 12 }]);
});

test("a planned corner-safe line cannot get stuck when fractional movement rounds diagonally", () => {
  const { world, player } = playerWorld();
  world.tiles[12]![11]!.kind = "wall";
  assert.equal(lineWalkable(world, 10, 10, 12, 21), true);
  player.x = 10.4544;
  player.z = 12.499;
  player.path = [{ tx: 12, ty: 21 }];
  world.player.intent = { kind: "walk", tx: 12, ty: 21, targetId: null, spell: null };
  const before = { x: player.x, z: player.z };

  tickWorld(world, 0.1);

  assert.ok(Math.abs(Math.hypot(player.x - before.x, player.z - before.z) - 0.26) < 1e-9);
  assert.deepEqual(player.path, [{ tx: 12, ty: 21 }]);
});

test("a fractional click redirect keeps the clear continuous line instead of detouring via rounded footing", () => {
  const { world, player } = playerWorld();
  world.tiles[10]![12]!.kind = "wall";
  player.x = 10.5408;
  player.z = 10.3606;
  assert.equal(commandWalk(world, 13, 12), null);
  assert.deepEqual(player.path, [{ tx: 13, ty: 12 }]);
  const before = { x: player.x, z: player.z };
  tickWorld(world, 0.1);
  assert.ok(Math.abs(Math.hypot(player.x - before.x, player.z - before.z) - 0.26) < 1e-9);
  assert.deepEqual(player.path, [{ tx: 13, ty: 12 }]);
});

test("a click in the current rounded tile still reaches its center", () => {
  const { world, player } = playerWorld();
  player.x = 10.3;
  assert.equal(commandWalk(world, 10, 10), null);
  tickWorld(world, 0.1);
  assert.ok(player.x < 10.3);
  tickWorld(world, 0.1);
  assert.equal(player.x, 10);
});

test("open-ground clicks and mid-walk redirects take one straight leg in every octant", () => {
  for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6], [6, 3], [-6, 3], [3, -6], [-3, -6]]) {
    const { world, player } = playerWorld();
    assert.equal(commandWalk(world, 14, 12), null);
    tickWorld(world, 0.1);
    const before = { x: player.x, z: player.z };
    const target = { tx: 10 + dx!, ty: 10 + dz! };
    assert.equal(commandWalk(world, target.tx, target.ty), null);
    assert.deepEqual(player.path, [target]);
    tickWorld(world, 0.1);
    const distance = Math.hypot(target.tx - before.x, target.ty - before.z);
    assert.ok(Math.abs(player.x - before.x - 0.26 * (target.tx - before.x) / distance) < 1e-9);
    assert.ok(Math.abs(player.z - before.z - 0.26 * (target.ty - before.z) / distance) < 1e-9);
  }
});

test("fractional obstacle routes retain safe footing and arrive without cutting walls or cliffs", () => {
  for (const block of ["wall", "cliff"] as const) {
    const { world, player } = playerWorld();
    player.x = 10.4;
    player.z = 10.4;
    if (block === "wall") world.tiles[11]![11]!.kind = "wall";
    else world.tiles[11]![11]!.h = 8;
    assert.equal(commandWalk(world, 14, 14), null);
    assert.ok(player.path.length > 1);
    let from = { x: player.x, y: player.z };
    for (const n of player.path) {
      assert.ok(lineWalkable(world, from.x, from.y, n.tx, n.ty));
      from = { x: n.tx, y: n.ty };
    }
    for (let i = 0; i < 100 && player.path.length; i++) tickWorld(world, 0.1);
    assert.equal(player.x, 14);
    assert.equal(player.z, 14);
  }
});

test("an unrelated terrain revision does not invent a detour from rounded mid-walk footing", () => {
  const { world, player } = playerWorld();
  world.tiles[10]![12]!.kind = "wall";
  assert.equal(commandWalk(world, 13, 12), null);
  for (let i = 0; i < 3; i++) tickWorld(world, 0.1);
  const before = { x: player.x, z: player.z };
  world.landRev += 1;
  tickWorld(world, 0.1);
  assert.ok(Math.abs(Math.hypot(player.x - before.x, player.z - before.z) - 0.26) < 1e-9);
  assert.deepEqual(player.path, [{ tx: 13, ty: 12 }]);
});

test("after rounding an obstacle the walk goes straight to the click instead of a leftover corner", () => {
  const { world, player } = playerWorld();
  world.tiles[10]![12]!.kind = "wall";
  assert.equal(commandWalk(world, 14, 10), null);
  assert.ok(player.path.length > 1);
  player.x = 13;
  player.z = 11;
  player.path = [
    { tx: 12, ty: 11 },
    { tx: 13, ty: 11 },
    { tx: 14, ty: 10 },
  ];
  tickWorld(world, 0.1);
  assert.deepEqual(player.path, [{ tx: 14, ty: 10 }]);
  const before = { x: player.x, z: player.z };
  tickWorld(world, 0.1);
  const toDest = Math.hypot(14 - before.x, 10 - before.z);
  assert.ok(Math.abs(player.x - before.x - (0.26 * (14 - before.x)) / toDest) < 1e-9);
  assert.ok(Math.abs(player.z - before.z - (0.26 * (10 - before.z)) / toDest) < 1e-9);
});

test("hunting replans toward a moving target without striking out of range", () => {
  const { world, player } = playerWorld();
  const wolf = creature(20, 10);
  world.fauna.push(wolf);
  assert.equal(commandHunt(world, wolf.id), null);
  const firstEndpoint = player.path.at(-1);
  assert.ok(firstEndpoint);
  assert.ok(Math.hypot(firstEndpoint.tx - wolf.x, firstEndpoint.ty - wolf.z) <= 1.5);

  wolf.x = 20;
  wolf.z = 14;
  world.tickCount = 6;
  const hp = wolf.hp;
  tickPlayer(world, 0.1);

  assert.equal(wolf.hp, hp);
  assert.deepEqual({ tx: world.player.intent.tx, ty: world.player.intent.ty }, { tx: 20, ty: 14 });
  const movedEndpoint = player.path.at(-1);
  assert.ok(movedEndpoint);
  assert.ok(Math.hypot(movedEndpoint.tx - wolf.x, movedEndpoint.ty - wolf.z) <= 1.5);
});

test("a ranged spell follows a moving target and cannot cast from stale range", () => {
  const { world, player } = playerWorld();
  const wolf = creature(26, 10);
  world.fauna.push(wolf);
  world.player.intent = { kind: "cast", tx: 26, ty: 10, targetId: wolf.id, spell: "magicarrow" };
  player.path = [{ tx: 26, ty: 10 }];

  wolf.x = 26;
  wolf.z = 18;
  world.tickCount = 6;
  const hp = wolf.hp;
  tickPlayer(world, 0.1);

  assert.equal(wolf.hp, hp);
  assert.deepEqual({ tx: world.player.intent.tx, ty: world.player.intent.ty }, { tx: 26, ty: 18 });
  const endpoint = player.path.at(-1);
  assert.ok(endpoint);
  assert.ok(Math.hypot(endpoint.tx - wolf.x, endpoint.ty - wolf.z) <= ARROW_RANGE - 0.75);
});
