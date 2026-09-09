import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { Box3, Mesh, Matrix3, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
const base = new URL("../public/art/lanternwood/", import.meta.url);
const prior = new URL("../art/verification/hospitality/pre-batching/", import.meta.url);
const manifestURL = new URL("hospitality-manifest.json", base);
const manifest = JSON.parse(await readFile(manifestURL, "utf8"));
// FLOAT_COLOR glTF export may use normalized unsigned shorts: max error 1/65535.
const tolerance = { position: 1e-6, normal: 1e-6, color: 1 / 65535 + 1e-7, emission: 1e-7 };
async function measure(url) {
  const data = await readFile(url);
  const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), "");
  gltf.scene.updateMatrixWorld(true);
  const materials = new Set(), geometries = new Set(), palette = new Set(), records = new Map();
  let triangles = 0, meshes = 0, vertices = 0, coloredMeshes = 0, emissiveTriangles = 0;
  gltf.scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    assert.ok(!Array.isArray(object.material), "Exporter emits one material per primitive");
    meshes++; geometries.add(object.geometry.uuid);
    const g = object.geometry, m = object.material, p = g.getAttribute("position"), n = g.getAttribute("normal"), c = g.getAttribute("color");
    materials.add(m.uuid); vertices += p.count; if (c && m.vertexColors) coloredMeshes++;
    const normalMatrix = new Matrix3().getNormalMatrix(object.matrixWorld);
    const emission = m.emissive.toArray().map(v => v * m.emissiveIntensity);
    for (let i = 0; i < (g.index?.count ?? p.count); i += 3) {
      triangles++; if (emission.some(v => v > 0)) emissiveTriangles++;
      let corners = [];
      for (let j = 0; j < 3; j++) {
        const index = g.index ? g.index.getX(i + j) : i + j;
        const position = new Vector3().fromBufferAttribute(p, index).applyMatrix4(object.matrixWorld).toArray();
        const normal = new Vector3().fromBufferAttribute(n, index).applyNormalMatrix(normalMatrix).toArray();
        const color = m.color.toArray().map((v, k) => v * (c && m.vertexColors ? c.getComponent(index, k) : 1));
        palette.add(color.map(v => v.toFixed(4)).join(","));
        const values = [...position, ...normal, ...color, ...emission, m.roughness, m.metalness, m.opacity];
        assert.ok(values.every(Number.isFinite));
        corners.push(values);
      }
      // Canonical cyclic rotation preserves triangle winding, ignores primitive order.
      const keys = corners.map(v => v.slice(0, 6).map(x => Math.round(x * 1e5)).join(","));
      const start = keys.indexOf([...keys].sort()[0]);
      corners = [corners[start], corners[(start + 1) % 3], corners[(start + 2) % 3]];
      const key = [keys[start], keys[(start + 1) % 3], keys[(start + 2) % 3]].join("|");
      const bucket = records.get(key) ?? []; bucket.push(corners); records.set(key, bucket);
    }
  });
  const bounds = new Box3().setFromObject(gltf.scene);
  return { bytes: data.length, triangles, vertices, meshes, geometries: geometries.size, materials: materials.size, coloredMeshes, paletteColors: palette.size, emissiveTriangles, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, records };
}
const comparisons = {};
for (const kit of ["kitchen", "tavern", "market"]) {
  const old = await measure(new URL(`${kit}.glb`, prior));
  const current = await measure(new URL(`${kit}.glb`, base));
  assert.equal(current.triangles, old.triangles);
  assert.deepEqual(current.bounds, old.bounds);
  assert.equal(current.emissiveTriangles, old.emissiveTriangles);
  assert.ok(current.materials >= 1 && current.materials <= 2);
  assert.ok(current.coloredMeshes > 0 && current.paletteColors >= 4);
  const maxError = { position: 0, normal: 0, color: 0, emission: 0, surface: 0 };
  for (const [key, triangles] of old.records) {
    const candidates = current.records.get(key);
    assert.equal(candidates?.length, triangles.length, `${kit} oriented geometry multiset mismatch`);
    // Overlapping triangles must match all attributes, not just position.
    for (const triangle of triangles) {
      const match = candidates.findIndex(candidate => triangle.every((corner, j) => corner.every((v, k) => Math.abs(v - candidate[j][k]) <= (k < 3 ? tolerance.position : k < 6 ? tolerance.normal : k < 9 ? tolerance.color : tolerance.emission))));
      assert.ok(match >= 0, `${kit} effective appearance mismatch ${key}`);
      const candidate = candidates.splice(match, 1)[0];
      triangle.forEach((corner, j) => corner.forEach((v, k) => { const field = k < 3 ? "position" : k < 6 ? "normal" : k < 9 ? "color" : k < 12 ? "emission" : "surface"; maxError[field] = Math.max(maxError[field], Math.abs(v - candidate[j][k])); }));
    }
  }
  assert.ok([...current.records.values()].every(v => v.length === 0));
  delete old.records; delete current.records;
  comparisons[kit] = { old, current, maxError, tolerance, equivalent: true };
  Object.assign(manifest[kit], current, { measurement: "Actual GLTFLoader world transforms; paired oriented triangle multiset, normals, effective linear colors, emission and surface parameters verified", batchingVerification: { maxError, tolerance, equivalent: true } });
  console.log(JSON.stringify({ kit, ...comparisons[kit] }));
}
await writeFile(manifestURL, JSON.stringify(manifest, null, 2) + "\n");
await writeFile(new URL("comparison.json", prior), JSON.stringify(comparisons, null, 2) + "\n");
