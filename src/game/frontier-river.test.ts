import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { generateTiles } from "./world.ts";
import { isFrontierRiverSurface } from "./frontier-river.ts";

test("river water and stone fords retain their surface identity instead of biome sand/snow tint", () => {
  assert.equal(isFrontierRiverSurface(990, 660, "water"), true);
  assert.equal(isFrontierRiverSurface(940, 820, "step"), true);
  assert.equal(isFrontierRiverSurface(990, 660, "dirt"), false, "respect saved scars");
  assert.equal(isFrontierRiverSurface(256, 292, "water"), false, "legacy renderer unchanged");
  assert.equal(isFrontierRiverSurface(800, 800, "water"), false, "unrelated terrain unchanged");
});
import { MAP, placeById } from "./atlas.ts";
import { FRONTIER_ART, FRONTIER_SITES } from "./frontier.ts";
import { astar, walkable } from "./pathfinding.ts";
import type { World } from "./types.ts";

test("ford road shoulders taper into wet bank margins without rectangular dirt tongues", () => {
  for (const [x, z] of [
    [746, 270],
    [954, 562],
    [949, 822],
  ]) {
    assert.notEqual(tiles[z!]![x!]!.kind, "dirt", `${x},${z} bank join`);
  }
});

const tiles = generateTiles(7);
const world = { tiles } as World;
test("river connects mountain snowmelt through the mill to the southern map edge", () => {
  const targets = [
    [738, 258],
    [800, 340],
    [890, 430],
    [952, 546],
    [952, 585],
    [990, 660],
    [940, 820],
    [970, 940],
    [1100, MAP - 1],
  ];
  const pending = [[738, 258]];
  const seen = new Set<string>();
  for (let i = 0; i < pending.length; i++) {
    const [x, z] = pending[i]!;
    const key = `${x},${z}`;
    if (seen.has(key)) continue;
    const t = tiles[z]?.[x];
    if (x < 700 || !t || (t.kind !== "water" && t.kind !== "step")) continue;
    seen.add(key);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      pending.push([x! + dx!, z! + dz!]);
  }
  for (const [x, z] of targets) assert.ok(seen.has(`${x},${z}`), `connected river ${x},${z}`);
  assert.ok(seen.size > 5000, "a full river, not small decorative pools");
});

test("water is level downstream, blocked, with explicit traversable stone fords", () => {
  for (const [x, z] of [
    [738, 258],
    [800, 340],
    [890, 430],
    [952, 546],
    [952, 585],
    [990, 660],
    [970, 940],
    [1100, MAP - 1],
  ]) {
    assert.equal(tiles[z!]![x!]!.kind, "water");
    assert.equal(tiles[z!]![x!]!.h, 3);
    assert.equal(walkable(world, x!, z!), false);
  }
  for (const [x, z, span] of [
    [750, 268, 9],
    [952, 560, 7],
    [940, 820, 14],
  ]) {
    assert.equal(tiles[z!]![x!]!.kind, "step");
    assert.ok(astar(world, x! - span!, z!, x! + span!, z!));
    assert.ok(astar(world, x! + span!, z!, x! - span!, z!));
    assert.equal(tiles[z! - 3]![x!]!.kind, "water", "road shoulder must not dam the river");
  }
});

test("river preserves all legacy tiles and keeps landmark anchors dry and approaches reachable", () => {
  assert.equal(
    createHash("sha256")
      .update(JSON.stringify(tiles.slice(0, 512).map((r) => r.slice(0, 512))))
      .digest("hex"),
    "4587ba9a206d892e12f896ec01f38a8516152c6cf5dd42701db270f2af40c6a4",
  );
  for (const p of FRONTIER_ART) assert.notEqual(tiles[p.z]![p.x]!.kind, "water", p.id);
  const start = placeById("twinward");
  for (const p of FRONTIER_SITES) {
    assert.ok(astar(world, start.tx, start.ty, p.tx, p.ty, 48000), p.id);
    assert.ok(astar(world, p.tx, p.ty, start.tx, start.ty, 48000), `${p.id} return`);
  }
});
