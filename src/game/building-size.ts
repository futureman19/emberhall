import type { BuildingKind, World } from "./types.ts";
import { SPECS } from "./placeables/legacy-buildings.ts";
import type { BuildingSpec } from "./placeables/types.ts";
import { VOX } from "./placeables/types.ts";

export { VOX };

function bounds(spec: BuildingSpec) {
  return { x0: spec.x0, x1: spec.x1, z0: spec.z0, z1: spec.z1 };
}

export const BUILD_SIZE: Record<BuildingKind, { x0: number; x1: number; z0: number; z1: number }> = {
  hall: bounds(SPECS.hall),
  dormitory: bounds(SPECS.dormitory),
  kitchen: bounds(SPECS.kitchen),
  yard: bounds(SPECS.yard),
  market: bounds(SPECS.market),
  forge: bounds(SPECS.forge),
  tavern: bounds(SPECS.tavern),
  notice: bounds(SPECS.notice),
  board: bounds(SPECS.board),
  farm: bounds(SPECS.farm),
  bank: bounds(SPECS.bank),
  keep: bounds(SPECS.keep),
  rampart: bounds(SPECS.rampart),
  rampartV: bounds(SPECS.rampartV),
  tower: bounds(SPECS.tower),
  gatehouse: bounds(SPECS.gatehouse),
  shop: bounds(SPECS.shop),
  townhome: bounds(SPECS.townhome),
  townhouse: bounds(SPECS.townhouse),
  cottage: bounds(SPECS.cottage),
  porch: bounds(SPECS.porch),
  hut: bounds(SPECS.hut),
  homestead: bounds(SPECS.homestead),
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
  if (kind === "porch" || kind === "hut" || kind === "homestead") return "Raise a house from a deed.";
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
