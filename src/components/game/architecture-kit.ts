import { BUILD_SIZE } from "../../game/building-size.ts";

export const ARCHITECTURE_KINDS = [
  "rampart", "rampartV", "tower", "gatehouse", "shop", "townhome",
  "townhouse", "cottage", "porch", "hut", "homestead",
] as const;
export type ArchitectureKind = (typeof ARCHITECTURE_KINDS)[number];
export const RETAINED_ARCHITECTURE = {
  keep: "Original exterior and every story/floor/stair/cutaway retained; no monolithic keep shell.",
} as const;

/** Placement-only routing: no camera/player coordinates, geography, RNG or simulation mutation. */
export function architectureKitName(kind: string, x: number, z: number): `architecture-${ArchitectureKind}` | null {
  return Number.isFinite(x) && Number.isFinite(z) && ARCHITECTURE_KINDS.includes(kind as ArchitectureKind)
    ? `architecture-${kind as ArchitectureKind}` : null;
}

/** Exteriors have no furnishings/floors. Original noncut contents and floors remain underneath.
 * On entry the WHOLE authored shell disappears and the unmodified original cutaway is restored.
 * Non-enterable fortifications retain their original foundation (and original invisible picking).
 */
export function retainArchitectureInteriorVoxel(kind: string, v: {x: number; y: number; z: number; cut?: boolean}): boolean {
  if (v.cut || !ARCHITECTURE_KINDS.includes(kind as ArchitectureKind)) return false;
  if (v.y === 0) return true;
  if (kind === "rampart" || kind === "rampartV" || kind === "tower" || kind === "gatehouse") return false;
  const b = BUILD_SIZE[kind as ArchitectureKind];
  return v.x > b.x0 && v.x < b.x1 && v.z > b.z0 && v.z < b.z1;
}
