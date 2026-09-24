import { ITEM_META } from "./catalog.ts";
import { plotAt } from "./farm.ts";
import { houseAt } from "./house.ts";
import { buildingBox } from "./building-size.ts";
import { astar, nearestWalkable, tileOf } from "./pathfinding.ts";
import { pieceBlocks } from "./placeables/functions.ts";
import { addToPile } from "./piles.ts";
import { tryGain } from "./skills.ts";
import { playSfx } from "./vale-sfx.ts";
import { emitExtractionFx } from "./extraction-animation.ts";
import type { Hole, ItemId, TileKind, World } from "./types.ts";

export const HOLE_CAP = 12;
const WORK_REACH = 2.4;
const DIG_KINDS = new Set<TileKind>(["grass", "dirt", "sand", "snow", "marsh"]);

function you(world: World) {
  return world.people.find((p) => p.isPlayer) ?? world.people.find((p) => p.id === world.player.id) ?? null;
}

function keyOf(tx: number, ty: number) {
  return `${tx},${ty}`;
}

export function ensureHoles(world: World) {
  if (!world.holes) world.holes = {};
  return world.holes;
}

export function holeAt(world: World, tx: number, ty: number): Hole | null {
  return world.holes?.[keyOf(tx, ty)] ?? null;
}

function openCount(world: World) {
  return Object.values(ensureHoles(world)).filter((h) => h.open).length;
}

function inReach(world: World, tx: number, ty: number) {
  const p = you(world);
  return Boolean(p) && Math.hypot(p!.x - tx, p!.z - ty) <= WORK_REACH;
}

function pathBeside(world: World, tx: number, ty: number) {
  const p = you(world);
  if (!p) return "You are not in the vale.";
  const dest = nearestWalkable(world, tx, ty);
  if (!dest) return "No footing.";
  const from = tileOf(p.x, p.z);
  const path = astar(world, from.tx, from.ty, dest.x, dest.y);
  if (!path) return "The way is closed.";
  p.path = path.map((n) => ({ tx: n.x, ty: n.y }));
  return null;
}

function heldPick(world: World) {
  if (world.player.wear.main === "pick") return null;
  return "Hold a pick — tap it in You.";
}

function occupied(world: World, tx: number, ty: number): string | null {
  if (plotAt(world, tx, ty)) return "That dirt is a bed.";
  if (world.saplings?.some((s) => s.tx === tx && s.ty === ty)) return "A sapling grows.";
  if (houseAt(world, tx, ty, 0.6)) return "Not under a house.";
  if (pieceBlocks(world, tx, ty)) return "Something stands there.";
  for (const b of world.buildings) {
    const box = buildingBox(b.kind, b.tx, b.ty);
    if (tx + 0.5 > box.x0 && tx + 0.5 < box.x1 && ty + 0.5 > box.z0 && ty + 0.5 < box.z1) {
      return "Not this stone.";
    }
  }
  return null;
}

function restoreTile(world: World, tx: number, ty: number, hole: Hole) {
  const tile = world.tiles[ty]?.[tx];
  if (tile) {
    tile.kind = hole.kind;
    tile.h = hole.h;
  }
  delete world.scars[keyOf(tx, ty)];
  world.landRev += 1;
}

function pileHere(world: World, tx: number, ty: number) {
  return world.piles.find((p) => p.tx === tx && p.ty === ty) ?? null;
}

function takePile(world: World, tx: number, ty: number): Hole["buried"] | undefined {
  const pile = pileHere(world, tx, ty);
  if (!pile) return undefined;
  const items = { ...pile.items };
  const gold = pile.gold;
  world.piles = world.piles.filter((p) => p.id !== pile.id);
  const has = gold > 0 || Object.values(items).some((n) => (n ?? 0) > 0);
  return has ? { items, gold } : undefined;
}

function firstLootName(buried: NonNullable<Hole["buried"]>) {
  for (const [id, n] of Object.entries(buried.items)) {
    if ((n ?? 0) > 0) return ITEM_META[id as ItemId].label.toLowerCase();
  }
  if (buried.gold > 0) return "coin";
  return "something";
}

function giveBuried(world: World, buried: NonNullable<Hole["buried"]>) {
  for (const [id, n] of Object.entries(buried.items)) {
    if (!n) continue;
    world.player.pack[id as ItemId] = (world.player.pack[id as ItemId] ?? 0) + n;
  }
  if (buried.gold > 0) world.gold += buried.gold;
}

export function applyDig(world: World, tx: number, ty: number) {
  if (world.player.ghost) return "A ghost cannot.";
  const pick = heldPick(world);
  if (pick) return pick;
  const tile = world.tiles[ty]?.[tx];
  if (!tile) return "No footing.";
  const existing = holeAt(world, tx, ty);
  if (existing && !existing.open && existing.buried) {
    const name = firstLootName(existing.buried);
    giveBuried(world, existing.buried);
    delete ensureHoles(world)[keyOf(tx, ty)];
    playSfx("mine", 0.4);
    const gain = tryGain(world, "mining", true, true);
    const note = `You unearth ${name}.`;
    return gain ? `${note} ${gain}` : note;
  }
  if (existing?.open) return "The hole is already open.";
  const busy = occupied(world, tx, ty);
  if (busy) return busy;
  if (tile.kind === "water") return "The water will not take a hole.";
  if (tile.kind === "pit") return "The tomb is not yours to shovel.";
  if (tile.kind === "cobble" || tile.kind === "road" || tile.kind === "floor" || tile.kind === "wall" || tile.kind === "step") {
    return "Not this stone.";
  }
  if (tile.kind === "rock") return "Mine the stone. Do not shovel it.";
  if (tile.kind === "tree") return "The tree stands.";
  if (!DIG_KINDS.has(tile.kind)) return "Not this dirt.";
  if (openCount(world) >= HOLE_CAP) return "Twelve holes is enough. Wait for rain.";
  const kind = tile.kind;
  const h = tile.h;
  tile.kind = "pit";
  tile.h = Math.max(0, h - 1);
  world.scars[keyOf(tx, ty)] = { kind: "pit", h: tile.h };
  ensureHoles(world)[keyOf(tx, ty)] = { kind, h, open: true };
  world.landRev += 1;
  emitExtractionFx(world, "mining", true, tx, ty);
  playSfx("mine", 0.5);
  const gain = tryGain(world, "mining", true, true);
  const note = "A hole in the dirt.";
  return gain ? `${note} ${gain}` : note;
}

export function applyFill(world: World, tx: number, ty: number) {
  if (world.player.ghost) return "A ghost cannot.";
  const hole = holeAt(world, tx, ty);
  if (!hole?.open) return "No hole to fill.";
  const buried = takePile(world, tx, ty);
  restoreTile(world, tx, ty, hole);
  if (buried) {
    hole.open = false;
    hole.buried = buried;
    ensureHoles(world)[keyOf(tx, ty)] = hole;
    playSfx("chop", 0.35);
    return "You kick the dirt over it.";
  }
  delete ensureHoles(world)[keyOf(tx, ty)];
  playSfx("chop", 0.35);
  return "You kick the dirt back.";
}

export function washHoles(world: World) {
  if (!world.tiles?.length) return;
  const holes = ensureHoles(world);
  const keys = Object.keys(holes);
  if (keys.length === 0) return;
  let washed = 0;
  for (const key of keys) {
    const hole = holes[key]!;
    const [tx, ty] = key.split(",").map(Number) as [number, number];
    if (hole.open) restoreTile(world, tx, ty, hole);
    if (hole.buried) {
      const items = hole.buried.items;
      const gold = hole.buried.gold;
      if (gold > 0 || Object.values(items).some((n) => (n ?? 0) > 0)) {
        addToPile(world, tx, ty, items, "drop", world.hour + 24, "mud", gold);
      }
    }
    delete holes[key];
    washed += 1;
  }
  if (washed > 0) {
    world.log.unshift({ t: world.hour, text: washed === 1 ? "The rain fills a hole." : "The rain fills the holes." });
    if (world.log.length > 48) world.log.length = 48;
  }
}

export function commandDig(world: World, tx: number, ty: number) {
  const p = you(world);
  if (!p) return "You are not in the vale.";
  if (world.player.ghost) return "A ghost cannot.";
  const pick = heldPick(world);
  if (pick) return pick;
  const closed = pathBeside(world, tx, ty);
  if (closed) return closed;
  world.player.intent = { kind: "dig", tx, ty, targetId: null, spell: null };
  return null;
}

export function commandFill(world: World, tx: number, ty: number) {
  const p = you(world);
  if (!p) return "You are not in the vale.";
  if (world.player.ghost) return "A ghost cannot.";
  if (!holeAt(world, tx, ty)?.open) return "No hole to fill.";
  const closed = pathBeside(world, tx, ty);
  if (closed) return closed;
  world.player.intent = { kind: "fill", tx, ty, targetId: null, spell: null };
  return null;
}

export function digNow(world: World) {
  const { tx, ty } = world.player.intent;
  world.player.intent.kind = "none";
  if (!inReach(world, tx, ty)) return "Too far.";
  return applyDig(world, tx, ty);
}

export function fillNow(world: World) {
  const { tx, ty } = world.player.intent;
  world.player.intent.kind = "none";
  if (!inReach(world, tx, ty)) return "Too far.";
  return applyFill(world, tx, ty);
}
