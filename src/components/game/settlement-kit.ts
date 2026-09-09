import { COURT, EMBERHALL_BANK } from "../../game/atlas.ts";
import { BUILD_SIZE } from "../../game/building-size.ts";

/** Presentation-only pilot routing. Never expands to capital or other settlements. */
export function settlementKitName(kind: string, x: number, z: number): "bank" | "forge" | null {
  if (kind === "bank" && x === EMBERHALL_BANK.tx && z === EMBERHALL_BANK.ty) return "bank";
  if (kind === "forge" && Math.hypot(x - COURT.tx, z - COURT.ty) <= 12) return "forge";
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
