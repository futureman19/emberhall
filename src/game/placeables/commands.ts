import { actorState, actorPerson } from "../actor.ts";
import { nid } from "../world.ts";
import { PLACEABLE_BY_ID } from "./catalog.ts";
import type { Rotation } from "./schema.ts";
import {
  canPlace,
  creditCost,
  debitCost,
  defaultMaterials,
  type PlaceOpts,
} from "./placement.ts";
import type { Block } from "./types.ts";
import type { World } from "../types.ts";
import { bindPlacedFunction, unbindPlacedFunction } from "./functions.ts";

const RECLAIM = 0.75;

function ownedObject(world: World, id: string, actorId?: string) {
  const player = actorState(world, actorId);
  const body = actorPerson(world, actorId);
  if (player.ghost || body?.ghost) return { err: "A ghost cannot." };
  if (actorId !== undefined && (!body || body.hp <= 0)) return { err: "No body." };
  const obj = world.placedObjects.find((o) => o.id === id);
  if (!obj) return { err: "No such piece." as const };
  if (obj.ownerId !== actorState(world, actorId).id) return { err: "That hold is not yours." as const };
  return { obj };
}

function ensureStructure(world: World, objectId: string, actorId?: string) {
  let hold = world.structures.find((s) => s.ownerId === actorState(world, actorId).id);
  if (!hold) {
    hold = {
      id: nid(world, "st"),
      name: "Hold",
      ownerId: actorState(world, actorId).id,
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

export function placeObject(world: World, definitionId: string, tx: number, ty: number, rotation: Rotation, opts: PlaceOpts = {}) {
  const actorId = opts.actorId;
  const player = actorState(world, actorId);
  const body = actorPerson(world, actorId);
  if (player.ghost || body?.ghost) return "A ghost cannot.";
  if (actorId !== undefined && (!body || body.hp <= 0)) return "No body.";
  if (!PLACEABLE_BY_ID[definitionId]) return "No such piece.";
  if (!opts.skipValidate) {
    const err = canPlace(world, definitionId, tx, ty, rotation, opts);
    if (err) return err;
  }
  const def = PLACEABLE_BY_ID[definitionId]!;
  if (!opts.skipCost) debitCost(world, def, actorId);
  const id = nid(world, "po");
  const hold = ensureStructure(world, id, actorId);
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
    ownerId: actorState(world, actorId).id,
    structureId: hold.id,
    name: null,
    state: {},
  });
  bindPlacedFunction(world, world.placedObjects[world.placedObjects.length - 1]!);
  return null;
}

export function moveObject(world: World, id: string, tx: number, ty: number, actorId?: string) {
  const found = ownedObject(world, id, actorId);
  if ("err" in found) return found.err;
  const err = canPlace(world, found.obj.definitionId, tx, ty, found.obj.rotation, { ignoreId: id, skipCost: true, actorId });
  if (err) return err;
  unbindPlacedFunction(world, found.obj);
  found.obj.tx = tx;
  found.obj.ty = ty;
  bindPlacedFunction(world, found.obj);
  return null;
}

export function rotateObject(world: World, id: string, rotation: Rotation, actorId?: string) {
  const found = ownedObject(world, id, actorId);
  if ("err" in found) return found.err;
  const err = canPlace(world, found.obj.definitionId, found.obj.tx, found.obj.ty, rotation, {
    actorId,
    ignoreId: id,
    skipCost: true,
  });
  if (err) return err;
  found.obj.rotation = rotation;
  return null;
}

export function copyObject(world: World, id: string, tx: number, ty: number, actorId?: string) {
  const found = ownedObject(world, id, actorId);
  if ("err" in found) return found.err;
  return placeObject(world, found.obj.definitionId, tx, ty, found.obj.rotation, { actorId });
}

export function reclaimObject(world: World, id: string, actorId?: string) {
  const found = ownedObject(world, id, actorId);
  if ("err" in found) return found.err;

  const def = PLACEABLE_BY_ID[found.obj.definitionId];
  if (!def) return "No such piece.";
  creditCost(world, def, RECLAIM, actorId);
  unbindPlacedFunction(world, found.obj);
  world.placedObjects = world.placedObjects.filter((o) => o.id !== id);
  for (const hold of world.structures) {
    hold.objectIds = hold.objectIds.filter((oid) => oid !== id);
  }
  world.structures = world.structures.filter((s) => s.objectIds.length > 0);
  return null;
}

export function setObjectMaterial(world: World, id: string, slot: string, block: Block, actorId?: string) {
  const found = ownedObject(world, id, actorId);
  if ("err" in found) return found.err;
  const def = PLACEABLE_BY_ID[found.obj.definitionId];
  if (!def) return "No such piece.";
  const allowed = def.materialSlots[slot];
  if (!allowed || !allowed.includes(block)) return "That dye is not for this piece.";
  found.obj.materialSlots = { ...found.obj.materialSlots, [slot]: block };
  return null;
}

export function renameStructure(world: World, id: string, name: string, actorId?: string) {
  const player = actorState(world, actorId);
  const body = actorPerson(world, actorId);
  if (player.ghost || body?.ghost) return "A ghost cannot.";
  if (actorId !== undefined && (!body || body.hp <= 0)) return "No body.";
  const hold = world.structures.find((s) => s.id === id);
  if (!hold) return "No such hold.";
  if (hold.ownerId !== actorState(world, actorId).id) return "That hold is not yours.";
  if (typeof name !== "string" || name.length < 1 || name.length > 48) return "That name will not hold.";
  hold.name = name;
  hold.revision += 1;
  return null;
}
