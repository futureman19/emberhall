// parts.test.ts — the sculptor's rails: validation, registry, anchors.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PART_GRID,
  PART_MAX_VOXELS,
  PART_SCHEMA,
  SLOT_ANCHOR,
  listParts,
  newPartId,
  partIdsOf,
  removePart,
  savePart,
  validatePart,
  type VoxelPartV1,
} from "./parts.ts";
import { LOOK_SCHEMA } from "./types.ts";

function okPart(over: Partial<VoxelPartV1> = {}): VoxelPartV1 {
  return {
    schema: PART_SCHEMA,
    id: newPartId(),
    name: "Test Cap",
    slot: "hair",
    voxels: [
      { x: 0, y: 0, z: 0, c: "#a85a42" },
      { x: 1, y: 0, z: 0, c: "#c9a36a" },
    ],
    createdAt: Date.now(),
    ...over,
  };
}

test("validation: a sound part passes", () => {
  assert.deepEqual(validatePart(okPart()), []);
});

test("validation: every rail bites", () => {
  assert.ok(validatePart(okPart({ name: " " })).some((e) => e.includes("name")));
  assert.ok(validatePart(okPart({ voxels: [] })).some((e) => e.includes("at least one")));
  assert.ok(
    validatePart(okPart({ voxels: [{ x: PART_GRID, y: 0, z: 0, c: "#a85a42" }] })).some((e) => e.includes("bounds")),
  );
  assert.ok(
    validatePart(okPart({ voxels: [{ x: 0, y: 0, z: 0, c: "red" }] })).some((e) => e.includes("color")),
  );
  assert.ok(
    validatePart(
      okPart({
        voxels: [
          { x: 0, y: 0, z: 0, c: "#a85a42" },
          { x: 0, y: 0, z: 0, c: "#a85a42" },
        ],
      }),
    ).some((e) => e.includes("duplicate")),
  );
  const big = Array.from({ length: PART_MAX_VOXELS + 1 }, (_, i) => ({
    x: i % PART_GRID,
    y: Math.floor(i / PART_GRID) % PART_GRID,
    z: Math.floor(i / (PART_GRID * PART_GRID)),
    c: "#a85a42",
  }));
  assert.ok(validatePart(okPart({ voxels: big })).some((e) => e.includes("at most")));
  // @ts-expect-error bogus slot
  assert.ok(validatePart(okPart({ slot: "hat" })).some((e) => e.includes("slot")));
});

test("registry: save, list, remove round-trip", () => {
  const a = okPart({ name: "Cap A" });
  const b = okPart({ name: "Beard B", slot: "beard" });
  savePart(a);
  savePart(b);
  const names = listParts().map((p) => p.name);
  assert.ok(names.includes("Cap A") && names.includes("Beard B"));
  removePart(a.id);
  assert.ok(!listParts().some((p) => p.id === a.id));
  removePart(b.id);
});

test("anchors: every slot sits on the figure, voxels fit the grid", () => {
  for (const slot of Object.keys(SLOT_ANCHOR) as (keyof typeof SLOT_ANCHOR)[]) {
    const { at, voxel } = SLOT_ANCHOR[slot];
    assert.equal(at.length, 3);
    const span = voxel * PART_GRID;
    assert.ok(span > 0.2 && span < 0.4, `${slot} span ${span}`);
  }
});

test("partIdsOf: only real strings ride the recipe", () => {
  assert.deepEqual(partIdsOf(undefined), []);
  assert.deepEqual(partIdsOf({ schema: LOOK_SCHEMA }), []);
  // @ts-expect-error intentional junk in the list
  assert.deepEqual(partIdsOf({ schema: LOOK_SCHEMA, parts: ["u_1", 7, null, "u_2"] }), ["u_1", "u_2"]);
});
