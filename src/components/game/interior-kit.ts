export const INTERIOR_KINDS = [
  "hall",
  "dormitory",
  "kitchen",
  "yard",
  "market",
  "forge",
  "tavern",
  "bank",
] as const;
export type InteriorKind = (typeof INTERIOR_KINDS)[number];
export const INTERIOR_COVERAGE = {
  hall: "authored",
  dormitory: "authored; logical beds retained, no authoritative bed visual",
  kitchen: "authored",
  yard: "authored",
  market: "authored",
  forge: "authored",
  tavern: "authored",
  bank: "authored",
  farm: "retained soil beds; no interior furniture",
  notice: "excluded external sign worker",
  board: "excluded external sign worker",
} as const;
/** Load at [building.tx, groundY, building.ty], identity rotation/scale. No extra floor offset. */
export function interiorKitName(
  kind: string,
  x: number,
  z: number,
): `interior-${InteriorKind}` | null {
  return INTERIOR_KINDS.includes(kind as InteriorKind) &&
    Number.isFinite(x) && Number.isFinite(z)
    ? `interior-${kind as InteriorKind}`
    : null;
}
export function interiorVoxelCenter(v: number): number {
  return (v + 0.5) * 0.5;
}
/** ONLY hide visual voxels after successful asset load. Keep these exact original voxels as pick proxies. */
export function replaceInteriorVoxel(
  kind: string,
  v: { x: number; y: number; z: number; t?: string; cut?: boolean },
): boolean {
  if (v.cut || v.y === 0) return false;
  const { x, y, z, t } = v;
  if (["hall", "dormitory", "kitchen", "tavern", "bank"].includes(kind)) {
    if (y === 1 && x >= -1 && x <= 1 && z >= -1 && z <= 0 && t === "dark") return true;
    if (y === 2 && x === 0 && z === -1 && t === "gold") return true;
    if (kind === "bank" && x === 0 && y === 2 && z === 0 && t === "gold") return true;
    const hx = kind === "kitchen" ? -2 : kind === "tavern" ? 3 : null;
    return (
      hx !== null &&
      x === hx &&
      y === 1 &&
      ((z === -2 && t === "wool") || (z === -1 && t === "coal"))
    );
  }
  if (kind === "market")
    return (
      (y === 1 && x >= -2 && x <= 2 && z >= -1 && z <= 1 && t === "dark") ||
      (x === 0 && y === 2 && z === 0 && t === "gold")
    );
  if (kind === "yard") return x === 0 && z === 0 && (y === 1 || y === 2) && t === "stone";
  if (kind === "forge")
    return (
      y === 1 &&
      ((x === 0 && z === 0 && t === "wool") ||
        (x === 0 && z === 1 && t === "coal") ||
        (x === -1 && z === 0 && t === "gold"))
    );
  return false;
}
