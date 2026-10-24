import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "./world.ts";
import { astar, walkable } from "./pathfinding.ts";
import { encodeSave, loadSave, SAVE_KEY } from "./save.ts";
import { EMBERDEEP_ROOMS, EMBERDEEP_ANCHORS, EMBERDEEP_ENTRY, EMBERDEEP_EXIT, enterEmberdeep, leaveEmberdeep, visitEmberdeep, clearEmberdeepRoom, emberdeepState } from "./emberdeep.ts";

const world = createWorld(7);
test("every authored floor tile is cardinally reachable when the seal is open", () => {
  emberdeepState(world).bossDoorOpen = true;
  const seen = new Set<string>();
  const queue: number[][] = [[EMBERDEEP_EXIT.tx, EMBERDEEP_EXIT.ty]];
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i]!;
    const key = `${x},${z}`;
    if (seen.has(key) || !walkable(world, x!, z!)) continue;
    seen.add(key);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push([x! + dx!, z! + dz!]);
  }
  for (let z = 648; z <= 730; z++) for (let x = 998; x <= 1122; x++) {
    if (world.tiles[z]![x]!.kind === "cobble") assert.ok(seen.has(`${x},${z}`), `unreachable floor ${x},${z}`);
  }
  emberdeepState(world).bossDoorOpen = false;
});
test("malformed dungeon records are rejected by the real save loader", () => {
  const base = JSON.parse(encodeSave(world));
  const old = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    for (const emberdeep of [null, {}, { version: 2, visited: [], cleared: [], bossDoorOpen: false },
      { version: 1, visited: ["unknown"], cleared: [], bossDoorOpen: false },
      { version: 1, visited: ["entrance", "entrance"], cleared: [], bossDoorOpen: false },
      { version: 1, visited: [], cleared: ["entrance"], bossDoorOpen: false },
      { version: 1, visited: [], cleared: [], bossDoorOpen: "yes" }]) {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => key === SAVE_KEY ? JSON.stringify({ ...base, emberdeep }) : null } });
      assert.equal(loadSave(), null, JSON.stringify(emberdeep));
    }
  } finally {
    if (old) Object.defineProperty(globalThis, "localStorage", old);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
test("Emberdeep rooms are reachable except the sealed boss; unsealing opens its only route", () => {
  for (const room of EMBERDEEP_ROOMS) {
    const path = astar(world, EMBERDEEP_EXIT.tx, EMBERDEEP_EXIT.ty, room.tx, room.ty);
    if (room.id === "furnace") assert.equal(path, null);
    else assert.ok(path, room.id);
  }
  emberdeepState(world).bossDoorOpen = true;
  const boss = EMBERDEEP_ROOMS.find(r => r.id === "furnace")!;
  assert.ok(astar(world, EMBERDEEP_EXIT.tx, EMBERDEEP_EXIT.ty, boss.tx, boss.ty));
  emberdeepState(world).bossDoorOpen = false;
});
test("spawn anchors have stable unique identities, room coverage and walkable positions", () => {
  assert.equal(new Set(EMBERDEEP_ANCHORS.map(a => a.id)).size, EMBERDEEP_ANCHORS.length);
  for (const anchor of EMBERDEEP_ANCHORS) if (anchor.roomId !== "furnace") assert.ok(walkable(world, anchor.tx, anchor.ty), `sealed-safe spawn ${anchor.id}`);
  emberdeepState(world).bossDoorOpen = true;
  for (const room of EMBERDEEP_ROOMS) assert.ok(EMBERDEEP_ANCHORS.some(a => a.roomId === room.id));
  for (const anchor of EMBERDEEP_ANCHORS) assert.ok(walkable(world, anchor.tx, anchor.ty), anchor.id);
  emberdeepState(world).bossDoorOpen = false;
});
test("entrance rejects remote use and makes a reversible trip without replacing the world", () => {
  const p = world.people.find(p => p.isPlayer)!;
  assert.ok(enterEmberdeep(world));
  p.x = EMBERDEEP_ENTRY.tx; p.z = EMBERDEEP_ENTRY.ty;
  const fauna = world.fauna;
  assert.equal(enterEmberdeep(world), null);
  assert.equal(p.x, EMBERDEEP_EXIT.tx);
  assert.equal(leaveEmberdeep(world), null);
  assert.equal(p.x, EMBERDEEP_ENTRY.tx);
  assert.equal(world.fauna, fauna);
});
test("visited and cleared rooms and in-dungeon position survive the real save codec", () => {
  const p = world.people.find(p => p.isPlayer)!;
  p.x = EMBERDEEP_ENTRY.tx; p.z = EMBERDEEP_ENTRY.ty;
  enterEmberdeep(world);
  visitEmberdeep(world);
  clearEmberdeepRoom(world, "entrance");
  const raw = encodeSave(world);
  const old = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => key === SAVE_KEY ? raw : null } });
  try {
    const loaded = loadSave()!;
    assert.ok(loaded);
    assert.deepEqual(loaded.emberdeep, world.emberdeep);
    assert.equal(loaded.people.find(p => p.isPlayer)!.x, EMBERDEEP_EXIT.tx);
    assert.equal(leaveEmberdeep(loaded), null);
  } finally {
    if (old) Object.defineProperty(globalThis, "localStorage", old);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
test("canonical walls and seal cannot be bypassed by scars or flight", () => {
  const boss = EMBERDEEP_ROOMS.find(r => r.id === "furnace")!;
  assert.equal(walkable(world, boss.tx, boss.ty), false);
  assert.equal(astar(world, 1087, 674, boss.tx, boss.ty, 9000, true), null);
  world.tiles[660]![1000] = { h: 0, kind: "cobble" };
  assert.equal(walkable(world, 1000, 660), false);
});
test("entrance spur is connected to the frontier road across deterministic seeds", () => {
  for (const seed of [7, 19, 31]) {
    const seeded = seed === 7 ? world : createWorld(seed);
    assert.ok(astar(seeded, 640, 560, EMBERDEEP_ENTRY.tx, EMBERDEEP_ENTRY.ty), `seed ${seed}`);
  }
  assert.equal(emberdeepState(world).bossDoorOpen, false, "clearing a room does not unseal the framework boss");
});
