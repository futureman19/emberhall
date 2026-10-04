import { useEffect, useState } from 'react';
import { Mesh, type BufferGeometry, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const OFFHAND_BOUNDS = {"bow_limb": [0.11, 0.62, 0.04], "bow_string": [0.11, 0.62, 0.04], "torch_handle": [0.045, 0.36, 0.045], "torch_ember": [0.08, 0.1, 0.08], "shield_face": [0.28, 0.38, 0.06], "shield_boss": [0.1, 0.1, 0.04], "heater_face": [0.28, 0.38, 0.06], "heater_boss": [0.1, 0.1, 0.04]} as const;
export type OffhandPart = keyof typeof OFFHAND_BOUNDS;
type Parts = Record<OffhandPart, BufferGeometry>;
export function extractOffhandGeometry(scene: Object3D): Parts {
  scene.updateMatrixWorld(true);
  const result: Partial<Parts> = {};
  try {
    scene.traverse(node => {
      if (!(node instanceof Mesh) || !(node.name in OFFHAND_BOUNDS)) return;
      const key = node.name as OffhandPart;
      if (result[key]) throw new Error('Duplicate tool part');
      const g = node.geometry.clone().applyMatrix4(node.matrixWorld);
      result[key] = g;
      const positions = g.attributes.position;
      if (!positions || !Array.from(positions.array).every(Number.isFinite)) throw new Error('Invalid tool vertices');
      g.computeBoundingBox();
      for (let i = 0; i < 3; i++) {
        const half = OFFHAND_BOUNDS[key][i] / 2 + 1e-5;
        if (g.boundingBox!.min.getComponent(i) < -half || g.boundingBox!.max.getComponent(i) > half) throw new Error('Tool exceeds original envelope');
      }
      // Bake authored combined-envelope center into each original mesh-local anchor.
      if (key === 'bow_limb') g.translate(.035, 0, 0);
      if (key === 'bow_string') g.translate(-.045, 0, 0);
      g.computeBoundingBox();
      g.computeBoundingSphere();
      g.userData.offhandPart = key;
    });
    if (Object.keys(result).length !== 8) throw new Error('Incomplete tool kit');
    return result as Parts;
  } catch (error) {
    Object.values(result).forEach(g => g.dispose());
    throw error;
  }
}
let cache: Parts | null = null;
let pending: Promise<Parts> | null = null;
export function useOffhandGeometry(part: OffhandPart) {
  const [parts, setParts] = useState<Parts | null>(() => cache);
  useEffect(() => {
    let active = true;
    pending ??= new GLTFLoader().loadAsync('/art/lanternwood/offhands.glb').then(({ scene }) => {
      try { cache = extractOffhandGeometry(scene); return cache; }
      finally { scene.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } }); }
    });
    void pending.then(value => { if (active) setParts(value); }).catch(() => { /* Optional: retain primitives; cache failure to avoid request storms. */ });
    return () => { active = false; };
  }, []);
  return parts?.[part] ?? null;
}
