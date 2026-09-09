import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Box3, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

for (const kit of ["dormitory", "yard", "farm"]) {
  test(`${kit}: actual commons geometry, palette and retained-space contract`, async () => {
    const bytes = await readFile(new URL(`../../../public/art/lanternwood/${kit}.glb`, import.meta.url));
    const { scene, animations } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(scene);
    assert.ok(bytes.length <= 600000);
    assert.ok(Math.abs(bounds.min.y) < 0.001);
    assert.ok(bounds.max.y < 4 && bounds.max.y > 0.5);
    assert.ok(bounds.min.x > -3.4 && bounds.max.x < 3.4);
    assert.ok(bounds.min.z > -3.5 && bounds.max.z < 2.8);
    assert.equal(animations.length, 0);
    const materials = new Set<string>(), palette = new Set<string>();
    let triangles = 0, vertices = 0;
    scene.traverse((object) => {
      assert.ok(!("isLight" in object));
      if (!(object instanceof Mesh)) return;
      assert.ok(object.getWorldPosition(new Vector3()).length() < 0.001);
      const p = object.geometry.getAttribute("position"), c = object.geometry.getAttribute("color");
      assert.ok(c);
      for (const v of p.array) assert.ok(Number.isFinite(v));
      vertices += p.count;
      triangles += (object.geometry.index?.count ?? p.count) / 3;
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) {
        assert.ok(m instanceof MeshStandardMaterial);
        materials.add(m.uuid);
        assert.ok(m.vertexColors && !m.map);
        for (let i = 0; i < c.count; i++) palette.add(m.color.toArray().map((v, k) => (v * c.getComponent(i, k)).toFixed(4)).join(","));
      }
    });
    assert.ok(triangles > 100 && triangles <= 12000);
    assert.ok(materials.size >= 1 && materials.size <= 2);
    assert.ok(palette.size >= 4);
    for (const x of kit === "dormitory" ? [-0.35, 0, 0.35] : [-0.35, 0.25, 0.75]) {
      for (const y of [0.15, 0.6, 0.9]) {
        const ray = new Raycaster(new Vector3(x, y, kit === "dormitory" ? 2 : 2.8), new Vector3(0, 0, -1), 0, kit === "dormitory" ? 0.8 : 1.1);
        assert.equal(ray.intersectObject(scene, true).length, 0, `clear front x=${x}, y=${y}`);
      }
    }
    if (kit === "yard") assert.equal(new Raycaster(new Vector3(0, 5, 0), new Vector3(0, -1, 0)).intersectObject(scene, true).length, 0, "retained central stone only");
    if (kit === "farm") {
      for (const [x, z] of [[-4,-4],[0,-4],[4,-4],[-4,0],[4,0],[-4,4],[0,4],[4,4]]) {
        for (const dx of [-0.45, -0.25, -0.05]) for (const dz of [-0.45, -0.25, -0.05]) {
          assert.equal(new Raycaster(new Vector3(x * 0.5 + dx, 5, z * 0.5 + dz), new Vector3(0, -1, 0)).intersectObject(scene, true).length, 0, "original soil bed remains uncovered");
        }
      }
    }
    const manifest = JSON.parse(await readFile(new URL("../../../public/art/lanternwood/commons-manifest.json", import.meta.url), "utf8"))[kit];
    assert.equal(manifest.bytes, bytes.length);
    assert.equal(manifest.triangles, triangles);
    assert.equal(manifest.vertices, vertices);
    assert.equal(manifest.materials, materials.size);
    assert.deepEqual(manifest.bounds, { min: bounds.min.toArray(), max: bounds.max.toArray() });
    assert.ok(manifest.parts.length > 15 && manifest.source.editable);
    assert.equal(manifest.noLights, true);
    assert.equal(manifest.roofNormals.upward, true);
  });
}
