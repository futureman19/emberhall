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

function roofAt(kind: BuildingKind, y: number) {
  return SPECS[kind].voxels.filter((v) => v.y === y && (v.t === "dark" || v.t === "thatch"));
}

function xSpan(kind: BuildingKind, y: number) {
  const xs = roofAt(kind, y).map((v) => v.x);
  assert.ok(xs.length > 0, `${kind} roof at y=${y}`);
  return Math.max(...xs) - Math.min(...xs);
}

test("porch and homestead fuse like the hut; civic townhouse stays pyramid", () => {
  assert.equal(SPECS.hut.fuse, true);
  assert.equal(SPECS.porch.fuse, true);
  assert.equal(SPECS.homestead.fuse, true);
  assert.equal(SPECS.townhouse.fuse, undefined);
  assert.deepEqual(
    { x0: SPECS.porch.x0, x1: SPECS.porch.x1, z0: SPECS.porch.z0, z1: SPECS.porch.z1 },
    { x0: -2, x1: 2, z0: -1, z1: 1 },
  );
  assert.deepEqual(
    { x0: SPECS.homestead.x0, x1: SPECS.homestead.x1, z0: SPECS.homestead.z0, z1: SPECS.homestead.z1 },
    { x0: -3, x1: 3, z0: -3, z1: 3 },
  );
  assert.equal(xSpan("porch", 3), xSpan("porch", 4), "porch gable keeps X");
  assert.equal(xSpan("homestead", 6), xSpan("homestead", 7), "homestead gable keeps X");
  assert.ok(xSpan("townhouse", 6) > xSpan("townhouse", 7), "townhouse pyramid still insets X");
});

test("porch and homestead wear hut dress — lanterns, window boxes, roof cat", () => {
  for (const kind of ["porch", "hut", "homestead"] as const) {
    const vox = SPECS[kind].voxels;
    assert.ok(vox.some((v) => v.t === "gold" && v.z > SPECS[kind].z1), `${kind} lantern`);
    assert.ok(vox.some((v) => v.t === "glass" && v.z > SPECS[kind].z1), `${kind} lantern glass`);
    assert.ok(vox.some((v) => v.t === "soil"), `${kind} window box`);
    assert.ok(vox.some((v) => v.t === "leaf"), `${kind} box plant`);
    assert.ok(vox.some((v) => v.t === "wool" && v.y > 4), `${kind} roof cat / bunting`);
  }
  assert.ok(!SPECS.townhouse.voxels.some((v) => v.t === "soil"));
});
