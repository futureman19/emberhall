import type { ReactNode } from 'react';
import { useCampfireGeometry, type CampfirePart } from './campfire-geometry.ts';

/** Geometry-only attachment: original mesh material, grip and animations survive. */
export function AuthoredCampfireGeometry({ part, children }: { part: CampfirePart; children: ReactNode }) {
  const geometry = useCampfireGeometry(part);
  return geometry ? <primitive object={geometry} attach="geometry" dispose={null} /> : children;
}
