import { useEffect, useState } from "react";
import { Mesh, type BufferGeometry, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const FIELD_PROP_NAMES = ["field_rock", "field_pouch"];
export const FIELD_PROP_URL = "/art/lanternwood/field-props.glb";
export type FieldPropGeometry = Readonly<Record<string, BufferGeometry>>;
/** Complete kit or original fallback. Bake Blender ancestry before placing on soil. */
export function extractFieldPropGeometry(scene: Object3D): FieldPropGeometry {
  scene.updateMatrixWorld(true);
  const result: Record<string, BufferGeometry> = {};
  try {
    for (const name of FIELD_PROP_NAMES) {
      const mesh = scene.getObjectByName(name);
      if (!(mesh instanceof Mesh)) throw new Error(`Missing field-props part: ${name}`);
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      result[name] = geometry;
      for (const key of ["position", "normal", "color"]) {
        const attribute = geometry.getAttribute(key);
        if (!attribute || !attribute.count || !Array.from(attribute.array).every(Number.isFinite)) throw new Error(`Invalid field-props ${name}/${key}`);
      }
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const box = geometry.boundingBox!;
      if (box.min.y < (name === "field_rock" ? -0.231 : -0.001) || box.max.y > 0.43 || Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z)) > 0.421) throw new Error(`FieldProp outside bed: ${name}`);
    }
    return Object.freeze(result);
  } catch (error) {
    Object.values(result).forEach(g => g.dispose());
    throw error;
  }
}
let cached: FieldPropGeometry | null = null;
let pending: Promise<FieldPropGeometry> | undefined;
export function useFieldPropGeometry() {
  const [geometry, setGeometry] = useState(cached);
  useEffect(() => {
    let active = true;
    pending ??= new GLTFLoader().loadAsync(FIELD_PROP_URL).then(({ scene }) => {
      try {
        cached = extractFieldPropGeometry(scene);
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
