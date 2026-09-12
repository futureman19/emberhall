import { useEffect, useState } from "react";
import { Mesh, type BufferGeometry, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const FLORA_CROPS = ["cabbage", "wheat", "garlic", "ginseng", "mandrake", "moss"] as const;
export const FLORA_HERBS = ["moss", "mandrake", "ginseng", "ash", "pearl"] as const;
export const FLORA_NAMES = [
  ...FLORA_CROPS.flatMap(id => [1, 2, 3].map(stage => `crop_${id}_${stage}`)),
  ...FLORA_HERBS.flatMap(id => ["ready", "picked"].map(state => `herb_${id}_${state}`)),
];
export const FLORA_URL = "/art/lanternwood/flora.glb";
export type FloraGeometry = Readonly<Record<string, BufferGeometry>>;
/** Complete kit or original fallback. Bake Blender ancestry before placing on soil. */
export function extractFloraGeometry(scene: Object3D): FloraGeometry {
  scene.updateMatrixWorld(true);
  const result: Record<string, BufferGeometry> = {};
  try {
    for (const name of FLORA_NAMES) {
      const mesh = scene.getObjectByName(name);
      if (!(mesh instanceof Mesh)) throw new Error(`Missing flora part: ${name}`);
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      result[name] = geometry;
      for (const key of ["position", "normal", "color"]) {
        const attribute = geometry.getAttribute(key);
        if (!attribute || !attribute.count || !Array.from(attribute.array).every(Number.isFinite)) throw new Error(`Invalid flora ${name}/${key}`);
      }
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const box = geometry.boundingBox!;
      if (box.min.y < -0.021 || box.max.y > 0.86 || Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z)) > 0.4) throw new Error(`Flora outside bed: ${name}`);
    }
    return Object.freeze(result);
  } catch (error) {
    Object.values(result).forEach(g => g.dispose());
    throw error;
  }
}
let cached: FloraGeometry | null = null;
let pending: Promise<FloraGeometry> | undefined;
export function useFloraGeometry() {
  const [geometry, setGeometry] = useState(cached);
  useEffect(() => {
    let active = true;
    pending ??= new GLTFLoader().loadAsync(FLORA_URL).then(({ scene }) => {
      try {
        cached = extractFloraGeometry(scene);
        return cached;
      } finally {
        scene.traverse(node => {
          if (!(node instanceof Mesh)) return;
          node.geometry.dispose();
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
        });
      }
    });
    void pending.then(value => { if (active) setGeometry(value); }).catch(() => {
      // The existing primitive presentation remains visible on failure.
    });
    return () => { active = false; };
  }, []);
  return geometry;
}
