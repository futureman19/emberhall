import { ITEM_META } from "./catalog";
import { astar, nearestWalkable, tileOf } from "./pathfinding";
import { successChance, tryGain } from "./skills";
import { playSfx } from "./vale-sfx";
import type { CropId, ItemId, World } from "./types";

function you(world: World) {
  return world.people.find((p) => p.isPlayer) ?? world.people.find((p) => p.id === world.player.id) ?? null;
}

function noteDone(world: World, id: string) {
  const o = world.objectives.find((x) => x.id === id);
  if (o && !o.done) o.done = true;
}

function bedId(world: World) {
  return `bed-${world.tickCount}-${world.plots.length}-${world.seed}`;
}

export const CROP_ORDER: CropId[] = ["cabbage", "wheat", "garlic"];

export const CROP_META: Record<
  CropId,
  { item: ItemId; label: string; hours: number; diff: number; color: string; ripe: string }
> = {
  cabbage: { item: "cabbage", label: "Cabbage", hours: 0.75, diff: 6, color: "#5a7040", ripe: "#6a8a48" },
  wheat: { item: "wheat", label: "Wheat", hours: 1.1, diff: 12, color: "#8a7040", ripe: "#c9a36a" },
  garlic: { item: "garlic", label: "Garlic", hours: 1.55, diff: 18, color: "#6a7a48", ripe: "#ece6d8" },
};

export const FARM_BEDS: { dx: number; dz: number }[] = [
  { dx: -2, dz: -2 },
  { dx: 0, dz: -2 },
  { dx: 2, dz: -2 },
  { dx: -2, dz: 0 },
  { dx: 2, dz: 0 },
  { dx: -2, dz: 2 },
  { dx: 0, dz: 2 },
  { dx: 2, dz: 2 },
];

export function plotAt(world: World, tx: number, ty: number) {
  return world.plots.find((p) => p.tx === tx && p.ty === ty) ?? null;
}

export function firstSeed(world: World): CropId | null {
  for (const id of CROP_ORDER) {
    if ((world.player.pack[CROP_META[id].item] ?? 0) > 0) return id;
  }
  return null;
}

export function seedFarmPlots(world: World, tx: number, ty: number) {
  if (world.plots.some((p) => Math.hypot(p.tx - tx, p.ty - ty) < 4.2)) return;
  for (const bed of FARM_BEDS) {
    const x = tx + bed.dx;
    const z = ty + bed.dz;
    const tile = world.tiles[z]?.[x];
    if (tile && tile.kind !== "water" && tile.kind !== "pit" && tile.kind !== "wall") {
      tile.kind = "dirt";
      world.scars[`${x},${z}`] = { kind: "dirt" };
    }
    world.plots.push({
      id: bedId(world),
      tx: x,
      ty: z,
      crop: null,
      plantedHour: 0,
      stage: 0,
    });
  }
  world.landRev += 1;
}

export function tickCrops(world: World) {
  if (!world.plots?.length) return;
  for (const p of world.plots) {
    if (!p.crop || p.stage >= 3) continue;
    const grow = CROP_META[p.crop].hours;
    const age = world.hour - p.plantedHour;
    if (age >= grow) p.stage = 3;
    else if (age >= grow * 0.62) p.stage = 2;
    else p.stage = 1;
  }
}

function pathBesidePlot(world: World, tx: number, ty: number) {
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

export function commandPlant(world: World, tx: number, ty: number, crop: CropId) {
  const p = you(world);
  if (!p) return "You are not in the vale.";
  if (world.player.ghost) return "A ghost cannot.";
  if ((world.player.pack.hoe ?? 0) < 1) return "Need a hoe.";
  const bed = plotAt(world, tx, ty);
  if (!bed) return "That dirt is not a bed.";
  if (bed.crop) return bed.stage >= 3 ? "It is ripe. Take it." : "Something already grows.";
  const item = CROP_META[crop].item;
  if ((world.player.pack[item] ?? 0) < 1) return `Need ${ITEM_META[item].label.toLowerCase()}.`;
  world.player.intent = { kind: "plant", tx, ty, targetId: crop, spell: null };
  return pathBesidePlot(world, tx, ty);
}

export function commandHarvest(world: World, tx: number, ty: number) {
  const p = you(world);
  if (!p) return "You are not in the vale.";
  if (world.player.ghost) return "A ghost cannot.";
  if ((world.player.pack.hoe ?? 0) < 1) return "Need a hoe.";
  const bed = plotAt(world, tx, ty);
  if (!bed || !bed.crop) return "Nothing grows.";
  if (bed.stage < 3) return "Not yet.";
  world.player.intent = { kind: "harvest", tx, ty, targetId: bed.id, spell: null };
  return pathBesidePlot(world, tx, ty);
}

export function commandWorkPlot(world: World, tx: number, ty: number) {
  const bed = plotAt(world, tx, ty);
  if (!bed) return null;
  if (bed.crop && bed.stage >= 3) return commandHarvest(world, tx, ty);
  if (bed.crop) return "Not yet.";
  const crop = firstSeed(world);
  if (!crop) return "Need seed — cabbage, wheat, or garlic.";
  return commandPlant(world, tx, ty, crop);
}

export function plantNow(world: World) {
  const crop = world.player.intent.targetId as CropId;
  const meta = CROP_META[crop];
  const bed = plotAt(world, world.player.intent.tx, world.player.intent.ty);
  world.player.intent.kind = "none";
  if (!meta || !bed) return "The bed is gone.";
  if (bed.crop) return "Something already grows.";
  if ((world.player.pack[meta.item] ?? 0) < 1) return `Need ${ITEM_META[meta.item].label.toLowerCase()}.`;
  world.player.pack[meta.item] -= 1;
  bed.crop = crop;
  bed.plantedHour = world.hour;
  bed.stage = 1;
  playSfx("chop", 0.38);
  const gain = tryGain(world, "farming", true, true);
  noteDone(world, "plant");
  return gain ? `Sown. ${gain}.` : `The ${meta.label.toLowerCase()} takes the dirt.`;
}

export function harvestNow(world: World) {
  const bed =
    world.plots.find((p) => p.id === world.player.intent.targetId) ??
    plotAt(world, world.player.intent.tx, world.player.intent.ty);
  world.player.intent.kind = "none";
  if (!bed || !bed.crop || bed.stage < 3) return "Nothing ripe.";
  const meta = CROP_META[bed.crop];
  const chance = successChance(world.player.skills.farming, meta.diff);
  const ok = Math.random() < chance;
  const gain = tryGain(world, "farming", ok, true);
  playSfx("chop", 0.5);
  if (!ok) {
    bed.crop = null;
    bed.stage = 0;
    bed.plantedHour = 0;
    return gain ? `The crop breaks. ${gain}.` : "The crop breaks.";
  }
  const extra = Math.random() < 0.35 + world.player.skills.farming / 220 ? 1 : 0;
  const n = 2 + extra;
  world.player.pack[meta.item] = (world.player.pack[meta.item] ?? 0) + n;
  bed.crop = null;
  bed.stage = 0;
  bed.plantedHour = 0;
  noteDone(world, "harvest");
  const note = `${n} ${ITEM_META[meta.item].label.toLowerCase()}.`;
  return gain ? `${note} ${gain}.` : note;
}
