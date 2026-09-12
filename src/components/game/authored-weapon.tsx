import type { ReactNode } from 'react';
import { useWeaponGeometry, type WeaponPart } from './weapon-geometry.ts';

/** Geometry-only attachment: original mesh material, grip and animations survive. */
export function AuthoredWeaponGeometry({ part, children }: { part: WeaponPart; children: ReactNode }) {
  const geometry = useWeaponGeometry(part);
  return geometry ? <primitive object={geometry} attach="geometry" dispose={null} /> : children;
}
