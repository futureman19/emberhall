import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Box3, Mesh, Raycaster, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

for (const kit of ["kitchen", "tavern", "market"]) {
  test(`${kit}: measured exterior geometry and original entrance contract`, async () => {
    const bytes = await readFile(
      new URL(`../../../public/art/lanternwood/${kit}.glb`, import.meta.url),
    );
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(scene);
    assert.ok(bytes.length <= 600000);
    assert.ok(Math.abs(bounds.min.y) < 0.001);
    assert.ok(bounds.max.y >= 2 && bounds.max.y <= 4.7);
    assert.ok(bounds.min.x >= (kit === "kitchen" ? -1.901 : -2.401));
    assert.ok(bounds.max.x <= (kit === "kitchen" ? 2.401 : 2.901));
    assert.ok(bounds.min.z >= -1.901);
    assert.ok(bounds.max.z <= (kit === "kitchen" ? 2.851 : 2.401));
    const materials = new Set();
    const palette = new Set<string>();
    let emissiveTriangles = 0;
    let triangles = 0;
    scene.traverse((object) => {
      assert.ok(!("isLight" in object));
      if (!(object instanceof Mesh)) return;
      assert.ok(
        object.getWorldPosition(new Vector3()).length() < 0.001,
        "ground anchor, no lineup transform",
      );
      const position = object.geometry.getAttribute("position");
      for (const value of position.array) assert.ok(Number.isFinite(value));
      triangles += (object.geometry.index?.count ?? position.count) / 3;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material.uuid);
        assert.ok(material.name.length > 0);
        assert.ok(!("map" in material) || !material.map);
        const color = object.geometry.getAttribute("color");
        assert.ok(color, "glTF COLOR_0 exported");
        assert.ok(material.vertexColors, "runtime consumes COLOR_0");
        for (let i = 0; i < color.count; i++) {
          palette.add(material.color.toArray().map((v: number, k: number) =>
            (v * color.getComponent(i, k)).toFixed(4)).join(","));
        }
        assert.ok(Math.abs(material.roughness - 0.86) < 1e-6);
        if (material.emissive.toArray().some((v: number) => v > 0)) {
          emissiveTriangles += (object.geometry.index?.count ?? position.count) / 3;
          const expected = [1, 0.38, 0.065];
          material.emissive.toArray().forEach((v: number, k: number) =>
            assert.ok(Math.abs(v * material.emissiveIntensity - expected[k] * 0.55) < 1e-7));
        }
      }
    });
    assert.ok(triangles > 100 && triangles <= 12000);
    assert.ok(materials.size >= 1 && materials.size <= 2);
    assert.ok(palette.size >= 4, "distinct effective linear palette retained");
    assert.equal(emissiveTriangles, kit === "kitchen" ? 26 : kit === "tavern" ? 39 : 0);
    const xs =
      kit === "kitchen"
        ? [-0.1, 0.25, 0.6]
        : kit === "tavern"
          ? [-0.55, -0.25, 0.05]
          : [-0.8, 0, 0.8];
    for (const x of xs) {
      const ray = new Raycaster(new Vector3(x, 1, 2.5), new Vector3(0, 0, -1), 0, 1.1);
      assert.equal(ray.intersectObject(scene, true).length, 0, `${kit} clear entrance x=${x}`);
    }
    const manifest = JSON.parse(
      await readFile(
        new URL("../../../public/art/lanternwood/hospitality-manifest.json", import.meta.url),
        "utf8",
      ),
    )[kit];
    assert.equal(manifest.bytes, bytes.length);
    assert.equal(manifest.triangles, triangles);
    assert.equal(manifest.materials, materials.size);
    assert.ok(manifest.parts.length > 15);
    assert.equal(manifest.source.editable, true);
    assert.deepEqual(manifest.bounds.min, bounds.min.toArray());
    assert.deepEqual(manifest.bounds.max, bounds.max.toArray());
  });
}
