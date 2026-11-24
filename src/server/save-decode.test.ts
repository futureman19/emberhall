import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import * as save from "../game/save.ts";
import { createWorld } from "../game/world.ts";
import { depleteResourceNode } from "../game/resources/state.ts";
import { LOOK_SCHEMA } from "../game/look/types.ts";
import type { World } from "../game/types.ts";

const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let stored: string | null;
beforeEach(() => {
  stored = null;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem(key: string) { assert.equal(key, save.SAVE_KEY); return stored; },
    setItem() { assert.fail("decoding/loading must not write storage"); },
  } });
});
afterEach(() => {
  if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
  else delete (globalThis as { localStorage?: Storage }).localStorage;
});

// Namespace lookup makes a missing public API an explicit assertion during RED.
function decode(raw: string): World | null {
  assert.ok("decodeSave" in save, "save must export decodeSave");
  return (save.decodeSave as (raw: string) => World | null)(raw);
}

const fixture = (() => {
  const world = createWorld();
  const person = structuredClone(world.people.find((p) => p.id === world.player.id)!);
  person.id = "second-body";
  person.isPlayer = false;
  person.look = { schema: LOOK_SCHEMA, cls: "ranger", skin: "#96795d", hairStyle: "crop", hairColor: "#4a2b20", garb: "#526b54", parts: [] };
  world.people.push(person);
  const second = structuredClone(world.player);
  second.id = person.id;
  second.mana = 17;
  second.pack.log = 9;
  second.vault = 123;
  world.playerStates = { [world.player.id]: world.player, [second.id]: second };
  return save.encodeSave(world);
})();

function parity(raw: string) {
  stored = raw;
  const decoded = decode(raw);
  const loaded = save.loadSave();
  assert.deepEqual(decoded, loaded);
  assert.equal(stored, raw, "loading leaves original bytes untouched");
  return decoded;
}

test("decodeSave preserves v6 people, independent sheets and player alias exactly like loadSave", () => {
  const world = parity(fixture);
  assert.ok(world);
  const payload = JSON.parse(fixture);
  assert.deepEqual(world.people, payload.people);
  assert.deepEqual(world.playerStates, payload.playerStates);
  assert.equal(world.playerStates![world.player.id], world.player);
  assert.notEqual(world.playerStates!["second-body"], world.player);
  assert.equal(world.restored, true);
  assert.equal(Object.hasOwn(world, "saveVersion"), false);
});

test("decodeSave retains sheets without bodies and optional absent v6 map semantics", () => {
  const payload = JSON.parse(fixture);
  payload.people = payload.people.filter((p: { id: string }) => p.id !== "second-body");
  assert.ok(parity(JSON.stringify(payload))?.playerStates?.["second-body"]);
  delete payload.playerStates;
  assert.deepEqual(parity(JSON.stringify(payload))?.playerStates, {});
});

for (const version of [1, 2, 3, 4, 5]) {
  test(`decodeSave matches loadSave for v${version} migrations without rewriting bytes`, () => {
    const payload = JSON.parse(fixture);
    payload.saveVersion = version;
    delete payload.playerStates;
    if (version === 1) delete payload.player.resources;
    if (version <= 2) delete payload.resourceNodes;
    if (version <= 3) payload.player.rares = [{ uid: "legacy-rare", base: "sword", affixes: ["of power"], seed: 7, hour: 9 }];
    if (version <= 4) {
      delete payload.placedObjects;
      delete payload.structures;
      delete payload.blueprints;
    }
    const world = parity(JSON.stringify(payload));
    assert.ok(world);
    assert.deepEqual(world.people, payload.people);
    assert.equal(world.playerStates![world.player.id], world.player);
    assert.deepEqual(world.player.resources, { stacks: {} });
    assert.deepEqual(Object.keys(world.resourceNodes), []);
    assert.equal(Object.getPrototypeOf(world.resourceNodes), null);
    assert.deepEqual(world.placedObjects, []);
    assert.deepEqual(world.structures, []);
    assert.deepEqual(world.blueprints, []);
    if (version <= 3) {
      assert.equal(world.player.rares[0]?.source, "legacy");
      assert.equal(world.player.rares[0]?.workmanship, "ordinary");
    }
  });
}

test("decodeSave reconstructs scars, holes and regrowth in the existing order", () => {
  const payload = JSON.parse(fixture);
  payload.hour = 72;
  payload.scars = { "248,148": { kind: "dirt" }, "10,10": { kind: "sand", h: 4 } };
  payload.holes = { "10,10": { kind: "grass", h: 3, open: true } };
  payload.resourceNodes = depleteResourceNode({ seed: payload.seed, tx: 248, ty: 148, nodeKind: "tree", hour: 0, resourceNodes: {} });
  delete payload.saplings;
  delete payload.plantedTimber;
  const world = parity(JSON.stringify(payload));
  assert.ok(world);
  assert.equal(world.tiles[148]![248]!.kind, "tree");
  assert.equal(Object.hasOwn(world.scars, "248,148"), false);
  assert.equal(world.tiles[10]![10]!.kind, "pit");
  assert.equal(world.tiles[10]![10]!.h, 2);
  assert.deepEqual(world.saplings, []);
  assert.deepEqual(world.plantedTimber, {});
});

test("decodeSave and loadSave reject malformed JSON, schemas, people and actor sheets", () => {
  for (const raw of ["", "{bad json", "null", "[]", "{}", "42"]) assert.equal(parity(raw), null);
  const mutations = [
    (p: ReturnType<typeof JSON.parse>) => { p.saveVersion = 8; },
    (p: ReturnType<typeof JSON.parse>) => { p.people[0].path = [null]; },
    (p: ReturnType<typeof JSON.parse>) => { p.playerStates = null; },
    (p: ReturnType<typeof JSON.parse>) => { p.playerStates["second-body"].id = "mismatch"; },
    (p: ReturnType<typeof JSON.parse>) => { p.playerStates["second-body"].mana = "full"; },
    (p: ReturnType<typeof JSON.parse>) => { p.playerStates[p.player.id].mana += 1; },
    (p: ReturnType<typeof JSON.parse>) => { p.saveVersion = 1; p.player.pack.log = "many"; },
  ];
  for (const mutate of mutations) {
    const payload = JSON.parse(fixture);
    mutate(payload);
    assert.equal(parity(JSON.stringify(payload)), null);
  }
});

test("decodeSave does not access storage while loadSave keeps missing/throwing storage semantics", () => {
  assert.equal(save.loadSave(), null);
  let accesses = 0;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() {
    accesses++;
    throw new Error("storage denied");
  } });
  assert.ok(decode(fixture));
  assert.equal(accesses, 0);
  assert.equal(save.loadSave(), null);
  assert.equal(accesses, 1);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem() { throw new Error("read denied"); },
  } });
  assert.equal(save.loadSave(), null);
});
