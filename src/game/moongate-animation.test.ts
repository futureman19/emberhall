import assert from "node:assert/strict";
import test from "node:test";
import { STATIONS, commandTravel } from "./gates.ts";
import { getMoongateFx, MOONGATE_DURATION, moongatePhase } from "./moongate-animation.ts";
import { you } from "./player.ts";
import { createWorld } from "./world.ts";
import type { Creature, World } from "./types.ts";

function pet(world: World, id: string, over: Partial<Creature> = {}) {
  const player = you(world)!;
  const creature: Creature = {
    id,
    kind: "wolf",
    x: player.x + 1,
    z: player.z,
    hp: 28,
    maxHp: 28,
    path: [{ tx: 1, ty: 1 }],
    task: "follow",
    taskUntil: 0,
    corpseUntil: 0,
    home: { tx: Math.round(player.x), ty: Math.round(player.z) },
    ownerId: world.player.id,
    loyalty: 40,
    stay: false,
    name: id,
    warnedLoyal: false,
    ...over,
  };
  world.fauna.push(creature);
  return creature;
}

function withRoll<T>(roll: number, action: () => T): T {
  const random = Math.random;
  Math.random = () => roll;
  try { return action(); } finally { Math.random = random; }
}

test("moongate animation - phase clamps departure, transit, arrival, and settle", () => {
  assert.deepEqual(moongatePhase(0), { progress: 0, departure: 1, transit: 0, arrival: 0, settle: 0 });
  const middle = moongatePhase(MOONGATE_DURATION / 2);
  assert.equal(middle.progress, 0.5);
  assert.ok(middle.transit > 0.99);
  assert.ok(middle.arrival > 0.8);
  assert.ok(middle.settle > 0);
  const done = moongatePhase(MOONGATE_DURATION * 2);
  assert.equal(done.progress, 1);
  assert.equal(done.departure, 0);
  assert.equal(done.transit, 0);
  assert.equal(done.settle, 1);
});

test("moongate animation - travel records both gates and following companion arrivals", () => {
  const world = createWorld();
  const player = you(world)!;
  const source = STATIONS.find((station) => station.id === "emberhall")!;
  const destination = STATIONS.find((station) => station.id === "millcross")!;
  player.x = source.tx;
  player.z = source.ty;
  player.path = [{ tx: 1, ty: 1 }];
  world.player.intent.kind = "gate";
  const following = pet(world, "following");
  const staying = pet(world, "staying", { stay: true });
  const dead = pet(world, "dead", { task: "dead" });
  const stayedAt = { x: staying.x, z: staying.z };
  const deadAt = { x: dead.x, z: dead.z };

  assert.equal(withRoll(0.5, () => commandTravel(world, destination.id)), null);
  assert.equal(player.path.length, 0);
  assert.equal(world.player.intent.kind, "none");
  assert.equal(world.player.gateCoolUntil, world.hour + 0.05);
  assert.equal(following.x, player.x);
  assert.equal(following.z, player.z);
  assert.deepEqual({ x: staying.x, z: staying.z }, stayedAt);
  assert.deepEqual({ x: dead.x, z: dead.z }, deadAt);
  assert.deepEqual(getMoongateFx(world), {
    sourceId: source.id,
    destinationId: destination.id,
    destinationName: destination.name,
    x: source.tx,
    z: source.ty,
    tx: player.x,
    tz: player.z,
    companions: [{ id: following.id, x: following.x, z: following.z }],
    at: world.hour,
  });
});

test("moongate animation - rejected destinations emit nothing", () => {
  const world = createWorld();
  assert.equal(commandTravel(world, "missing-ring"), "No such ring.");
  assert.equal(getMoongateFx(world), null);
  assert.equal(getMoongateFx(createWorld()), null);
});
