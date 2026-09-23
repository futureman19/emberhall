import { boxesOverlap, buildingBox } from "../building-size.ts";
import { VOX } from "./types.ts";
import { PLACEABLE_BY_ID } from "./catalog.ts";
import type { Rotation } from "./schema.ts";
import type { ItemId, World } from "../types.ts";
import type { PlaceableDefinition } from "./types.ts";

export type PlaceOpts = {
  ignoreId?: string;
  skipCost?: boolean;
};

function rotateCell(x: number, z: number, rot: Rotation): [number, number] {
  if (rot === 1) return [z, -x];
  if (rot === 2) return [-x, -z];
  if (rot === 3) return [-z, x];
  return [x, z];
}

export function placedBox(definitionId: string, tx: number, ty: number, rotation: Rotation) {
  const def = PLACEABLE_BY_ID[definitionId];
  if (!def) return { x0: tx, x1: tx, z0: ty, z1: ty };
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let x = def.footprint.x0; x <= def.footprint.x1; x++) {
    for (let z = def.footprint.z0; z <= def.footprint.z1; z++) {
      const [rx, rz] = rotateCell(x, z, rotation);
      minX = Math.min(minX, rx);
      maxX = Math.max(maxX, rx);
      minZ = Math.min(minZ, rz);
      maxZ = Math.max(maxZ, rz);
    }
  }
  return {
    x0: tx + minX * VOX,
    x1: tx + (maxX + 1) * VOX,
    z0: ty + minZ * VOX,
    z1: ty + (maxZ + 1) * VOX,
  };
}

export function costError(world: World, def: PlaceableDefinition): string | null {
  for (const need of def.cost) {
    const have = world.player.pack[need.item as ItemId] ?? 0;
    if (have < need.n) return `Need ${need.n} ${need.item}.`;
  }
  return null;
}

export function debitCost(world: World, def: PlaceableDefinition) {
  for (const need of def.cost) {
    world.player.pack[need.item as ItemId] -= need.n;
  }
}

export function creditCost(world: World, def: PlaceableDefinition, fraction: number) {
  for (const need of def.cost) {
    world.player.pack[need.item as ItemId] += Math.floor(need.n * fraction);
  }
}

export function defaultMaterials(def: PlaceableDefinition): Record<string, string> {
  const slots: Record<string, string> = {};
  for (const [slot, allowed] of Object.entries(def.materialSlots)) {
    slots[slot] = allowed[0]!;
  }
  return slots;
}

export function canPlace(
  world: World,
  definitionId: string,
  tx: number,
  ty: number,
  rotation: Rotation,
  opts: PlaceOpts = {},
): string | null {
  if (world.player.ghost) return "A ghost cannot.";
  const def = PLACEABLE_BY_ID[definitionId];
  if (!def) return "No such piece.";
  if (!def.rotations.includes(rotation)) return "It will not turn that way.";
  if (!opts.skipCost) {
    const need = costError(world, def);
    if (need) return need;
  }
  const box = placedBox(definitionId, tx, ty, rotation);
  for (let z = Math.floor(box.z0); z <= Math.floor(box.z1 - 1e-4); z++) {
    for (let x = Math.floor(box.x0); x <= Math.floor(box.x1 - 1e-4); x++) {
      const tile = world.tiles[z]?.[x];
      if (!tile || tile.kind === "water" || tile.kind === "wall" || tile.kind === "pit") return "No footing.";
    }
  }
  for (const b of world.buildings) {
    if (boxesOverlap(box, buildingBox(b.kind, b.tx, b.ty))) return "That ground is taken.";
  }
  for (const o of world.placedObjects) {
    if (o.id === opts.ignoreId) continue;
    if (boxesOverlap(box, placedBox(o.definitionId, o.tx, o.ty, o.rotation))) return "That ground is taken.";
  }
  return null;
}
