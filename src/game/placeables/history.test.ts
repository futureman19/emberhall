import assert from "node:assert/strict";
import test from "node:test";
import { mulberry32 } from "../rng.ts";
import { createStubWorld } from "../world.ts";
import {
  copyObject,
  moveObject,
  placeObject,
  reclaimObject,
  renameStructure,
  rotateObject,
  setObjectMaterial,
} from "./commands.ts";
import { HISTORY_LIMIT, clearHistory, historyState, redo, undo, withHistory } from "./history.ts";
import type { Rotation } from "./schema.ts";
import type { World } from "../types.ts";

function primed(): World {
  const world = createStubWorld();
  world.player.id = "you";
  world.player.ghost = false;
  world.player.pack.board = 200;
  world.player.pack.ingot = 40;
  return world;
}

function hash(world: World) {
  return JSON.stringify({
    pack: world.player.pack,
    placed: world.placedObjects,
    structures: world.structures,
  });
}

test("failed commands do not record; undo/redo restore exact pack and pieces", () => {
  const world = primed();
  const start = hash(world);
  assert.equal(withHistory(world, () => placeObject(world, "floor_timber", 100, 100, 0)), null);
  assert.notEqual(hash(world), start);
  assert.equal(withHistory(world, () => placeObject(world, "floor_timber", 100, 100, 0)), "That ground is taken.");
  assert.equal(historyState(world).past.length, 1);
  assert.equal(undo(world), null);
  assert.equal(hash(world), start);
  assert.equal(undo(world), "Nothing to undo.");
  assert.equal(redo(world), null);
  assert.equal(world.placedObjects.length, 1);
  assert.equal(world.player.pack.board, 198);
});

test("a new command after undo drops redo", () => {
  const world = primed();
  assert.equal(withHistory(world, () => placeObject(world, "floor_timber", 100, 100, 0)), null);
  const id = world.placedObjects[0]!.id;
  assert.equal(withHistory(world, () => moveObject(world, id, 108, 108)), null);
  assert.equal(undo(world), null);
  assert.equal(withHistory(world, () => placeObject(world, "fence_rail", 120, 120, 0)), null);
  assert.equal(redo(world), "Nothing to redo.");
  assert.equal(world.placedObjects.length, 2);
});

test("history is bounded and clears on demand", () => {
  const world = primed();
  for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
    assert.equal(withHistory(world, () => placeObject(world, "post_beam", 80 + i * 2, 80, 0)), null);
  }
  assert.equal(historyState(world).past.length, HISTORY_LIMIT);
  clearHistory(world);
  assert.equal(undo(world), "Nothing to undo.");
});

test("undo-all then redo-all restores hashes after mixed commands", () => {
  const world = primed();
  const rng = mulberry32(42);
  const start = hash(world);
  const ops = 24;
  for (let i = 0; i < ops; i++) {
    const roll = rng();
    const existing = world.placedObjects;
    let err: string | null = "skip";
    if (existing.length === 0 || roll < 0.35) {
      err = withHistory(world, () => placeObject(world, "floor_timber", 90 + i * 2, 90, 0));
    } else if (roll < 0.5) {
      const obj = existing[Math.floor(rng() * existing.length)]!;
      err = withHistory(world, () => moveObject(world, obj.id, 130 + i, 90));
    } else if (roll < 0.65) {
      const obj = existing[Math.floor(rng() * existing.length)]!;
      err = withHistory(world, () => rotateObject(world, obj.id, ((obj.rotation + 1) % 4) as Rotation));
    } else if (roll < 0.8) {
      const obj = existing[Math.floor(rng() * existing.length)]!;
      err = withHistory(world, () => copyObject(world, obj.id, 140 + i * 2, 100));
    } else if (roll < 0.9) {
      const obj = existing[Math.floor(rng() * existing.length)]!;
      err = withHistory(world, () => setObjectMaterial(world, obj.id, "timber", "dark"));
    } else if (existing.length > 1) {
      const obj = existing[existing.length - 1]!;
      err = withHistory(world, () => reclaimObject(world, obj.id));
    } else if (world.structures[0]) {
      err = withHistory(world, () => renameStructure(world, world.structures[0]!.id, `Lodge ${i}`));
    }
    void err;
  }
  const end = hash(world);
  assert.notEqual(end, start);
  while (undo(world) === null) {
    /* undo-all */
  }
  assert.equal(hash(world), start);
  while (redo(world) === null) {
    /* redo-all */
  }
  assert.equal(hash(world), end);
});
