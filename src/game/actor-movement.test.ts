import assert from "node:assert/strict";
import test from "node:test";
import * as sim from "./sim.ts";
import { FLY_SPEED } from "./catalog.ts";
import { astar, lineWalkable } from "./pathfinding.ts";
import { EMBERDEEP_GATE } from "./emberdeep.ts";
import { createPerson, createStubWorld } from "./world.ts";

function fixture() {
  const world = createStubWorld();
  const a = createPerson(world, () => 0.5, { x: 100, z: 100, isPlayer: true });
  // An explicit actor need not carry the legacy local-player marker.
  const b = createPerson(world, () => 0.5, { x: 100, z: 102 });
  const npc = createPerson(world, () => 0.5, { x: 100, z: 104 });
  world.player.id = a.id;
  world.player.flyUntil = 0;
  world.playerStates = {
    [a.id]: { ...structuredClone(world.player), id: a.id },
    [b.id]: { ...structuredClone(world.player), id: b.id, flyUntil: world.hour + 1 },
  };
  world.people = [a, b, npc];
  for (const p of world.people) p.path = [{ tx: 110, ty: p.z }];
  return { world, a, b, npc };
}

test("movement exports an explicit actor follower", () => {
  assert.equal(typeof sim.followPath, "function");
});

test("explicit actors use only their own flight and body", () => {
  const { world, a, b, npc } = fixture();
  const solo = structuredClone(world.player);
  const idleBodies = structuredClone([a, npc]);
  const states = structuredClone(world.playerStates);
  assert.equal(sim.followPath(world, b, 0.1, b.id), "moving");
  assert.ok(Math.abs(b.x - (100 + 2.6 * 0.1 * FLY_SPEED)) < 1e-9);
  assert.deepEqual([a, npc], idleBodies);
  assert.deepEqual(world.player, solo);
  assert.deepEqual(world.playerStates, states);
  world.player.flyUntil = world.hour + 1;
  sim.followPath(world, a, 0.1, a.id);
  assert.ok(Math.abs(a.x - 100.26) < 1e-9, "map state overrides the legacy singleton");
});

test("omitted actor preserves solo flight and ordinary NPC movement", () => {
  const { world, a, npc } = fixture();
  world.player.flyUntil = world.hour + 1;
  sim.followPath(world, a, 0.1);
  sim.followPath(world, npc, 0.1);
  assert.ok(Math.abs(a.x - (100 + 2.6 * 0.1 * FLY_SPEED)) < 1e-9);
  assert.ok(Math.abs(npc.x - 100.26) < 1e-9);
});

test("unknown and mismatched explicit actors fail before movement or path mutation", () => {
  const { world, a, b } = fixture();
  const before = structuredClone([a, b]);
  assert.throws(() => sim.followPath(world, b, 0.1, "missing"), /unknown actor/i);
  assert.throws(() => sim.followPath(world, a, 0.1, b.id), /actor/i);
  assert.deepEqual([a, b], before);
  b.path = [];
  assert.throws(() => sim.followPath(world, b, 0.1, "missing"), /unknown actor/i);
});

test("terrain invalidation and motion watches remain body-local", () => {
  const { world, a, b } = fixture();
  sim.followPath(world, a, 0.1, a.id);
  sim.followPath(world, b, 0.1, b.id);
  const other = structuredClone(b);
  world.tiles[100]![105]!.kind = "wall";
  world.landRev += 1;
  assert.equal(sim.followPath(world, a, 0.1, a.id), "stuck");
  assert.deepEqual(a.path, []);
  assert.deepEqual(b, other);
  assert.equal(sim.followPath(world, b, 0.1, b.id), "moving");
  assert.ok(b.x > other.x);
});

test("actor following retains ghost speed and continuous waypoint handoffs", () => {
  const { world, a } = fixture();
  a.ghost = true;
  a.path = [{ tx: 101, ty: 100 }, { tx: 102, ty: 100 }];
  assert.equal(sim.followPath(world, a, 0.1, a.id), "moving");
  assert.ok(Math.abs(a.x - (100 + 2.6 * 1.4 * 0.1)) < 1e-9);
  assert.equal(sim.followPath(world, a, 1, a.id), "moving");
  assert.equal(a.x, 102);
  assert.deepEqual(a.path, []);
  assert.equal(sim.followPath(world, a, 0.1, a.id), "idle");
});

test("pathfinding uses shared dungeon collision, not local player state", () => {
  const { world } = fixture();
  const { tx, y0: ty } = EMBERDEEP_GATE;
  world.emberdeep = { version: 1, visited: [], cleared: [], bossDoorOpen: false };
  assert.equal(lineWalkable(world, tx - 1, ty, tx + 1, ty), false);
  world.player.flyUntil = world.hour + 1;
  assert.equal(lineWalkable(world, tx - 1, ty, tx + 1, ty), false);
  world.emberdeep.bossDoorOpen = true;
  assert.equal(lineWalkable(world, tx - 1, ty, tx + 1, ty), true);
  assert.ok(astar(world, tx - 1, ty, tx + 1, ty));
});
