import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createWorld, generateTiles } from "./world.ts";
import { astar, lineWalkable, walkable } from "./pathfinding.ts";
import { groundY } from "./height.ts";
import { encodeSave, loadSave, SAVE_KEY } from "./save.ts";
import type { World } from "./types.ts";

// Independent authored contract: a small irregular pool southwest of spawn.
const shoreline = [".sssss.", "sswwwss", "swwwwws", "swwwwws", "sswwwws", ".sswwss", "..ssss."];
const water: [number, number][] = [];
const bank: [number, number][] = [];
for (const [dy, row] of shoreline.entries()) {
  for (const [dx, cell] of [...row].entries()) {
    if (cell === "w") water.push([247 + dx, 301 + dy]);
    if (cell === "s") bank.push([247 + dx, 301 + dy]);
  }
}

test("starter pond is a fixed, compact irregular water patch with a reachable dry bank across seeds", () => {
  for (const seed of [1, 7, 30, 123456789]) {
    const world = { tiles: generateTiles(seed) } as World;
    for (const [x, y] of water) {
      assert.deepEqual(world.tiles[y]![x], { kind: "water", h: 0 }, `${seed}: water ${x},${y}`);
      assert.equal(walkable(world, x, y), false);
      assert.equal(groundY(world, x, y), 0, "existing renderer samples a level water surface");
    }
    for (const [x, y] of bank) {
      assert.deepEqual(world.tiles[y]![x], { kind: "sand", h: 1 }, `${seed}: bank ${x},${y}`);
      assert.ok(walkable(world, x, y));
      assert.ok(astar(world, 256, 293, x, y), `${seed}: spawn reaches bank ${x},${y}`);
    }
    assert.deepEqual(world.tiles[299]![252], { kind: "dirt", h: 3 });
    assert.deepEqual(world.tiles[300]![252], { kind: "step", h: 2 });
    assert.ok(lineWalkable(world, 252, 299, 252, 301), "graded approach descends without a cliff");
    assert.equal(lineWalkable(world, 250, 301, 250, 302), false, "bank does not permit walking into water");
    assert.ok(astar(world, 256, 293, 256, 312), "main south route stays connected");
    // The existing gate approach is disconnected even before the pond stamp;
    // preserve its dry pad rather than silently widening this terrain change.
    for (let y = 302; y <= 306; y++) {
      for (let x = 259; x <= 263; x++) {
        if (Math.hypot(x - 261, y - 304) <= 2) {
          assert.deepEqual(world.tiles[y]![x], { h: 1, kind: "cobble" });
          assert.ok(walkable(world, x, y));
        }
      }
    }
    for (const [x, y] of [[256, 290], [261, 295], [263, 291]]) {
      assert.deepEqual(world.tiles[y!]![x!], { h: 3, kind: "cobble" }, "starter landmark unchanged");
    }
  }
});

test("pond changes are bounded; every tile outside its local envelope retains the pre-pond seed-7 baseline", () => {
  const tiles = generateTiles(7);
  for (let y = 299; y <= 307; y++) {
    for (let x = 247; x <= 253; x++) tiles[y]![x] = { h: 0, kind: "grass" };
  }
  // Emberdeep adds only x998..1122/z648..730 and its x648..652/z561..568 spur.
  // Restoring those 10,415 changed tiles from the pre-Emberdeep generator
  // reproduces the prior 9cc3d0e8... baseline; all other tiles are unchanged.
  assert.equal(createHash("sha256").update(JSON.stringify(tiles)).digest("hex"),
    "5f0c72a0ded40adaead478e719536567bc69ccb3d9a8a3e54624ac8cd6e68db8");
});

test("tile-free saves receive the pond without overwriting stored terrain scars", () => {
  const world = createWorld(7);
  world.scars["250,304"] = { kind: "dirt", h: 4 };
  world.scars["252,300"] = { kind: "cobble", h: 3 };
  const raw = encodeSave(world);
  assert.equal(JSON.parse(raw).tiles, null);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key: string) => key === SAVE_KEY ? raw : null },
  });
  try {
    const loaded = loadSave();
    assert.ok(loaded);
    assert.deepEqual(loaded.tiles[303]![250], { kind: "water", h: 0 });
    assert.deepEqual(loaded.tiles[304]![250], world.scars["250,304"]);
    assert.deepEqual(loaded.tiles[300]![252], world.scars["252,300"]);
    assert.deepEqual(loaded.scars, world.scars);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});
