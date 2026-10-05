import test from "node:test";
import assert from "node:assert/strict";
import { FRONTIER_ART, sceneryBlocked } from "./frontier.ts";
import { generateTiles } from "./world.ts";
import { astar, walkable } from "./pathfinding.ts";
import type { World } from "./types.ts";

test("Reedwake ferry uses the connected river instead of a blocked gallery rectangle", () => {
  const p = FRONTIER_ART.find((p) => p.id === "reedwake-crossing")!;
  assert.equal(p.url, "/art/reedwake-waterfront/reedwake-crossing.glb");
  assert.equal(p.x, 955);
  assert.equal(p.z, 551);
  assert.ok("y" in p && p.y === 0, "authored world-height placement");
  const world = { tiles: generateTiles(7) } as World;
  for (let z = 548; z <= 553; z++) {
    assert.equal(world.tiles[z]![952]!.kind, "water", `keel over real river ${z}`);
    assert.equal(walkable(world, 952, z), false);
  }
  assert.equal(sceneryBlocked(954, 552), true, "raised decorative dock is not climbable");
  assert.equal(sceneryBlocked(960, 552), false, "removed slab is not an invisible wall");
  assert.ok(astar(world, 946, 560, 958, 560));
  assert.ok(astar(world, 958, 560, 946, 560));
});
