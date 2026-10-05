import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Box3, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const dir = "public/art/reedwake-waterfront/";
const bytes = fs.readFileSync(dir + "reedwake-crossing.glb");
const { scene } = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
scene.updateMatrixWorld(true);
const source = JSON.parse(
  fs.readFileSync("art/verification/reedwake-waterfront/source-reopen.json", "utf8"),
);
const key = (v) => v.map((x) => Math.round(x * 10000)).join(",");
const original = new Set(source.worldYUpVertices.map(key));
const exported = new Set();
let meshes = 0,
  triangles = 0;
scene.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  const p = o.geometry.attributes.position;
  triangles += (o.geometry.index?.count ?? p.count) / 3;
  for (let i = 0; i < p.count; i++)
    exported.add(
      key(new Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).toArray()),
    );
});
assert.deepEqual(
  exported,
  original,
  "independently reopened evaluated source and actual GLTFLoader geometry agree at 0.0001 units",
);
const box = new Box3().setFromObject(scene);
const manifest = JSON.parse(fs.readFileSync(dir + "manifest.json", "utf8"));
Object.assign(manifest, {
  bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  meshes,
  triangles,
  bounds: { min: box.min.toArray(), max: box.max.toArray() },
  sourceExportUniqueVertices: exported.size,
  sourceExportTolerance: 0.0001,
});
fs.writeFileSync(dir + "manifest.json", JSON.stringify(manifest, null, 2) + "\n");
fs.writeFileSync(
  "art/verification/reedwake-waterfront/source-export-parity.json",
  JSON.stringify({ passed: true, ...manifest }, null, 2),
);
console.log(JSON.stringify(manifest));
