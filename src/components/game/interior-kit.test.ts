import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { COURT } from "../../game/atlas.ts";
import {
  INTERIOR_KINDS,
  INTERIOR_COVERAGE,
  interiorKitName,
  interiorVoxelCenter,
  replaceInteriorVoxel,
} from "./interior-kit.ts";
test("worldwide routes cover exact approved kinds; no farm/sign/keep/housing replacements", () => {
  assert.equal(Object.keys(INTERIOR_COVERAGE).length, 11);
  for (const k of INTERIOR_KINDS) {
    assert.equal(interiorKitName(k, COURT.tx, COURT.ty), `interior-${k}`);
    assert.equal(interiorKitName(k, COURT.tx + 19, COURT.ty), `interior-${k}`);
    assert.equal(interiorKitName(k, NaN, COURT.ty), null);
  }
  for (const k of ["farm", "notice", "board", "keep", "hut", "townhouse"])
    assert.equal(interiorKitName(k, COURT.tx, COURT.ty), null);
  assert.equal(interiorVoxelCenter(-1), -0.25);
  assert.equal(interiorVoxelCenter(0), 0.25);
  assert.equal(interiorVoxelCenter(1), 0.75);
});
test("predicate verified against actual original generator: exact furniture counts, no floors/walls/door cells", () => {
  const source = readFileSync(new URL("./building-meshes.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function put("),
    end = source.indexOf("function occupant(");
  const js = ts.transpile(source.slice(start, end) + "\nexport {SPECS};", {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  });
  const exports: Record<string, any> = {};
  new Function("exports", js)(exports);
  const expected = {
    hall: 7,
    dormitory: 7,
    kitchen: 9,
    tavern: 9,
    bank: 8,
    market: 16,
    forge: 3,
    yard: 2,
    farm: 0,
    notice: 0,
    board: 0,
  };
  for (const [kind, count] of Object.entries(expected)) {
    const vox = exports.SPECS[kind].voxels;
    const replaced = vox.filter((v: any) => replaceInteriorVoxel(kind, v));
    assert.equal(replaced.length, count, kind);
    for (const v of replaced) {
      assert(v.y > 0);
      assert(!v.cut);
      assert(!replaceInteriorVoxel(kind, { ...v, t: "not-material" }));
    }
    for (const v of vox.filter((v: any) => v.y === 0 || v.cut))
      assert(!replaceInteriorVoxel(kind, v));
  }
});
