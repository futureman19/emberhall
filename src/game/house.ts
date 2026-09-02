import { EMBERHALL_BANK } from "./atlas.ts";
import { buildingBox, boxesOverlap } from "./building-size.ts";
import { emptyChest, ITEM_META } from "./catalog.ts";
import { plotAt } from "./farm.ts";
import { you } from "./player.ts";
import type { Building, ItemId, World } from "./types.ts";
import { log, nid } from "./world.ts";

export const HOUSE_KINDS = ["porch", "hut", "homestead"] as const;
export type HouseKind = (typeof HOUSE_KINDS)[number];

export const HOUSE_DEEDS: Record<HouseKind, ItemId> = {
  porch: "deed_porch",
  hut: "deed_hut",
  homestead: "deed_homestead",
};

export const HOUSE_RANGE = 3.6;
export const HOUSE_SLOTS = 8;

const FOOTING = new Set(["grass", "dirt", "sand", "snow"]);

export function isHouseKind(kind: string): kind is HouseKind {
  return (HOUSE_KINDS as readonly string[]).includes(kind);
}

export function houseKindForDeed(item: ItemId): HouseKind | null {
  for (const kind of HOUSE_KINDS) {
    if (HOUSE_DEEDS[kind] === item) return kind;
  }
  return null;
}

export function playerHouse(world: World) {
  return world.buildings.find((b) => isHouseKind(b.kind) && b.ownerId === world.player.id) ?? null;
}

export function houseAt(world: World, tx: number, ty: number, reach = 2.8) {
  let best: Building | null = null;
  let d = reach;
  for (const b of world.buildings) {
    if (!isHouseKind(b.kind)) continue;
    const dd = Math.hypot(b.tx - tx, b.ty - ty);
    if (dd < d) {
      d = dd;
      best = b;
    }
  }
  return best;
}

function houseHands(world: World, building: Building) {
  if (world.player.ghost) return "A ghost cannot.";
  const p = you(world);
  if (!p) return "No body.";
  if (Math.hypot(p.x - building.tx, p.z - building.ty) > HOUSE_RANGE) return "Walk closer.";
  if (building.ownerId !== world.player.id) return "That house is not yours.";
  return null;
}

function chestSlots(chest: Partial<Record<ItemId, number>>) {
  let n = 0;
  for (const id of Object.keys(ITEM_META) as ItemId[]) {
    if ((chest[id] ?? 0) > 0) n += 1;
  }
  return n;
}

export function houseSiteError(world: World, kind: HouseKind, tx: number, ty: number): string | null {
  if (world.player.ghost) return "A ghost cannot.";
  if (playerHouse(world)) return "You already have a house.";
  const deed = HOUSE_DEEDS[kind];
  if ((world.player.pack[deed] ?? 0) < 1) return `Need a ${ITEM_META[deed].label.toLowerCase()}.`;
  const p = you(world);
  if (!p) return "No body.";
  if (Math.hypot(p.x - tx, p.z - ty) > 8) return "Stand nearer the dirt.";
  if (plotAt(world, tx, ty)) return "That dirt is a bed.";
  const box = buildingBox(kind, tx, ty);
  for (let z = Math.floor(box.z0); z <= Math.floor(box.z1 - 1e-4); z++) {
    for (let x = Math.floor(box.x0); x <= Math.floor(box.x1 - 1e-4); x++) {
      const tile = world.tiles[z]?.[x];
      if (!tile || !FOOTING.has(tile.kind)) return "No footing.";
    }
  }
  const bankBox = buildingBox("bank", EMBERHALL_BANK.tx, EMBERHALL_BANK.ty);
  if (boxesOverlap(box, bankBox)) return "The bank is the only safe tile.";
  for (const b of world.buildings) {
    if (boxesOverlap(box, buildingBox(b.kind, b.tx, b.ty))) return "That ground is taken.";
  }
  return null;
}

export function placeHouse(world: World, kind: HouseKind, tx: number, ty: number) {
  const err = houseSiteError(world, kind, tx, ty);
  if (err) return err;
  const deed = HOUSE_DEEDS[kind];
  world.player.pack[deed] = (world.player.pack[deed] ?? 0) - 1;
  const label = ITEM_META[deed].label.replace(/ deed$/i, "");
  world.buildings.push({
    id: nid(world, "b"),
    kind,
    tx,
    ty,
    beds: [],
    ownerId: world.player.id,
    chest: emptyChest(),
    chestGold: 0,
  });
  log(world, `The ${label.toLowerCase()} is raised.`);
  return null;
}

export function commandHouseItem(world: World, buildingId: string, item: ItemId, n = 1) {
  const building = world.buildings.find((b) => b.id === buildingId);
  if (!building || !isHouseKind(building.kind)) return "No house here.";
  const err = houseHands(world, building);
  if (err) return err;
  if (!building.chest) building.chest = emptyChest();
  const have = world.player.pack[item] ?? 0;
  if (n < 1 || have < n) return "You do not carry that.";
  const had = building.chest[item] ?? 0;
  if (had < 1 && chestSlots(building.chest) >= HOUSE_SLOTS) return "The chest is full.";
  world.player.pack[item] = have - n;
  building.chest[item] = had + n;
  return "Into the chest.";
}

export function commandHouseTake(world: World, buildingId: string, item: ItemId, n = 1) {
  const building = world.buildings.find((b) => b.id === buildingId);
  if (!building || !isHouseKind(building.kind)) return "No house here.";
  const err = houseHands(world, building);
  if (err) return err;
  const chest = building.chest ?? emptyChest();
  building.chest = chest;
  const have = chest[item] ?? 0;
  if (n < 1 || have < n) return "The chest has none.";
  chest[item] = have - n;
  world.player.pack[item] = (world.player.pack[item] ?? 0) + n;
  return "Out of the chest.";
}
