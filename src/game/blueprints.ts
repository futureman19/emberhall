import { nid } from "./world.ts";
import { you } from "./player.ts";
import type { ItemId, World } from "./types.ts";
import { PLACEABLE_BY_ID } from "./placeables/catalog.ts";
import { placeObject } from "./placeables/commands.ts";
import { canPlace, rotateCell } from "./placeables/placement.ts";
import { isBlueprint } from "./placeables/schema.ts";
import type { Blueprint, BlueprintObject, Rotation } from "./placeables/schema.ts";

export type PosedPiece = {
  definitionId: string;
  tx: number;
  ty: number;
  rotation: Rotation;
};

function ownedHold(world: World) {
  return world.structures.find((s) => s.ownerId === world.player.id) ?? null;
}

function turn(rotation: Rotation, add: Rotation): Rotation {
  return (((rotation + add) % 4) as Rotation);
}

export function poseBlueprint(bp: Blueprint, tx: number, ty: number, rotation: Rotation): PosedPiece[] {
  return bp.objects.map((o) => {
    const [dx, dy] = rotateCell(o.dx, o.dy, rotation);
    return {
      definitionId: o.definitionId,
      tx: tx + dx,
      ty: ty + dy,
      rotation: turn(o.rotation, rotation),
    };
  });
}

export function captureBlueprint(world: World, name: string): string | null {
  if (world.player.ghost) return "A ghost cannot.";
  const hold = ownedHold(world);
  if (!hold || hold.objectIds.length === 0) return "Raise a hold first.";
  const label = name.trim();
  if (label.length < 1 || label.length > 48) return "That name will not hold.";
  const objects = world.placedObjects.filter((o) => hold.objectIds.includes(o.id));
  if (objects.length === 0) return "Raise a hold first.";
  const minTx = Math.min(...objects.map((o) => o.tx));
  const minTy = Math.min(...objects.map((o) => o.ty));
  const maxTx = Math.max(...objects.map((o) => o.tx));
  const maxTy = Math.max(...objects.map((o) => o.ty));
  const pieces: BlueprintObject[] = objects.map((o) => ({
    definitionId: o.definitionId,
    definitionVersion: o.definitionVersion,
    dx: o.tx - minTx,
    dy: o.ty - minTy,
    level: o.level,
    rotation: o.rotation,
    materialSlots: { ...o.materialSlots },
    state: {},
  }));
  const bill = new Map<string, number>();
  const tags = new Set<string>();
  for (const o of objects) {
    const def = PLACEABLE_BY_ID[o.definitionId];
    if (!def) continue;
    tags.add(def.category);
    for (const need of def.cost) bill.set(need.item, (bill.get(need.item) ?? 0) + need.n);
  }
  const author = you(world)?.name ?? "Unknown";
  const bp: Blueprint = {
    id: nid(world, "bp"),
    version: 1,
    name: label,
    author: author.slice(0, 48),
    bounds: {
      w: Math.max(1, maxTx - minTx + 1),
      d: Math.max(1, maxTy - minTy + 1),
      h: Math.max(1, Math.max(...objects.map((o) => o.level)) + 1),
    },
    objects: pieces,
    billOfMaterials: [...bill.entries()].map(([id, n]) => ({ id, n })),
    tags: [...tags],
  };
  if (!isBlueprint(bp)) return "That plan will not keep.";
  world.blueprints.push(bp);
  return null;
}

export function applyBlueprint(world: World, id: string, tx: number, ty: number, rotation: Rotation): string | null {
  if (world.player.ghost) return "A ghost cannot.";
  const bp = world.blueprints.find((b) => b.id === id);
  if (!bp) return "No such plan.";
  const poses = poseBlueprint(bp, tx, ty, rotation);
  for (const pose of poses) {
    const err = canPlace(world, pose.definitionId, pose.tx, pose.ty, pose.rotation, { skipCost: true });
    if (err) return err;
  }
  for (const need of bp.billOfMaterials) {
    const have = world.player.pack[need.id as ItemId] ?? 0;
    if (have < need.n) return `Need ${need.n} ${need.id}.`;
  }
  for (const need of bp.billOfMaterials) {
    world.player.pack[need.id as ItemId] = (world.player.pack[need.id as ItemId] ?? 0) - need.n;
  }
  for (const pose of poses) {
    const err = placeObject(world, pose.definitionId, pose.tx, pose.ty, pose.rotation, { skipCost: true, skipValidate: true });
    if (err) return err;
  }
  return null;
}
