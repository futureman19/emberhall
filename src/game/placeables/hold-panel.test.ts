import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { encodeSave } from "../save.ts";
import { getWorld, setWorld } from "../live.ts";
import { createWorld } from "../world.ts";
import { useGame } from "../store.ts";
import { leftAt, liftAt } from "../world-pointer.ts";
import { getHoldBuild } from "./build-mode.ts";
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
  useGame.setState({ phase: "playing", panel: "none" });
  return getWorld();
}

test("The Hold catalog is kit pieces, not a second town-build menu", () => {
  const panel = readFileSync(new URL("../../components/game/hold-panel.tsx", import.meta.url), "utf8");
  const hud = readFileSync(new URL("../../components/game/hud.tsx", import.meta.url), "utf8");
  assert.match(panel, /data-testid="hold-panel"/);
  assert.match(panel, /PLACEABLE_CATALOG/);
  assert.match(panel, /PLACEABLE_CATEGORIES/);
  assert.match(panel, /Search/);
  assert.match(panel, /reclaimHold/);
  assert.match(panel, /Town halls/);
  assert.match(hud, /from "@\/components\/game\/hold-panel"/);
  assert.match(hud, /<HoldPanel \/>/);
});

test("selecting a piece arms a ghost; closing The Hold writes nothing", () => {
  primed();
  const before = encodeSave(getWorld());
  useGame.getState().setPanel("build");
  useGame.getState().armHoldPiece("floor_timber");
  assert.equal(getHoldBuild().active, true);
  assert.equal(getHoldBuild().definitionId, "floor_timber");
  assert.equal(encodeSave(getWorld()), before);
  useGame.getState().setPanel("none");
  assert.equal(getHoldBuild().active, false);
  assert.equal(getHoldBuild().definitionId, null);
  assert.equal(getWorld().placedObjects.length, 0);
  assert.equal(encodeSave(getWorld()), before);
});

test("placing spends boards and reclaiming refunds", () => {
  primed();
  useGame.getState().setPanel("build");
  useGame.getState().armHoldPiece("floor_timber");
  leftAt(100, 100);
  liftAt(100, 100);
  const id = getWorld().placedObjects[0]?.id;
  assert.ok(id);
  assert.equal(getWorld().player.pack.board, 18);
  useGame.getState().reclaimHold(id!);
  assert.equal(getWorld().placedObjects.length, 0);
  assert.equal(getWorld().player.pack.board, 19);
});
