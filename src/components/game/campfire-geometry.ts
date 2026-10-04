import { useEffect, useState } from 'react';
import { Mesh, type BufferGeometry, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const CAMPFIRE_BOUNDS = {"campfire_stone": [0.18, 0.18, 0.18], "campfire_log": [0.1, 0.5, 0.1]} as const;
export type CampfirePart = keyof typeof CAMPFIRE_BOUNDS;
type Parts = Record<CampfirePart, BufferGeometry>;
export function extractCampfireGeometry(scene: Object3D): Parts {
  scene.updateMatrixWorld(true);
  const result: Partial<Parts> = {};
  try {
    scene.traverse(node => {
      if (!(node instanceof Mesh) || !(node.name in CAMPFIRE_BOUNDS)) return;
      const key = node.name as CampfirePart;
      if (result[key]) throw new Error('Duplicate tool part');
      const g = node.geometry.clone().applyMatrix4(node.matrixWorld);
      result[key] = g;
      const positions = g.attributes.position;
      if (!positions || !Array.from(positions.array).every(Number.isFinite)) throw new Error('Invalid tool vertices');
      g.computeBoundingBox();
      for (let i = 0; i < 3; i++) {
        const half = CAMPFIRE_BOUNDS[key][i] / 2 + 1e-5;
        if (g.boundingBox!.min.getComponent(i) < -half || g.boundingBox!.max.getComponent(i) > half) throw new Error('Tool exceeds original envelope');
      }
      g.userData.campfirePart = key;
    });
    if (Object.keys(result).length !== 2) throw new Error('Incomplete tool kit');
    return result as Parts;
  } catch (error) {
    Object.values(result).forEach(g => g.dispose());
    throw error;
  }
}
let cache: Parts | null = null;
let pending: Promise<Parts> | null = null;
export function useCampfireGeometry(part: CampfirePart) {
  const [parts, setParts] = useState<Parts | null>(() => cache);
  useEffect(() => {
    let active = true;
    pending ??= new GLTFLoader().loadAsync('/art/lanternwood/campfire.glb').then(({ scene }) => {
      try { cache = extractCampfireGeometry(scene); return cache; }
      finally { scene.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } }); }
    });
    void pending.then(value => { if (active) setParts(value); }).catch(() => { /* Optional: retain primitives; cache failure to avoid request storms. */ });
    return () => { active = false; };
  }, []);
  return parts?.[part] ?? null;
}
