import assert from "node:assert/strict";
import test from "node:test";
import { applyDig, applyFill, commandDig, digNow } from "./digging.ts";
import { commandPlantTree, plantTreeNow } from "./forestry.ts";
import { commandTill, tillNow, commandPlant, plantNow, harvestNow } from "./farm.ts";
import { commandTrack } from "./tracking.ts";
import { createPerson, createStubWorld, createWorld } from "./world.ts";
import { actorState, actorPerson } from "./actor.ts";
import { encodeSave, loadSave, CURRENT_SAVE_VERSION } from "./save.ts";

test("actor lookup preserves legacy default and rejects unknown or mismatched identities", () => {
  const { world, solo, npc, actor } = fixture();
  assert.equal(actorState(world), world.player);
  assert.equal(actorState(world, npc.id), actor);
  assert.equal(actorPerson(world), solo);
  assert.equal(actorPerson(world, npc.id), npc);
  for (const id of ["missing", "toString", "__proto__", ""]) {
    assert.throws(() => actorState(world, id), /Unknown actor/);
    assert.throws(() => applyDig(world, 101, 100, id), /Unknown actor/);
  }
  actor.id = "different";
  assert.throws(() => actorState(world, npc.id), /Unknown actor/);
  delete world.playerStates;
  assert.equal(actorState(world), world.player);
});

test("optional actor sheets round-trip without a save version migration and reject malformed sheets", () => {
  const world = createWorld(1);
  const actor = structuredClone(world.player);
  actor.id = "second-body";
  actor.wear.main = undefined;
  world.playerStates = { [actor.id]: actor };
  const payload = JSON.parse(encodeSave(world));
  assert.equal(payload.saveVersion, CURRENT_SAVE_VERSION);
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let raw = JSON.stringify(payload);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => raw } });
  try {
    assert.deepEqual(loadSave()?.playerStates, JSON.parse(JSON.stringify(world.playerStates)));
    delete payload.playerStates;
    raw = JSON.stringify(payload);
    assert.deepEqual(loadSave()?.playerStates, {});
    for (const invalid of [null, [], { second: {} }, { wrong: actor }]) {
      raw = JSON.stringify({ ...payload, playerStates: invalid });
      assert.ok(loadSave() === null, "malformed actor map must reject before hydration");
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});

function fixture() {
  const world = createStubWorld();
  const solo = createPerson(world, () => 0.5, { x: 10, z: 10, isPlayer: true });
  const npc = createPerson(world, () => 0.5, { x: 100, z: 100 });
  world.people.push(solo, npc);
  world.player.id = solo.id;
  const actor = structuredClone(world.player);
  actor.id = npc.id;
  actor.wear.main = "pick";
  actor.skills.mining = 20;
  world.playerStates = { [npc.id]: actor };
  world.hour = 100;
  return { world, solo, npc, actor };
}

test("actor dig/fill uses actor equipment and trains only its state", () => {
  const { world, npc, actor } = fixture();
  const before = structuredClone(world.player);
  assert.match(applyDig(world, 101, 100, npc.id), /hole/);
  assert.equal(world.tiles[100]![101]!.kind, "pit");
  assert.equal(actor.skills.mining, 20.1);
  assert.deepEqual(world.player, before);
  assert.match(applyFill(world, 101, 100, npc.id), /dirt/);
  assert.equal(world.tiles[100]![101]!.kind, "grass");
});

test("actor dig command and beat select its body and intent", () => {
  const { world, solo, npc, actor } = fixture();
  const before = structuredClone(world.player);
  assert.equal(commandDig(world, 101, 100, npc.id), null);
  assert.equal(actor.intent.kind, "dig");
  assert.ok(npc.path.length);
  assert.deepEqual(solo.path, []);
  assert.match(digNow(world, npc.id), /hole/);
  assert.equal(actor.intent.kind, "none");
  assert.deepEqual(world.player, before);
});

test("actor unearth credits its pack without touching the solo pack", () => {
  const { world, npc, actor } = fixture();
  world.holes = { "101,100": { kind: "grass", h: 1, open: false, buried: { items: { cabbage: 3 }, gold: 0 } } };
  const before = structuredClone(world.player);
  const count = actor.pack.cabbage;
  assert.match(applyDig(world, 101, 100, npc.id), /cabbage/);
  assert.equal(actor.pack.cabbage, count + 3);
  assert.deepEqual(world.player, before);
});

test("actor forestry spends and trains only its own sheet", () => {
  const { world, npc, actor } = fixture();
  actor.pack.acorn = 1;
  actor.skills.forestry = 20;
  const before = structuredClone(world.player);
  assert.equal(commandPlantTree(world, 101, 100, npc.id), null);
  assert.match(plantTreeNow(world, npc.id), /takes/);
  assert.equal(actor.pack.acorn, 0);
  assert.equal(world.saplings.length, 1);
  assert.equal(actor.skills.forestry, 20.1);
  assert.deepEqual(world.player, before);
});

test("actor farming routes till/sow/harvest intents and inventory", () => {
  const { world, npc, actor } = fixture();
  actor.wear.main = "hoe";
  actor.pack.cabbage_seed = 1;
  actor.skills.farming = 100;
  const before = structuredClone(world.player);
  assert.equal(commandTill(world, 101, 100, npc.id), null);
  assert.match(tillNow(world, npc.id), /bed/);
  assert.equal(commandPlant(world, 101, 100, "cabbage", npc.id), null);
  assert.match(plantNow(world, npc.id), /takes/);
  assert.equal(actor.pack.cabbage_seed, 0);
  const bed = world.plots[0]!;
  bed.stage = 3;
  actor.intent = { kind: "harvest", tx: 101, ty: 100, targetId: bed.id, spell: null };
  const original = Math.random;
  const count = actor.pack.cabbage;
  try {
    Math.random = () => 0.5;
    assert.match(harvestNow(world, npc.id), /cabbage/);
  } finally { Math.random = original; }
  assert.equal(actor.pack.cabbage, count + 1);
  assert.deepEqual(world.player, before);
});

test("actor tracking finds the solo body instead of tracking itself", () => {
  const { world, solo, npc, actor } = fixture();
  solo.x = 102; solo.z = 100;
  actor.skills.tracking = 50;
  const before = structuredClone(world.player);
  assert.match(commandTrack(world, npc.id), /east, 2 paces/);
  assert.equal(npc.facing, Math.PI / 2);
  assert.deepEqual(world.player, before);
});
