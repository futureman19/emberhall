import type { BuildingKind, World } from "./types.ts";

export const VOX = 0.5;

export const BUILD_SIZE: Record<BuildingKind, { x0: number; x1: number; z0: number; z1: number }> = {
  hall: { x0: -5, x1: 5, z0: -4, z1: 4 },
  dormitory: { x0: -6, x1: 6, z0: -3, z1: 3 },
  kitchen: { x0: -3, x1: 3, z0: -3, z1: 3 },
  yard: { x0: -5, x1: 5, z0: -5, z1: 5 },
  market: { x0: -4, x1: 4, z0: -3, z1: 3 },
  forge: { x0: -3, x1: 3, z0: -3, z1: 3 },
  tavern: { x0: -4, x1: 4, z0: -3, z1: 3 },
  notice: { x0: -1, x1: 1, z0: 0, z1: 2 },
  board: { x0: -3, x1: 3, z0: 0, z1: 2 },
  farm: { x0: -5, x1: 5, z0: -5, z1: 5 },
  bank: { x0: -3, x1: 3, z0: -2, z1: 2 },
  // Kingsford — the capital's structures.
  keep: { x0: -11, x1: 11, z0: -9, z1: 9 },
  rampart: { x0: -8, x1: 7, z0: -1, z1: 0 },
  rampartV: { x0: -1, x1: 0, z0: -8, z1: 7 },
  tower: { x0: -2, x1: 2, z0: -2, z1: 2 },
  gatehouse: { x0: -2, x1: 2, z0: -4, z1: 4 },
  shop: { x0: -4, x1: 4, z0: -3, z1: 3 },
  townhome: { x0: -4, x1: 4, z0: -3, z1: 3 },
  townhouse: { x0: -3, x1: 3, z0: -3, z1: 3 },
  cottage: { x0: -3, x1: 3, z0: -2, z1: 2 },
};

export function buildingBox(kind: BuildingKind, tx: number, ty: number) {
  const s = BUILD_SIZE[kind];
  return {
    x0: tx + s.x0 * VOX,
    x1: tx + (s.x1 + 1) * VOX,
    z0: ty + s.z0 * VOX,
    z1: ty + (s.z1 + 1) * VOX,
  };
}

export function boxesOverlap(
  a: { x0: number; x1: number; z0: number; z1: number },
  b: { x0: number; x1: number; z0: number; z1: number },
) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}

export function siteError(world: World, kind: BuildingKind, tx: number, ty: number): string | null {
  if (kind === "hall") return "The hall already stands.";
  if (kind === "bank") return "The bank already stands.";
  if (world.buildings.some((b) => b.kind === kind)) return `The ${kind} already stands.`;
  const cost = kind === "dormitory" ? 40 : 28;
  if (world.gold < cost) return `Need ${cost} gold.`;
  const box = buildingBox(kind, tx, ty);
  for (let z = Math.floor(box.z0); z <= Math.floor(box.z1 - 1e-4); z++) {
    for (let x = Math.floor(box.x0); x <= Math.floor(box.x1 - 1e-4); x++) {
      const tile = world.tiles[z]?.[x];
      if (!tile || tile.kind === "water" || tile.kind === "wall" || tile.kind === "pit") return "No footing.";
    }
  }
  for (const b of world.buildings) {
    if (boxesOverlap(box, buildingBox(b.kind, b.tx, b.ty))) return "That ground is taken.";
  }
  return null;
}
