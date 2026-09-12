import { useEffect, useState } from 'react';
import { Mesh, type BufferGeometry, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const DEATH_BOUNDS = {"death_tunic": [0.4, 0.72, 0.26], "death_head": [0.28, 0.26, 0.24], "death_shroud": [0.48, 0.78, 0.1]} as const;
export type DeathPart = keyof typeof DEATH_BOUNDS;
type Parts = Record<DeathPart, BufferGeometry>;
export function extractDeathGeometry(scene: Object3D): Parts {
  scene.updateMatrixWorld(true);
  const result: Partial<Parts> = {};
  try {
    scene.traverse(node => {
      if (!(node instanceof Mesh) || !(node.name in DEATH_BOUNDS)) return;
      const key = node.name as DeathPart;
      if (result[key]) throw new Error('Duplicate tool part');
      const g = node.geometry.clone().applyMatrix4(node.matrixWorld);
      result[key] = g;
      const positions = g.attributes.position;
      if (!positions || !Array.from(positions.array).every(Number.isFinite)) throw new Error('Invalid tool vertices');
      g.computeBoundingBox();
      for (let i = 0; i < 3; i++) {
        const half = DEATH_BOUNDS[key][i] / 2 + 1e-5;
        if (g.boundingBox!.min.getComponent(i) < -half || g.boundingBox!.max.getComponent(i) > half) throw new Error('Tool exceeds original envelope');
      }
      g.userData.deathPart = key;
    });
    if (Object.keys(result).length !== 3) throw new Error('Incomplete tool kit');
    return result as Parts;
  } catch (error) {
    Object.values(result).forEach(g => g.dispose());
    throw error;
  }
}
let cache: Parts | null = null;
let pending: Promise<Parts> | null = null;
export function useDeathGeometry() {
  const [parts, setParts] = useState<Parts | null>(() => cache);
  useEffect(() => {
    let active = true;
    pending ??= new GLTFLoader().loadAsync('/art/lanternwood/death.glb').then(({ scene }) => {
      try { cache = extractDeathGeometry(scene); return cache; }
      finally { scene.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } }); }
    });
    void pending.then(value => { if (active) setParts(value); }).catch(() => { /* Optional: retain primitives; cache failure to avoid request storms. */ });
    return () => { active = false; };
  }, []);
  return parts;
}
