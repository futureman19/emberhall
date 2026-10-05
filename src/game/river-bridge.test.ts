import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateTiles } from "./world.ts";
import { groundY } from "./height.ts";
import { astar, walkable, climbOk } from "./pathfinding.ts";
import type { World } from "./types.ts";

const w = { tiles: generateTiles(7) } as World;
test("Reedwake deck is a level canonical walk surface with graded bank approaches", () => {
  for (let z = 559; z <= 561; z++) {
    for (let x = 949; x <= 955; x++) {
      assert.equal(w.tiles[z]![x]!.h, 6);
      assert.ok(walkable(w, x, z));
      assert.ok(Math.abs(groundY(w, x + 0.25, z) - 1.2) < 1e-9);
    }
  }
  for (let x = 945; x < 959; x++) assert.ok(climbOk(w.tiles[560]![x]!, w.tiles[560]![x + 1]!));
  assert.ok(astar(w, 945, 560, 959, 560));
  assert.ok(astar(w, 959, 560, 945, 560));
});
test("side rails cannot be walked through and the adjacent river stays water", () => {
  for (let x = 949; x <= 955; x++) {
    assert.equal(walkable(w, x, 558), false);
    assert.equal(walkable(w, x, 562), false);
  }
  assert.equal(w.tiles[557]![952]!.kind, "water");
});
test("water remains visibly below the bridge while actor footing stays on top", async () => {
  const bridge = await import("./river-bridge.ts");
  assert.equal(typeof bridge.bridgeTerrainY, "function");
  assert.equal(bridge.bridgeTerrainY(w, 952, 560, groundY(w, 952, 560)), 0.6);
  assert.equal(bridge.bridgeTerrainY(w, 270, 320, 0.4), 0.4);
});

test("bridge bank surface feathers as earth without changing step collision or other fords", async () => {
  const bridge = await import("./river-bridge.ts");
  assert.equal(typeof bridge.bridgeSurfaceKind, "function");
  assert.equal(bridge.bridgeSurfaceKind(947, 560, "step"), "dirt");
  assert.equal(bridge.bridgeSurfaceKind(957, 560, "step"), "dirt");
  assert.equal(bridge.bridgeSurfaceKind(952, 560, "step"), "step");
  assert.equal(bridge.bridgeSurfaceKind(940, 820, "step"), "step");
  assert.equal(bridge.bridgeSurfaceKind(947, 560, "water"), "water");
  assert.equal(bridge.bridgeSurfaceKind(947, 560, "dirt"), "dirt");
  assert.equal(w.tiles[560]![947]!.kind, "step");
});

test("original editable bridge and runtime GLB are delivered", () => {
  assert.ok(fs.existsSync("art/blender/river-bridge/reedwake-bridge.blend"));
  assert.ok(fs.existsSync("public/art/river-bridge/reedwake-bridge.glb"));
});
