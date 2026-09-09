import type { ReactNode } from 'react';
import { useToolGeometry, type ToolPart } from './tool-geometry.ts';

/** Geometry-only attachment: original mesh material, grip and animations survive. */
export function AuthoredToolGeometry({ part, children }: { part: ToolPart; children: ReactNode }) {
  const geometry = useToolGeometry(part);
  return geometry ? <primitive object={geometry} attach="geometry" dispose={null} /> : children;
}
