import { nid } from "../world.ts";
import { PLACEABLE_BY_ID } from "./catalog.ts";
import type { Rotation } from "./schema.ts";
import {
  canPlace,
  creditCost,
  debitCost,
  defaultMaterials,
} from "./placement.ts";
import type { Block } from "./types.ts";
import type { World } from "../types.ts";

const RECLAIM = 0.75;

function ownedObject(world: World, id: string) {
  const obj = world.placedObjects.find((o) => o.id === id);
  if (!obj) return { err: "No such piece." as const };
  if (obj.ownerId !== world.player.id) return { err: "That hold is not yours." as const };
  return { obj };
}

function ensureStructure(world: World, objectId: string) {
  let hold = world.structures.find((s) => s.ownerId === world.player.id);
  if (!hold) {
    hold = {
      id: nid(world, "st"),
      name: "Hold",
      ownerId: world.player.id,
      objectIds: [],
      anchor: { tx: 0, ty: 0 },
      permissions: { visit: "private", use: "owner", build: "owner" },
      revision: 0,
    };
    world.structures.push(hold);
  }
  if (!hold.objectIds.includes(objectId)) hold.objectIds.push(objectId);
  hold.revision += 1;
  return hold;
}

export function placeObject(world: World, definitionId: string, tx: number, ty: number, rotation: Rotation) {
  const err = canPlace(world, definitionId, tx, ty, rotation);
  if (err) return err;
  const def = PLACEABLE_BY_ID[definitionId]!;
  debitCost(world, def);
  const id = nid(world, "po");
  const hold = ensureStructure(world, id);
  if (hold.objectIds.length === 1) hold.anchor = { tx, ty };
  world.placedObjects.push({
    id,
    definitionId,
    definitionVersion: def.schemaVersion,
    tx,
    ty,
    level: 0,
    rotation,
    materialSlots: defaultMaterials(def),
    ownerId: world.player.id,
    structureId: hold.id,
    name: null,
    state: {},
  });
  return null;
}

export function moveObject(world: World, id: string, tx: number, ty: number) {
  const found = ownedObject(world, id);
  if ("err" in found) return found.err;
  const err = canPlace(world, found.obj.definitionId, tx, ty, found.obj.rotation, { ignoreId: id, skipCost: true });
  if (err) return err;
  found.obj.tx = tx;
  found.obj.ty = ty;
  return null;
}

export function rotateObject(world: World, id: string, rotation: Rotation) {
  const found = ownedObject(world, id);
  if ("err" in found) return found.err;
  const err = canPlace(world, found.obj.definitionId, found.obj.tx, found.obj.ty, rotation, {
    ignoreId: id,
    skipCost: true,
  });
  if (err) return err;
  found.obj.rotation = rotation;
  return null;
}

export function copyObject(world: World, id: string, tx: number, ty: number) {
  const found = ownedObject(world, id);
  if ("err" in found) return found.err;
  return placeObject(world, found.obj.definitionId, tx, ty, found.obj.rotation);
}

export function reclaimObject(world: World, id: string) {
  const found = ownedObject(world, id);
  if ("err" in found) return found.err;
  if (world.player.ghost) return "A ghost cannot.";
  const def = PLACEABLE_BY_ID[found.obj.definitionId];
  if (!def) return "No such piece.";
  creditCost(world, def, RECLAIM);
  world.placedObjects = world.placedObjects.filter((o) => o.id !== id);
  for (const hold of world.structures) {
    hold.objectIds = hold.objectIds.filter((oid) => oid !== id);
  }
  world.structures = world.structures.filter((s) => s.objectIds.length > 0);
  return null;
}

export function setObjectMaterial(world: World, id: string, slot: string, block: Block) {
  const found = ownedObject(world, id);
  if ("err" in found) return found.err;
  const def = PLACEABLE_BY_ID[found.obj.definitionId];
  if (!def) return "No such piece.";
  const allowed = def.materialSlots[slot];
  if (!allowed || !allowed.includes(block)) return "That dye is not for this piece.";
  found.obj.materialSlots = { ...found.obj.materialSlots, [slot]: block };
  return null;
}

export function renameStructure(world: World, id: string, name: string) {
  const hold = world.structures.find((s) => s.id === id);
  if (!hold) return "No such hold.";
  if (hold.ownerId !== world.player.id) return "That hold is not yours.";
  if (typeof name !== "string" || name.length < 1 || name.length > 48) return "That name will not hold.";
  hold.name = name;
  hold.revision += 1;
  return null;
}
