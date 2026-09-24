import { emptyChest, ITEM_META } from "../catalog.ts";
import { you } from "../player.ts";
import type { ItemId, World } from "../types.ts";
import { PLACEABLE_BY_ID } from "./catalog.ts";
import { placedBox } from "./placement.ts";
import { SIGN_TEXT_MAX } from "./schema.ts";
import type { PlacedObject } from "./schema.ts";
import type { PlaceableFunction } from "./types.ts";

const REACH = 4.6;
const CHEST_SLOTS = 8;
const REST_HP = 8;

function defOf(obj: PlacedObject) {
  return PLACEABLE_BY_ID[obj.definitionId] ?? null;
}

function occupiesCell(obj: PlacedObject, tx: number, ty: number) {
  const box = placedBox(obj.definitionId, obj.tx, obj.ty, obj.rotation);
  return tx >= Math.floor(box.x0) && tx < Math.ceil(box.x1) && ty >= Math.floor(box.z0) && ty < Math.ceil(box.z1);
}

export function objectFn(obj: PlacedObject): PlaceableFunction | null {
  return defOf(obj)?.fn ?? null;
}

export function pieceAt(world: World, tx: number, ty: number) {
  return world.placedObjects.find((o) => occupiesCell(o, tx, ty)) ?? null;
}

function objectBlocks(obj: PlacedObject) {
  const def = defOf(obj);
  if (!def) return false;
  if (def.fn === "door") return obj.state.open !== true;
  if (def.id === "wall_doorway") return false;
  if (def.category === "roofs") return false;
  if (def.id.startsWith("floor_")) return false;
  if (def.fn === "light") return false;
  if (def.category === "frames") return true;
  return Boolean(def.fn);
}

export function pieceBlocks(world: World, tx: number, ty: number) {
  return world.placedObjects.some((o) => objectBlocks(o) && occupiesCell(o, tx, ty));
}

export function stationsFromPieces(world: World): Array<"bench" | "forge" | "fire"> {
  const p = you(world);
  if (!p) return [];
  const out = new Set<"bench" | "forge" | "fire">();
  for (const obj of world.placedObjects) {
    if (Math.hypot(p.x - obj.tx, p.z - obj.ty) > REACH) continue;
    const def = defOf(obj);
    if (!def) continue;
    if (def.fn === "craftStation" || def.station === "bench") out.add("bench");
    if (def.fn === "hearth") out.add("fire");
    if (def.station === "forge") out.add("forge");
  }
  return [...out];
}

function owned(world: World, id: string) {
  const obj = world.placedObjects.find((o) => o.id === id);
  if (!obj) return { err: "No such piece." as const };
  if (obj.ownerId !== world.player.id) return { err: "That hold is not yours." as const };
  const p = you(world);
  if (!p) return { err: "No body." as const };
  if (world.player.ghost) return { err: "A ghost cannot." as const };
  if (Math.hypot(p.x - obj.tx, p.z - obj.ty) > REACH) return { err: "Walk closer." as const };
  return { obj };
}

export function toggleDoor(world: World, id: string) {
  const found = owned(world, id);
  if ("err" in found) return found.err;
  if (objectFn(found.obj) !== "door") return "That is not a door.";
  found.obj.state = { ...found.obj.state, open: found.obj.state.open !== true };
  return null;
}

export function restAtBed(world: World, id: string) {
  const found = owned(world, id);
  if ("err" in found) return found.err;
  if (objectFn(found.obj) !== "bed") return "That is not a bed.";
  const p = you(world)!;
  p.hp = Math.min(p.maxHp, p.hp + REST_HP);
  return null;
}

function chestOf(obj: PlacedObject) {
  const raw = obj.state.chest;
  if (raw && typeof raw === "object") return raw as Record<string, number>;
  const chest = emptyChest() as Record<string, number>;
  obj.state = { ...obj.state, chest };
  return chest;
}

function chestSlots(chest: Record<string, number>) {
  let n = 0;
  for (const id of Object.keys(ITEM_META) as ItemId[]) {
    if ((chest[id] ?? 0) > 0) n += 1;
  }
  return n;
}

export function chestPut(world: World, id: string, item: ItemId, n = 1) {
  const found = owned(world, id);
  if ("err" in found) return found.err;
  if (objectFn(found.obj) !== "storage") return "That is not a chest.";
  const have = world.player.pack[item] ?? 0;
  if (n < 1 || have < n) return "You do not carry that.";
  const chest = chestOf(found.obj);
  const had = chest[item] ?? 0;
  if (had < 1 && chestSlots(chest) >= CHEST_SLOTS) return "The chest is full.";
  world.player.pack[item] = have - n;
  chest[item] = had + n;
  return null;
}

export function chestTake(world: World, id: string, item: ItemId, n = 1) {
  const found = owned(world, id);
  if ("err" in found) return found.err;
  if (objectFn(found.obj) !== "storage") return "That is not a chest.";
  const chest = chestOf(found.obj);
  const have = chest[item] ?? 0;
  if (n < 1 || have < n) return "The chest has none.";
  chest[item] = have - n;
  world.player.pack[item] = (world.player.pack[item] ?? 0) + n;
  return null;
}

export function setSignText(world: World, id: string, text: string) {
  const found = owned(world, id);
  if ("err" in found) return found.err;
  if (objectFn(found.obj) !== "sign") return "That is not a sign.";
  if (typeof text !== "string" || text.length < 1) return "The board wants a word.";
  if (text.length > SIGN_TEXT_MAX) return "That name is too long.";
  found.obj.state = { ...found.obj.state, text };
  found.obj.name = text;
  return null;
}

function footprintCells(obj: PlacedObject) {
  const box = placedBox(obj.definitionId, obj.tx, obj.ty, obj.rotation);
  const cells: { tx: number; ty: number }[] = [];
  for (let ty = Math.floor(box.z0); ty < Math.ceil(box.z1); ty++) {
    for (let tx = Math.floor(box.x0); tx < Math.ceil(box.x1); tx++) {
      cells.push({ tx, ty });
    }
  }
  return cells;
}

export function bindPlacedFunction(world: World, obj: PlacedObject) {
  if (objectFn(obj) !== "planter") return;
  for (const { tx, ty } of footprintCells(obj)) {
    if (world.plots.some((p) => p.tx === tx && p.ty === ty)) continue;
    const tile = world.tiles[ty]?.[tx];
    if (tile) {
      tile.kind = "dirt";
      world.scars[`${tx},${ty}`] = { kind: "dirt" };
    }
    world.plots.push({
      id: `pl_${obj.id}_${tx}_${ty}`,
      tx,
      ty,
      crop: null,
      plantedHour: 0,
      stage: 0,
    });
    world.landRev += 1;
  }
}

export function unbindPlacedFunction(world: World, obj: PlacedObject) {
  if (objectFn(obj) !== "planter") return;
  const cells = new Set(footprintCells(obj).map((c) => `${c.tx},${c.ty}`));
  world.plots = world.plots.filter((p) => {
    if (!cells.has(`${p.tx},${p.ty}`)) return true;
    return Boolean(p.crop);
  });
}

export function usePlaced(world: World, id: string) {
  const obj = world.placedObjects.find((o) => o.id === id);
  if (!obj) return "No such piece.";
  const fn = objectFn(obj);
  if (fn === "door") return toggleDoor(world, id);
  if (fn === "bed") return restAtBed(world, id);
  if (fn === "sign") {
    const text = typeof obj.state.text === "string" ? obj.state.text : obj.name;
    return text ? String(text) : "The board is blank.";
  }
  return "No work here.";
}
