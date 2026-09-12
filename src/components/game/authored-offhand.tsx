import type { ReactNode } from 'react';
import { useOffhandGeometry, type OffhandPart } from './offhand-geometry.ts';

/** Geometry-only attachment: original mesh material, grip and animations survive. */
export function AuthoredOffhandGeometry({ part, children }: { part: OffhandPart; children: ReactNode }) {
  const geometry = useOffhandGeometry(part);
  return geometry ? <primitive object={geometry} attach="geometry" dispose={null} /> : children;
}
