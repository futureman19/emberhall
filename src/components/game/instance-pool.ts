import type { InstancedMesh } from "three";

/** Retain GPU capacity but submit only the populated prefix. Every live slot is
 * rewritten by the caller before growth, so stale tail matrices are never drawn.
 * Bounds must be invalidated when the active prefix changes (native picking).
 */
export function finishInstancePool(mesh: InstancedMesh | null, used: number, capacity: number) {
  if (!mesh) return;
  mesh.count = Math.min(used, capacity);
  mesh.boundingSphere = null;
  mesh.boundingBox = null;
  mesh.instanceMatrix.needsUpdate = true;
}
