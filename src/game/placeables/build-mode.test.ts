import assert from "node:assert/strict";
import test from "node:test";
import { encodeSave } from "../save.ts";
import { getWorld, setWorld } from "../live.ts";
import { createWorld } from "../world.ts";
import { dropBuildHold, useGame } from "../store.ts";
import { leftAt, liftAt } from "../world-pointer.ts";
import {
  cancelHoldBuild,
  enterHoldBuild,
  exitHoldBuild,
  getHoldBuild,
  selectHoldPiece,
} from "./build-mode.ts";
import type { World } from "../types.ts";

function primed(): World {
  const world = createWorld(1);
  world.player.id = world.player.id || "you";
  world.player.ghost = false;
  world.player.pack.board = 20;
  for (let z = 98; z <= 102; z++) {
    for (let x = 98; x <= 102; x++) {
      const tile = world.tiles[z]?.[x];
      if (tile) tile.kind = "grass";
    }
  }
  setWorld(world);
  return getWorld();
}

test("entering and leaving Hold build does not change the save", () => {
  const world = primed();
  const before = encodeSave(world);
  enterHoldBuild();
  selectHoldPiece("floor_timber");
  assert.equal(getHoldBuild().active, true);
  assert.equal(getHoldBuild().definitionId, "floor_timber");
  assert.equal(encodeSave(getWorld()), before);
  exitHoldBuild();
  assert.equal(getHoldBuild().active, false);
  assert.equal(getHoldBuild().definitionId, null);
  assert.equal(encodeSave(getWorld()), before);
  assert.equal(world.placedObjects.length, 0);
});

test("pointer cancel after press does not place a piece", () => {
  primed();
  enterHoldBuild();
  selectHoldPiece("floor_timber");
  const before = encodeSave(getWorld());
  leftAt(100, 100);
  dropBuildHold();
  cancelHoldBuild();
  assert.equal(getWorld().placedObjects.length, 0);
  assert.equal(getWorld().player.pack.board, 20);
  assert.equal(encodeSave(getWorld()), before);
});

test("press then lift places once and spends boards", () => {
  primed();
  useGame.setState({ phase: "playing" });
  enterHoldBuild();
  selectHoldPiece("floor_timber");
  leftAt(100, 100);
  liftAt(100, 100);
  assert.equal(getWorld().placedObjects.length, 1);
  assert.equal(getWorld().placedObjects[0]?.definitionId, "floor_timber");
  assert.equal(getWorld().player.pack.board, 18);
  exitHoldBuild();
});
