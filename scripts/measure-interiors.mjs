import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Box3, Vector3, Mesh, MeshStandardMaterial } from "three";
export const kinds = ["hall", "dormitory", "kitchen", "yard", "market", "forge", "tavern", "bank"];
export async function measureInteriors() {
  const assets = [];
  for (const kind of kinds) {
    const url = new URL(`../public/art/lanternwood/interior-${kind}.glb`, import.meta.url);
    const b = readFileSync(url);
    const gltf = await new GLTFLoader().parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      "",
    );
    gltf.scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(gltf.scene);
    let triangles = 0,
      vertices = 0,
      meshes = 0;
    const materials = new Set();
    gltf.scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      meshes++;
      const p = o.geometry.attributes.position;
      vertices += p.count;
      triangles += (o.geometry.index?.count ?? p.count) / 3;
      for (const n of p.array) if (!Number.isFinite(n)) throw Error("Nonfinite vertex");
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m.uuid);
        if (!(m instanceof MeshStandardMaterial) || !m.vertexColors) throw Error("Missing vertex colors");
      }
    });
    assets.push({
      kind,
      file: `interior-${kind}.glb`,
      bytes: b.length,
      meshes,
      materials: materials.size,
      vertices,
      triangles,
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
      size: bounds.getSize(new Vector3()).toArray(),
      animations: gltf.animations.length,
    });
  }
  return {
    version: 1,
    coordinates: "Y-up; local building origin; floor top 0.5; identity scale/rotation",
    assets,
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await measureInteriors();
  writeFileSync(
    new URL("../public/art/lanternwood/interiors-manifest.json", import.meta.url),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
