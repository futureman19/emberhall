import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { measureInteriors } from "../../../scripts/measure-interiors.mjs";
test("all eight real GLBs load, finite Y-up floor-grounded vertex palettes within original occupied footprints", async () => {
  const report = await measureInteriors();
  assert.equal(report.assets.length, 8);
  for (const a of report.assets) {
    assert.equal(a.materials, 1);
    assert.equal(a.meshes, 1);
    assert.equal(a.animations, 0);
    assert(a.triangles > 50);
    assert(a.triangles < 5000);
    assert(Math.abs(a.min[1] - 0.5) < 0.00001, `${a.kind} floor ${a.min[1]}`);
    assert(a.min[2] >= -0.99999 - 0.00002 && a.max[2] <= 1.00001, `${a.kind} corridor`);
    const xbounds =
      a.kind === "tavern"
        ? [-0.5, 2]
        : a.kind === "kitchen"
          ? [-1, 1]
          : a.kind === "market"
            ? [-1, 1.5]
            : a.kind === "forge"
              ? [-0.5, 0.5]
              : a.kind === "yard"
                ? [0, 0.5]
                : [-0.5, 1];
    assert(
      a.min[0] >= xbounds[0] - 0.0001 && a.max[0] <= xbounds[1] + 0.0001,
      `${a.kind} footprint`,
    );
  }
  const saved = JSON.parse(
    readFileSync(
      new URL("../../../public/art/lanternwood/interiors-manifest.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(report, saved);
});
