import { useEffect, useState } from 'react';
import { Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, ExtrudeGeometry, Shape, type BufferGeometry, type Object3D } from 'three';
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
/** Procedural two-material weapons. Origin is the grip; caller owns disposal. */
export type ExactWeaponId = 'dagger' | 'spear' | 'war_axe' | 'mace' | 'war_hammer' | 'quarterstaff';
export function createExactWeaponGeometry(id: ExactWeaponId): { hilt: BufferGeometry; edge: BufferGeometry } {
  if (id === 'mace') return {
    hilt: new CylinderGeometry(.026, .03, .5, 8),
    edge: new SphereGeometry(.12, 8, 4).translate(0, .33, 0),
  };
  if (id === 'war_hammer') return {
    hilt: new CylinderGeometry(.028, .034, .7, 8),
    edge: new BoxGeometry(.34, .18, .16).translate(0, .45, 0),
  };
  if (id === 'quarterstaff') return {
    hilt: new CylinderGeometry(.032, .032, 1.3, 10),
    edge: new CylinderGeometry(.038, .038, .24, 10),
  };
  const length = id === 'dagger' ? 0.16 : id === 'spear' ? 1.1 : 0.62;
  const radius = id === 'dagger' ? 0.023 : 0.028;
  const hilt = new CylinderGeometry(radius, radius, length, 8);
  const blade = new Shape();
  if (id === 'war_axe') {
    blade.moveTo(-0.035, 0.20); blade.lineTo(0.08, 0.25);
    blade.lineTo(0.23, 0.14); blade.lineTo(0.27, 0.43);
    blade.lineTo(0.08, 0.49); blade.lineTo(-0.035, 0.38);
  } else {
    const base = length / 2 - 0.015;
    const tip = id === 'dagger' ? 0.34 : 0.85;
    const width = id === 'dagger' ? 0.035 : 0.06;
    blade.moveTo(-width * 0.5, base); blade.lineTo(-width, base + 0.05);
    blade.lineTo(0, tip); blade.lineTo(width, base + 0.05); blade.lineTo(width * 0.5, base);
  }
  blade.closePath();
  const edge = new ExtrudeGeometry(blade, { depth: 0.024, bevelEnabled: false });
  edge.translate(0, 0, -0.012);
  return { hilt, edge };
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
