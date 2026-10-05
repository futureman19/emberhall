import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Vector3, Raycaster } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
async function load(file) {
  const b = fs.readFileSync(file);
  const { scene } = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    "",
  );
  scene.updateMatrixWorld(true);
  return scene;
}
test("game ferry is a presentation-free derivative with submerged keel and seated bank props", async () => {
  const file = "public/art/reedwake-waterfront/reedwake-crossing.glb";
  assert.ok(fs.existsSync(file), "game-only derivative exists");
  const scene = await load(file);
  const names = [];
  scene.traverse((o) => names.push(o.name));
  assert.ok(!names.some((n) => /Presentation|Static_water|Wet_shoreline|Bank_moss/.test(n)));
  const manifest = JSON.parse(fs.readFileSync("public/art/reedwake-waterfront/manifest.json"));
  assert.ok(manifest.removed.length >= 36);
  assert.ok(
    manifest.parts["stranded-ferry"].min[1] < 0.6 && manifest.parts["stranded-ferry"].max[1] > 0.6,
  );
  assert.ok(manifest.parts["stranded-ferry"].min[0] + 955 >= 950.5);
  assert.ok(manifest.parts["stranded-ferry"].max[0] + 955 <= 953.5);
  for (const id of ["old-sign", "hauling-winch", "bank-cargo", "bank-bollards"])
    assert.ok(Math.abs(manifest.parts[id].min[1] - 0.8) < 1e-5, id);
});
test("approach earth carries a feathered vertex palette rather than a uniform slab", async () => {
  const scene = await load("public/art/river-bridge/reedwake-bridge.glb");
  const mesh = scene.getObjectByName("Bridge_Warm_moss_stone");
  assert.ok(mesh?.geometry.attributes.color, "authored bank vertex palette");
  const colors = mesh.geometry.attributes.color;
  const shades = new Set(
    Array.from({ length: colors.count }, (_, i) =>
      [colors.getX(i), colors.getY(i), colors.getZ(i)].join(","),
    ),
  );
  assert.ok(shades.size > 8);
});

test("bridge approach keeps slope while feathered skirts meet the bank", async () => {
  const scene = await load("public/art/river-bridge/reedwake-bridge.glb");
  for (const side of [-1, 1]) {
    const hit = new Raycaster(
      new Vector3(side * 4.4, 3, 1.8),
      new Vector3(0, -1, 0),
    ).intersectObject(scene, true)[0];
    assert.ok(
      hit && hit.point.y > 0.16 && hit.point.y < 0.42,
      "sloping shoulder beyond rectangular old ramp",
    );
  }
});
