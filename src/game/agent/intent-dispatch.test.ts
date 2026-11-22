import assert from "node:assert/strict";
import test from "node:test";
import { commandWalk } from "../player.ts";
import { followPath, tickWorld } from "../sim.ts";
import type { Intent } from "../types.ts";
import { createPerson, createStubWorld } from "../world.ts";
import { submitIntent } from "./intent.ts";

function fixture() {
  const world = createStubWorld();
  const solo = createPerson(world, () => 0.5, { x: 10, z: 10, isPlayer: true });
  const remote = createPerson(world, () => 0.5, { x: 10, z: 12 });
  world.people = [solo, remote];
  world.player.id = solo.id;
  const actor = { ...structuredClone(world.player), id: remote.id };
  world.playerStates = { [remote.id]: actor };
  return { world, solo, remote, actor };
}

const walk: Intent = { kind: "walk", tx: 14, ty: 12, targetId: null, spell: null };

// Clone both sides: structuredClone normalizes null-prototype inventory maps.
function snapshot(world: ReturnType<typeof fixture>["world"]) {
  return structuredClone(world);
}

test("submitted remote walk plans a route and the real world tick moves that body", () => {
  const { world, solo, remote, actor } = fixture();
  const untouched = structuredClone([solo, world.player]);
  actor.armedSpell = "fireball";
  assert.equal(submitIntent(world, walk, remote.id), null);
  assert.deepEqual(remote.path.at(-1), { tx: 14, ty: 12 });
  assert.equal(actor.armedSpell, null);
  assert.deepEqual(structuredClone([solo, world.player]), untouched);
  assert.equal(remote.x, 10, "submission plans, not teleports");
  tickWorld(world, 0.1);
  assert.ok(remote.x > 10 && remote.x < 14);
  assert.equal(remote.z, 12);
  assert.equal(solo.x, 10);
  assert.equal(solo.z, 10);
});

test("omitted actor keeps solo walk planning and movement", () => {
  const { world, solo, remote, actor } = fixture();
  const untouched = structuredClone([remote, actor]);
  assert.equal(submitIntent(world, { ...walk, ty: 10 }), null);
  assert.equal(followPath(world, solo, 2), "moving");
  assert.equal(solo.x, 14);
  assert.deepEqual(structuredClone([remote, actor]), untouched);
});

test("walk reuses commandWalk destination snapping and actor flight policy", () => {
  const { world, remote, actor } = fixture();
  world.tiles[12]![14]!.kind = "wall";
  actor.flyUntil = world.hour + 1;
  const expected = structuredClone(world);
  assert.equal(commandWalk(expected, walk.tx, walk.ty, 9000, remote.id), null);
  assert.equal(submitIntent(world, walk, remote.id), null);
  assert.deepEqual(remote.path, expected.people[1]!.path);
  assert.deepEqual(actor.intent, expected.playerStates![remote.id]!.intent);
  assert.notDeepEqual(actor.intent, walk, "blocked destination uses canonical snapping");
});

test("malformed submissions reject without changing any world state", () => {
  const { world, remote, actor } = fixture();
  remote.path = [{ tx: 11, ty: 12 }];
  actor.armedSpell = "fireball";
  const before = snapshot(world);
  for (const invalid of [
    { ...walk, kind: "dance" },
    { ...walk, tx: -1 },
    { ...walk, tx: 1.5 },
    { ...walk, targetId: 7 },
    { ...walk, spell: 7 },
    null,
  ]) {
    assert.equal(typeof submitIntent(world, invalid as unknown as Intent, remote.id), "string");
    assert.deepEqual(snapshot(world), before);
  }
});

test("unreachable walk preserves the previous intent, route and armed spell", () => {
  const { world, remote, actor } = fixture();
  for (let y = 11; y <= 13; y++) {
    for (let x = 9; x <= 11; x++) {
      if (x !== 10 || y !== 12) world.tiles[y]![x]!.kind = "wall";
    }
  }
  remote.path = [{ tx: 10, ty: 10 }];
  actor.armedSpell = "fireball";
  const before = snapshot(world);
  const previousPath = remote.path;
  const previousIntent = actor.intent;
  assert.equal(submitIntent(world, walk, remote.id), "The way is closed.");
  assert.deepEqual(snapshot(world), before);
  assert.equal(remote.path, previousPath);
  assert.equal(actor.intent, previousIntent);
});

test("walk with no nearby footing rejects without mutation", () => {
  const { world, remote, actor } = fixture();
  for (let y = 24; y <= 36; y++) {
    for (let x = 24; x <= 36; x++) world.tiles[y]![x]!.kind = "wall";
  }
  actor.armedSpell = "fireball";
  const before = snapshot(world);
  assert.equal(submitIntent(world, { ...walk, tx: 30, ty: 30 }, remote.id), "No footing.");
  assert.deepEqual(snapshot(world), before);
});

test("explicit unknown actors throw without falling back to the solo sheet", () => {
  const { world, solo } = fixture();
  const before = snapshot(world);
  for (const id of ["missing", "__proto__", solo.id]) {
    assert.throws(() => submitIntent(world, walk, id), /Unknown actor/);
    assert.deepEqual(snapshot(world), before);
  }
});

test("registered actor with no body cannot move the solo body", () => {
  const { world, remote } = fixture();
  world.people = world.people.filter((p) => p.id !== remote.id);
  const before = snapshot(world);
  assert.equal(submitIntent(world, walk, remote.id), "You are not in the vale.");
  assert.deepEqual(snapshot(world), before);
});

test("none cancels only the addressed body's pending movement", () => {
  const { world, solo, remote, actor } = fixture();
  solo.path = [{ tx: 14, ty: 10 }];
  remote.path = [{ tx: 14, ty: 12 }];
  actor.intent = { ...walk };
  const untouched = structuredClone([solo, world.player]);
  assert.equal(submitIntent(world, { ...walk, kind: "none" }, remote.id), null);
  assert.deepEqual(remote.path, []);
  assert.equal(actor.intent.kind, "none");
  assert.equal(followPath(world, remote, 0.1, remote.id), "idle");
  assert.equal(remote.x, 10);
  assert.deepEqual(structuredClone([solo, world.player]), untouched);
});

test("nonmovement verbs preserve the existing intent-only dispatch contract", () => {
  const { world, remote, actor } = fixture();
  remote.path = [{ tx: 11, ty: 12 }];
  actor.armedSpell = "fireball";
  const path = remote.path;
  const intent: Intent = { ...walk, kind: "chop" };
  assert.equal(submitIntent(world, intent, remote.id), null);
  assert.deepEqual(actor.intent, intent);
  assert.notEqual(actor.intent, intent);
  assert.equal(remote.path, path);
  assert.equal(actor.armedSpell, "fireball");
});
