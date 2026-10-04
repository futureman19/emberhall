import { useEffect, useState } from 'react';
import { Mesh, type BufferGeometry, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const WEAPON_BOUNDS = {"knife_handle": [0.04, 0.16, 0.04], "knife_blade": [0.05, 0.22, 0.02], "sword_handle": [0.045, 0.22, 0.045], "sword_guard": [0.16, 0.04, 0.04], "sword_blade": [0.055, 0.46, 0.02], "club_handle": [0.055, 0.5, 0.055], "club_head": [0.12, 0.16, 0.12], "mace_handle": [0.045, 0.42, 0.045], "mace_head": [0.16, 0.16, 0.16], "staff_handle": [0.04, 0.9, 0.04], "staff_head": [0.1, 0.1, 0.1]} as const;
export type WeaponPart = keyof typeof WEAPON_BOUNDS;
type Parts = Record<WeaponPart, BufferGeometry>;
export function extractWeaponGeometry(scene: Object3D): Parts {
  scene.updateMatrixWorld(true);
  const result: Partial<Parts> = {};
  try {
    scene.traverse(node => {
      if (!(node instanceof Mesh) || !(node.name in WEAPON_BOUNDS)) return;
      const key = node.name as WeaponPart;
      if (result[key]) throw new Error('Duplicate tool part');
      const g = node.geometry.clone().applyMatrix4(node.matrixWorld);
      result[key] = g;
      const positions = g.attributes.position;
      if (!positions || !Array.from(positions.array).every(Number.isFinite)) throw new Error('Invalid tool vertices');
      g.computeBoundingBox();
      for (let i = 0; i < 3; i++) {
        const half = WEAPON_BOUNDS[key][i] / 2 + 1e-5;
        if (g.boundingBox!.min.getComponent(i) < -half || g.boundingBox!.max.getComponent(i) > half) throw new Error('Tool exceeds original envelope');
      }
      g.userData.weaponPart = key;
    });
    if (Object.keys(result).length !== 11) throw new Error('Incomplete tool kit');
    return result as Parts;
  } catch (error) {
    Object.values(result).forEach(g => g.dispose());
    throw error;
  }
}
let cache: Parts | null = null;
let pending: Promise<Parts> | null = null;
export function useWeaponGeometry(part: WeaponPart) {
  const [parts, setParts] = useState<Parts | null>(() => cache);
  useEffect(() => {
    let active = true;
    pending ??= new GLTFLoader().loadAsync('/art/lanternwood/weapons.glb').then(({ scene }) => {
      try { cache = extractWeaponGeometry(scene); return cache; }
      finally { scene.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } }); }
    });
    void pending.then(value => { if (active) setParts(value); }).catch(() => { /* Optional: retain primitives; cache failure to avoid request storms. */ });
    return () => { active = false; };
  }, []);
  return parts?.[part] ?? null;
}
