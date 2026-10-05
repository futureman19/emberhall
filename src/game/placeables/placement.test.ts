import assert from "node:assert/strict";
import test from "node:test";
import { boxesOverlap } from "../building-size.ts";
import { createStubWorld } from "../world.ts";
import { canPlace, placedBox } from "./placement.ts";
import type { World } from "../types.ts";

function primed(boards = 20): World {
  const world = createStubWorld();
  world.player.id = "you";
  world.player.ghost = false;
  world.player.pack.board = boards;
  world.player.pack.ingot = 4;
  return world;
}

test("placedBox is a voxel AABB at the tile origin", () => {
  const box = placedBox("floor_timber", 100, 200, 0);
  assert.deepEqual(box, { x0: 100, x1: 101, z0: 200, z1: 201 });
});

test("canPlace accepts a timber floor on grass", () => {
  assert.equal(canPlace(primed(), "floor_timber", 100, 100, 0), null);
});

test("canPlace refuses ghosts, unknown pieces, water, and short packs", () => {
  const unknown = primed();
  const u = JSON.stringify({ pack: unknown.player.pack, placed: unknown.placedObjects });
  assert.equal(canPlace(unknown, "no_such_piece", 100, 100, 0), "No such piece.");
  assert.equal(JSON.stringify({ pack: unknown.player.pack, placed: unknown.placedObjects }), u);

  const ghost = primed();
  ghost.player.ghost = true;
  const g = JSON.stringify({ pack: ghost.player.pack, placed: ghost.placedObjects });
  assert.equal(canPlace(ghost, "floor_timber", 100, 100, 0), "A ghost cannot.");
  assert.equal(JSON.stringify({ pack: ghost.player.pack, placed: ghost.placedObjects }), g);

  const wet = primed();
  wet.tiles[100]![100]!.kind = "water";
  const w = JSON.stringify({ pack: wet.player.pack, placed: wet.placedObjects });
  assert.equal(canPlace(wet, "floor_timber", 100, 100, 0), "No footing.");
  assert.equal(JSON.stringify({ pack: wet.player.pack, placed: wet.placedObjects }), w);

  const poor = primed(0);
  const p = JSON.stringify({ pack: poor.player.pack, placed: poor.placedObjects });
  assert.equal(canPlace(poor, "floor_timber", 100, 100, 0), "Need 2 board.");
  assert.equal(JSON.stringify({ pack: poor.player.pack, placed: poor.placedObjects }), p);
});

test("canPlace treats overlapping pieces and civic shells as taken ground", () => {
  const world = primed();
  world.placedObjects.push({
    id: "o1",
    definitionId: "floor_timber",
    definitionVersion: 1,
    tx: 100,
    ty: 100,
    level: 0,
    rotation: 0,
    materialSlots: { timber: "timber" },
    ownerId: "you",
    structureId: "s1",
    name: null,
    state: {},
  });
  assert.equal(canPlace(world, "floor_timber", 100, 100, 0), "That ground is taken.");
  const other = primed();
  other.buildings.push({ id: "k", kind: "kitchen", tx: 100, ty: 100, beds: [] });
  assert.equal(canPlace(other, "floor_timber", 100, 100, 0), "That ground is taken.");
  const a = placedBox("floor_timber", 100, 100, 0);
  const b = placedBox("floor_timber", 102, 100, 0);
  assert.equal(boxesOverlap(a, b), false);
});
