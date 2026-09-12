import { BUILD_SIZE } from "../../game/building-size.ts";

/** Presentation-only worldwide routing; canonical kinds and placements stay unchanged. */
export function settlementKitName(kind: string, x: number, z: number): "bank" | "forge" | null {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  if (kind === "bank" || kind === "forge") return kind;
  return null;
}

/** Retain existing floor/counter/hearth voxels under an optional exterior shell. */
export function retainSettlementInteriorVoxel(
  kind: string,
  voxel: { x: number; y: number; z: number; cut?: boolean },
): boolean {
  if ((kind !== "bank" && kind !== "forge") || voxel.cut) return false;
  const bounds = BUILD_SIZE[kind];
  return voxel.x > bounds.x0 && voxel.x < bounds.x1 && voxel.z > bounds.z0 && voxel.z < bounds.z1;
}
