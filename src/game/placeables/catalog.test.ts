import assert from "node:assert/strict";
import test from "node:test";
import { ITEM_META, SKILL_META } from "../catalog.ts";
import { PALETTE } from "./materials.ts";
import { PLACEABLE_BY_ID, PLACEABLE_CATALOG, PLACEABLE_CATEGORIES } from "./catalog.ts";
import type { PlaceableDefinition } from "./types.ts";

const REQUIRED_IDS = [
  "floor_timber",
  "floor_stone",
  "wall_straight",
  "wall_window",
  "wall_doorway",
  "post_beam",
  "fence_rail",
  "roof_slope",
  "roof_ridge",
  "door_timber",
  "chest_keep",
  "bench_work",
  "hearth_stone",
  "lamp_ember",
  "bed_simple",
  "table_stool",
  "sign_board",
  "planter_box",
] as const;

const VOXEL_MAX = 64;

test("hearthwright kit has unique stable ids covering the v1 lodge set", () => {
  const ids = PLACEABLE_CATALOG.map((d) => d.id);
  assert.deepEqual([...ids].sort(), [...REQUIRED_IDS].sort());
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 15 && ids.length <= 20);
  for (const id of REQUIRED_IDS) {
    assert.equal(PLACEABLE_BY_ID[id]?.id, id);
  }
});

test("every piece has legal rotations, footprint, materials, costs, and bounded voxels", () => {
  for (const def of PLACEABLE_CATALOG) {
    assertPiece(def);
  }
});

test("Hold categories are the diegetic set and every piece is filed", () => {
  assert.deepEqual([...PLACEABLE_CATEGORIES], [
    "frames",
    "roofs",
    "doors",
    "hearths",
    "work",
    "keeping",
    "comfort",
    "signs",
    "garden",
  ]);
  for (const def of PLACEABLE_CATALOG) {
    assert.ok((PLACEABLE_CATEGORIES as readonly string[]).includes(def.category), def.id);
  }
});

test("functional pieces declare exactly one world verb", () => {
  assert.equal(PLACEABLE_BY_ID.door_timber?.fn, "door");
  assert.equal(PLACEABLE_BY_ID.chest_keep?.fn, "storage");
  assert.equal(PLACEABLE_BY_ID.bench_work?.fn, "craftStation");
  assert.equal(PLACEABLE_BY_ID.hearth_stone?.fn, "hearth");
  assert.equal(PLACEABLE_BY_ID.lamp_ember?.fn, "light");
  assert.equal(PLACEABLE_BY_ID.bed_simple?.fn, "bed");
  assert.equal(PLACEABLE_BY_ID.sign_board?.fn, "sign");
  assert.equal(PLACEABLE_BY_ID.planter_box?.fn, "planter");
  assert.equal(PLACEABLE_BY_ID.wall_straight?.fn, undefined);
});

function assertPiece(def: PlaceableDefinition) {
  assert.ok(def.id.length > 0 && def.id.length <= 64, def.id);
  assert.equal(def.schemaVersion, 1, def.id);
  assert.ok(def.label.length > 0, def.id);
  assert.ok(def.rotations.length > 0, def.id);
  assert.ok(def.rotations.every((r) => r === 0 || r === 1 || r === 2 || r === 3), def.id);
  assert.ok(def.footprint.x0 <= def.footprint.x1, def.id);
  assert.ok(def.footprint.z0 <= def.footprint.z1, def.id);
  assert.ok(def.voxels.length > 0 && def.voxels.length <= VOXEL_MAX, `${def.id} voxels ${def.voxels.length}`);
  assert.ok(def.cost.every((c) => c.n >= 0 && Object.hasOwn(ITEM_META, c.item)), def.id);
  assert.ok(Object.hasOwn(SKILL_META, def.skill), def.id);
  assert.ok(def.weight >= 0, def.id);
  for (const [slot, allowed] of Object.entries(def.materialSlots)) {
    assert.ok(Object.hasOwn(PALETTE, slot) || slot === "timber" || slot === "fill", def.id);
    assert.ok(allowed.length > 0, def.id);
    for (const block of allowed) assert.ok(Object.hasOwn(PALETTE, block), `${def.id} ${block}`);
  }
  for (const v of def.voxels) {
    assert.ok(Object.hasOwn(PALETTE, v.t), `${def.id} voxel ${v.t}`);
  }
}
