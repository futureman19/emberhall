import { createRef } from "react";
import { Matrix4, type InstancedMesh } from "three";
import { TIMBER_IDS } from "./timber-renderer-policy.ts";
export const HIDDEN_TIMBER = new Matrix4().makeScale(0, 0, 0);
export type TimberSite = { tx: number; ty: number };
export function createTimberBatches() {
  return TIMBER_IDS.map(id => ({ id, trunk: createRef<InstancedMesh>(), crown: createRef<InstancedMesh>(), trunkGhost: createRef<InstancedMesh>(), crownGhost: createRef<InstancedMesh>(), solidAt: { current: [] as TimberSite[] }, ghostAt: { current: [] as TimberSite[] } }));
}
export type TimberBatches = ReturnType<typeof createTimberBatches>;
/** Dense per-species slots avoid submitting every forest vertex eight times.
 * Each slot retains its authoritative tile target; the old primitive maps stay unchanged.
 */
export function claimTimberSlot(batch: TimberBatches[number], faded: boolean, site: TimberSite) {
  const map = faded ? batch.ghostAt.current : batch.solidAt.current;
  const index = map.length;
  map.push(site);
  return index;
}
export function resetTimberBatches(batches: TimberBatches) {
  for (const batch of batches) {
    batch.solidAt.current.length = 0;
    batch.ghostAt.current.length = 0;
  }
}
export function finishTimberBatches(batches: TimberBatches) {
  for (const batch of batches) for (const [ref, map] of [[batch.trunk, batch.solidAt], [batch.crown, batch.solidAt], [batch.trunkGhost, batch.ghostAt], [batch.crownGhost, batch.ghostAt]] as const) {
    const mesh = ref.current;
    if (!mesh) continue;
    mesh.count = map.current.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.boundingSphere = null;
  }
}
