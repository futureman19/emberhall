import assert from "node:assert/strict";
import test from "node:test";
import { createPerson, createStubWorld } from "./world.ts";
import { commandTravel, STATIONS } from "./gates.ts";
import { EMBERDEEP_ENTRY, EMBERDEEP_EXIT, enterEmberdeep, leaveEmberdeep, visitEmberdeep } from "./emberdeep.ts";
import { submitIntent } from "./agent/intent.ts";
import type { Intent } from "./types.ts";

function fixture() {
  const world = createStubWorld();
  const solo = createPerson(world, () => 0.5, { x: 10, z: 10, isPlayer: true });
  const body = createPerson(world, () => 0.5, { x: 100, z: 100 });
  world.people.push(solo, body);
  world.player.id = solo.id;
  const actor = structuredClone(world.player);
  actor.id = body.id;
  world.playerStates = { [body.id]: actor };
  world.hour = 100;
  for (const [id, ownerId, stay, task] of [
    ["solo-pet", solo.id, false, "follow"], ["actor-pet", body.id, false, "follow"],
    ["staying", body.id, true, "idle"], ["dead", body.id, false, "dead"],
  ] as const) world.fauna.push({ id, ownerId, stay, task, kind: "hart", x: 90, z: 90, hp: 20, maxHp: 20, path: [], taskUntil: 999, corpseUntil: 0, home: { tx: 90, ty: 90 }, loyalty: 40 });
  return { world, solo, body, actor };
}
const intent: Intent = { kind: "walk", tx: 100, ty: 101, targetId: null, spell: null };

for (const ghost of [false, true]) test(`selected actor gate travel preserves solo and other pets (ghost=${ghost})`, () => {
  const { world, solo, body, actor } = fixture();
  actor.ghost = ghost; body.ghost = ghost;
  actor.intent = { ...intent };
  body.path = [{ tx: 101, ty: 100 }];
  const before = structuredClone({ player: world.player, solo, pets: world.fauna.filter(p => p.id !== "actor-pet") });
  const playerRef = world.player;
  assert.equal(commandTravel(world, STATIONS[0]!.id, body.id), null);
  assert.notEqual(body.x, 100);
  assert.equal(actor.intent.kind, "none");
  assert.equal(actor.gateCoolUntil, world.hour + 0.05);
  assert.equal(body.path.length, 0);
  assert.ok(Math.hypot(world.fauna[1]!.x - body.x, world.fauna[1]!.z - body.z) < 2);
  assert.equal(world.player, playerRef);
  assert.deepEqual({ player: world.player, solo, pets: world.fauna.filter(p => p.id !== "actor-pet") }, before);
});

for (const ghost of [false, true]) test(`selected actor stair roundtrip preserves solo (ghost=${ghost})`, () => {
  const { world, solo, body, actor } = fixture();
  actor.ghost = ghost; body.ghost = ghost;
  body.x = EMBERDEEP_ENTRY.tx; body.z = EMBERDEEP_ENTRY.ty;
  actor.intent = { ...intent }; actor.workT = 3;
  const before = structuredClone({ player: world.player, solo, pets: world.fauna.filter(p => p.id !== "actor-pet") });
  assert.equal(enterEmberdeep(world, body.id), null);
  assert.equal(body.x, EMBERDEEP_EXIT.tx);
  assert.equal(actor.intent.kind, "none");
  assert.equal(actor.workT, 0);
  assert.ok(world.emberdeep?.visited.includes("entrance"));
  assert.equal(world.fauna[1]!.x, body.x);
  assert.equal(leaveEmberdeep(world, body.id), null);
  assert.equal(body.x, EMBERDEEP_ENTRY.tx);
  assert.deepEqual({ player: world.player, solo, pets: world.fauna.filter(p => p.id !== "actor-pet") }, before);
});

test("intent submission copies only the selected actor intent and rejects invalid input unchanged", () => {
  const { world, actor, body } = fixture();
  const before = structuredClone(world.player);
  assert.equal(submitIntent(world, intent, body.id), null);
  assert.deepEqual(actor.intent, intent);
  assert.notEqual(actor.intent, intent);
  assert.deepEqual(world.player, before);
  const accepted = structuredClone(actor);
  assert.ok(submitIntent(world, { ...intent, tx: -1 }, body.id));
  assert.deepEqual(actor, accepted);
});

test("explicit unknown actors fail closed for travel, visit and submission", () => {
  const { world } = fixture();
  const before = JSON.stringify(world);
  for (const run of [
    () => commandTravel(world, STATIONS[0]!.id, "missing"),
    () => enterEmberdeep(world, "missing"), () => leaveEmberdeep(world, "missing"),
    () => visitEmberdeep(world, "missing"), () => submitIntent(world, intent, "missing"),
  ]) {
    assert.throws(run, /Unknown actor/);
    assert.equal(JSON.stringify(world), before);
  }
});

test("omitted actor retains solo intent submission and travel", () => {
  const { world, solo, actor } = fixture();
  const before = structuredClone(actor);
  assert.equal(submitIntent(world, intent), null);
  assert.deepEqual(world.player.intent, intent);
  assert.equal(commandTravel(world, STATIONS[0]!.id), null);
  assert.notEqual(solo.x, 10);
  solo.x = EMBERDEEP_ENTRY.tx; solo.z = EMBERDEEP_ENTRY.ty;
  assert.equal(enterEmberdeep(world), null);
  assert.equal(leaveEmberdeep(world), null);
  assert.deepEqual(actor, before);
});
