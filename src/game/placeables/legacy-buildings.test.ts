import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BUILDING_META } from "../catalog.ts";
import { BUILD_SIZE } from "../building-size.ts";
import { SPECS } from "./legacy-buildings.ts";
import type { BuildingKind } from "../types.ts";

test("legacy specs cover every building kind and match BUILD_SIZE bounds", () => {
  assert.deepEqual(Object.keys(SPECS).sort(), Object.keys(BUILDING_META).sort());
  for (const kind of Object.keys(SPECS) as BuildingKind[]) {
    const s = SPECS[kind];
    assert.deepEqual({ x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1 }, BUILD_SIZE[kind], kind);
    assert.equal(typeof s.enterable, "boolean", kind);
    assert.ok(Array.isArray(s.voxels), kind);
    assert.ok(s.voxels.length > 0, kind);
  }
});

test("building-size derives footprints from SPECS, not a second table", () => {
  const source = readFileSync(new URL("../building-size.ts", import.meta.url), "utf8");
  assert.match(source, /from "\.\/placeables\/legacy-buildings\.ts"/);
  assert.match(source, /SPECS/);
  assert.doesNotMatch(source, /hall:\s*\{\s*x0:\s*-5/);
});
