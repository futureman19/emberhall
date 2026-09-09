import { useEffect, useState } from 'react';
import { Mesh, type BufferGeometry, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const TOOL_BOUNDS = {
  hatchet_handle: [.045, .42, .045], hatchet_head: [.2, .1, .07],
  pick_handle: [.04, .44, .04], pick_head: [.28, .07, .06],
  hoe_handle: [.04, .44, .04], hoe_head: [.22, .05, .12],
  fishing_rod_handle: [.064, .9, .064], fishing_rod_head: [.168, .168, .028],
} as const;
export type ToolPart = keyof typeof TOOL_BOUNDS;
type Parts = Record<ToolPart, BufferGeometry>;
export function extractToolGeometry(scene: Object3D): Parts {
  scene.updateMatrixWorld(true);
  const result: Partial<Parts> = {};
  try {
    scene.traverse(node => {
      if (!(node instanceof Mesh) || !(node.name in TOOL_BOUNDS)) return;
      const key = node.name as ToolPart;
      if (result[key]) throw new Error('Duplicate tool part');
      const g = node.geometry.clone().applyMatrix4(node.matrixWorld);
      result[key] = g;
      const positions = g.attributes.position;
      if (!positions || !Array.from(positions.array).every(Number.isFinite)) throw new Error('Invalid tool vertices');
      g.computeBoundingBox();
      for (let i = 0; i < 3; i++) {
        const half = TOOL_BOUNDS[key][i] / 2 + 1e-5;
        if (g.boundingBox!.min.getComponent(i) < -half || g.boundingBox!.max.getComponent(i) > half) throw new Error('Tool exceeds original envelope');
      }
      g.userData.toolPart = key;
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
export function useToolGeometry(part: ToolPart) {
  const [parts, setParts] = useState<Parts | null>(() => cache);
  useEffect(() => {
    let active = true;
    pending ??= new GLTFLoader().loadAsync('/art/lanternwood/tools.glb').then(({ scene }) => {
      try { cache = extractToolGeometry(scene); return cache; }
      finally { scene.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } }); }
    });
    void pending.then(value => { if (active) setParts(value); }).catch(() => { /* Optional: retain primitives; cache failure to avoid request storms. */ });
    return () => { active = false; };
  }, []);
  return parts?.[part] ?? null;
}
