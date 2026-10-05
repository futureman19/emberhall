import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Box3, Vector3, Raycaster } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
test("bridge GLB has finite nondegenerate geometry, a seated deck and bounded palette", async () => {
  const file = "public/art/river-bridge/reedwake-bridge.glb";
  assert.ok(fs.existsSync(file), "authored bridge GLB exists");
  const b = fs.readFileSync(file);
  const { scene } = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    "",
  );
  scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(scene);
  assert.ok(Math.abs(box.min.y) < 1e-5);
  assert.ok(box.max.x <= 5.51 && box.min.x >= -5.51);
  const materials = new Set();
  let triangles = 0;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    materials.add(o.material);
    const p = o.geometry.attributes.position,
      idx = o.geometry.index;
    for (let i = 0; i < (idx?.count ?? p.count); i += 3) {
      const v = [0, 1, 2].map((j) =>
        new Vector3()
          .fromBufferAttribute(p, idx ? idx.getX(i + j) : i + j)
          .applyMatrix4(o.matrixWorld),
      );
      assert.ok(v.flatMap((v) => v.toArray()).every(Number.isFinite));
      assert.ok(v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).length() > 1e-10);
      triangles++;
    }
  });
  assert.ok(materials.size <= 4);
  assert.ok(triangles < 12000);
  for (const x of [-5, -4, 4, 5]) {
    const hit = new Raycaster(new Vector3(x, 3, 0), new Vector3(0, -1, 0)).intersectObject(
      scene,
      true,
    )[0];
    assert.ok(
      hit && Math.abs(hit.point.y - (0.6 - (Math.abs(x) - 3.5) * 0.2)) < 1e-5,
      `approach ${x}`,
    );
  }
  for (let i = 0; i < 20; i++)
    for (const z of [-1, 0, 1]) {
      const x = -3.5 + (i + 0.5) * 0.35;
      const hit = new Raycaster(new Vector3(x, 3, z), new Vector3(0, -1, 0)).intersectObject(
        scene,
        true,
      )[0];
      assert.ok(hit && Math.abs(hit.point.y - 0.6) < 1e-5, `deck ${x},${z}`);
    }
});
