import assert from "node:assert/strict";
import test from "node:test";
import { BUILDING_META } from "./catalog.ts";
import { BUILD_SIZE, VOX, boxesOverlap, buildingBox } from "./building-size.ts";
import type { BuildingKind } from "./types.ts";

const FOOTPRINTS: Record<BuildingKind, { x0: number; x1: number; z0: number; z1: number }> = {
  hall: { x0: -5, x1: 5, z0: -4, z1: 4 },
  dormitory: { x0: -6, x1: 6, z0: -3, z1: 3 },
  kitchen: { x0: -3, x1: 3, z0: -3, z1: 3 },
  yard: { x0: -5, x1: 5, z0: -5, z1: 5 },
  market: { x0: -4, x1: 4, z0: -3, z1: 3 },
  forge: { x0: -3, x1: 3, z0: -3, z1: 3 },
  tavern: { x0: -4, x1: 4, z0: -3, z1: 3 },
  notice: { x0: -1, x1: 1, z0: 0, z1: 2 },
  board: { x0: -3, x1: 3, z0: 0, z1: 2 },
  farm: { x0: -5, x1: 5, z0: -5, z1: 5 },
  bank: { x0: -3, x1: 3, z0: -2, z1: 2 },
  keep: { x0: -20, x1: 21, z0: -16, z1: 15 },
  rampart: { x0: -8, x1: 7, z0: -1, z1: 0 },
  rampartV: { x0: -1, x1: 0, z0: -8, z1: 7 },
  tower: { x0: -2, x1: 2, z0: -2, z1: 2 },
  gatehouse: { x0: -2, x1: 2, z0: -4, z1: 4 },
  shop: { x0: -4, x1: 4, z0: -3, z1: 3 },
  townhome: { x0: -4, x1: 4, z0: -3, z1: 3 },
  townhouse: { x0: -3, x1: 3, z0: -3, z1: 3 },
  cottage: { x0: -3, x1: 3, z0: -2, z1: 2 },
  porch: { x0: -2, x1: 2, z0: -1, z1: 1 },
  hut: { x0: -3, x1: 3, z0: -2, z1: 2 },
  homestead: { x0: -3, x1: 3, z0: -3, z1: 3 },
};

test("building-size - every kind has a locked footprint", () => {
  assert.equal(VOX, 0.5);
  assert.deepEqual(Object.keys(BUILD_SIZE).sort(), Object.keys(BUILDING_META).sort());
  assert.deepEqual(BUILD_SIZE, FOOTPRINTS);
});

test("building-size - world box is voxel extents from the tile origin", () => {
  const box = buildingBox("kitchen", 100, 200);
  assert.deepEqual(box, { x0: 98.5, x1: 102, z0: 198.5, z1: 202 });
});

test("building-size - shared edges and corners do not overlap; interiors do", () => {
  const a = { x0: 0, x1: 1, z0: 0, z1: 1 };
  assert.equal(boxesOverlap(a, { x0: 1, x1: 2, z0: 0, z1: 1 }), false);
  assert.equal(boxesOverlap(a, { x0: 1, x1: 2, z0: 1, z1: 2 }), false);
  assert.equal(boxesOverlap(a, { x0: 0, x1: 1, z0: 1, z1: 2 }), false);
  assert.equal(boxesOverlap(a, { x0: 0.5, x1: 1.5, z0: 0, z1: 1 }), true);
  assert.equal(boxesOverlap(a, a), true);
});
