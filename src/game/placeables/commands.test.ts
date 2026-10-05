import assert from "node:assert/strict";
import test from "node:test";
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
import type { World } from "../types.ts";

function primed(boards = 20): World {
  const world = createStubWorld();
  world.player.id = "you";
  world.player.ghost = false;
  world.player.pack.board = boards;
  world.player.pack.ingot = 4;
  return world;
}

function snap(world: World) {
  return JSON.stringify({
    pack: world.player.pack,
    gold: world.gold,
    placed: world.placedObjects,
    structures: world.structures,
    buildings: world.buildings,
  });
}

test("placeObject spends boards, stamps a hold, and leaves a second refuse unchanged", () => {
  const world = primed();
  assert.equal(placeObject(world, "floor_timber", 100, 100, 0), null);
  assert.equal(world.player.pack.board, 18);
  assert.equal(world.placedObjects.length, 1);
  assert.equal(world.placedObjects[0]?.definitionId, "floor_timber");
  assert.equal(world.placedObjects[0]?.ownerId, "you");
  assert.equal(world.structures.length, 1);
  assert.equal(world.structures[0]?.objectIds[0], world.placedObjects[0]?.id);
  const after = snap(world);
  assert.equal(placeObject(world, "floor_timber", 100, 100, 0), "That ground is taken.");
  assert.equal(snap(world), after);
});

test("placeObject does not debit a short pack", () => {
  const world = primed(1);
  const before = snap(world);
  assert.equal(placeObject(world, "floor_timber", 100, 100, 0), "Need 2 board.");
  assert.equal(snap(world), before);
});

test("moveObject relocates without a second board cost", () => {
  const world = primed();
  assert.equal(placeObject(world, "floor_timber", 100, 100, 0), null);
  const id = world.placedObjects[0]!.id;
  const boards = world.player.pack.board;
  assert.equal(moveObject(world, id, 108, 108), null);
  assert.equal(world.placedObjects[0]?.tx, 108);
  assert.equal(world.player.pack.board, boards);
});

test("rotateObject turns in place; copyObject pays; reclaim refunds three-quarters", () => {
  const world = primed();
  assert.equal(placeObject(world, "wall_straight", 100, 100, 0), null);
  const id = world.placedObjects[0]!.id;
  const boardsAfterPlace = world.player.pack.board;
  assert.equal(rotateObject(world, id, 1), null);
  assert.equal(world.placedObjects[0]?.rotation, 1);
  assert.equal(world.player.pack.board, boardsAfterPlace);
  assert.equal(copyObject(world, id, 110, 110), null);
  assert.equal(world.placedObjects.length, 2);
  assert.equal(world.player.pack.board, boardsAfterPlace - 3);
  const copyId = world.placedObjects[1]!.id;
  const beforeReclaim = world.player.pack.board;
  assert.equal(reclaimObject(world, copyId), null);
  assert.equal(world.placedObjects.length, 1);
  assert.equal(world.player.pack.board, beforeReclaim + 2);
});

test("setObjectMaterial and renameStructure stay on the owner", () => {
  const world = primed();
  assert.equal(placeObject(world, "floor_timber", 100, 100, 0), null);
  const id = world.placedObjects[0]!.id;
  const sid = world.placedObjects[0]!.structureId!;
  const before = snap(world);
  assert.equal(setObjectMaterial(world, id, "timber", "glass"), "That dye is not for this piece.");
  assert.equal(snap(world), before);
  assert.equal(setObjectMaterial(world, id, "timber", "dark"), null);
  assert.equal(world.placedObjects[0]?.materialSlots.timber, "dark");
  assert.equal(renameStructure(world, sid, "North lodge"), null);
  assert.equal(world.structures[0]?.name, "North lodge");
  world.structures[0]!.ownerId = "other";
  const locked = snap(world);
  assert.equal(renameStructure(world, sid, "Stolen"), "That hold is not yours.");
  assert.equal(snap(world), locked);
});
