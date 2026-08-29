import { ITEM_META } from "./catalog";
import { astar, nearestWalkable, tileOf } from "./pathfinding";
import { successChance, tryGain } from "./skills";
import { playSfx } from "./vale-sfx";
import type { CropId, ItemId, World } from "./types";

const MAX_PLOTS = 40;

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
  { seed: ItemId; crop: ItemId; label: string; hours: number; diff: number; color: string; ripe: string }
> = {
  cabbage: { seed: "cabbage_seed", crop: "cabbage", label: "Cabbage", hours: 0.75, diff: 6, color: "#5a7040", ripe: "#6a8a48" },
  wheat: { seed: "wheat_seed", crop: "wheat", label: "Wheat", hours: 1.1, diff: 12, color: "#8a7040", ripe: "#c9a36a" },
  garlic: { seed: "garlic_seed", crop: "garlic", label: "Garlic", hours: 1.55, diff: 18, color: "#6a7a48", ripe: "#ece6d8" },
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
    if ((world.player.pack[CROP_META[id].seed] ?? 0) > 0) return id;
  }
  return null;
}

export function canTill(world: World, tx: number, ty: number): string | null {
  if (world.plots.length >= MAX_PLOTS) return "Forty beds is enough.";
  if (plotAt(world, tx, ty)) return "That dirt is already a bed.";
  const tile = world.tiles[ty]?.[tx];
  if (!tile) return "No footing.";
  if (tile.kind === "water" || tile.kind === "pit") return "The water will not take a bed.";
  if (tile.kind === "tree") return "The tree stands.";
  if (tile.kind === "rock") return "Stone will not take a seed.";
  if (tile.kind === "wall" || tile.kind === "floor" || tile.kind === "cobble" || tile.kind === "step") return "Not this stone.";
  if (tile.kind !== "grass" && tile.kind !== "dirt" && tile.kind !== "sand" && tile.kind !== "road") return "Not this dirt.";
  return null;
}

function makePlot(world: World, tx: number, ty: number) {
  const tile = world.tiles[ty]?.[tx];
  if (tile) {
    tile.kind = "dirt";
    world.scars[`${tx},${ty}`] = { kind: "dirt" };
  }
  world.plots.push({
    id: bedId(world),
    tx,
    ty,
    crop: null,
    plantedHour: 0,
    stage: 0,
  });
  world.landRev += 1;
}

export function seedFarmPlots(world: World, tx: number, ty: number) {
  if (world.plots.some((p) => Math.hypot(p.tx - tx, p.ty - ty) < 4.2)) return;
  for (const bed of FARM_BEDS) {
    const x = tx + bed.dx;
    const z = ty + bed.dz;
    if (plotAt(world, x, z)) continue;
    makePlot(world, x, z);
  }
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

export function commandTill(world: World, tx: number, ty: number) {
  const p = you(world);
  if (!p) return "You are not in the vale.";
  if (world.player.ghost) return "A ghost cannot.";
  if ((world.player.pack.hoe ?? 0) < 1) return "Need a hoe.";
  const err = canTill(world, tx, ty);
  if (err) return err;
  world.player.intent = { kind: "till", tx, ty, targetId: null, spell: null };
  return pathBesidePlot(world, tx, ty);
}

export function commandPlant(world: World, tx: number, ty: number, crop: CropId) {
  const p = you(world);
  if (!p) return "You are not in the vale.";
  if (world.player.ghost) return "A ghost cannot.";
  if ((world.player.pack.hoe ?? 0) < 1) return "Need a hoe.";
  const bed = plotAt(world, tx, ty);
  if (!bed) return "Till a plot first.";
  if (bed.crop) return bed.stage >= 3 ? "It is ripe. Take it." : "Something already grows.";
  const seed = CROP_META[crop].seed;
  if ((world.player.pack[seed] ?? 0) < 1) return `Need ${ITEM_META[seed].label.toLowerCase()}.`;
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

export function tillNow(world: World) {
  const { tx, ty } = world.player.intent;
  world.player.intent.kind = "none";
  const err = canTill(world, tx, ty);
  if (err) return err;
  makePlot(world, tx, ty);
  playSfx("chop", 0.4);
  const gain = tryGain(world, "farming", true, true);
  noteDone(world, "till");
  return gain ? `A bed. ${gain}.` : "The dirt is a bed.";
}

export function plantNow(world: World) {
  const crop = world.player.intent.targetId as CropId;
  const meta = CROP_META[crop];
  const bed = plotAt(world, world.player.intent.tx, world.player.intent.ty);
  world.player.intent.kind = "none";
  if (!meta || !bed) return "The bed is gone.";
  if (bed.crop) return "Something already grows.";
  if ((world.player.pack[meta.seed] ?? 0) < 1) return `Need ${ITEM_META[meta.seed].label.toLowerCase()}.`;
  world.player.pack[meta.seed] -= 1;
  bed.crop = crop;
  bed.plantedHour = world.hour;
  bed.stage = 1;
  playSfx("chop", 0.38);
  const gain = tryGain(world, "farming", true, true);
  noteDone(world, "plant");
  return gain ? `The seed takes. ${gain}.` : `The ${meta.label.toLowerCase()} seed takes the dirt.`;
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
  const extra = Math.random() < 0.4 + world.player.skills.farming / 200 ? 1 : 0;
  world.player.pack[meta.crop] = (world.player.pack[meta.crop] ?? 0) + 1;
  world.player.pack[meta.seed] = (world.player.pack[meta.seed] ?? 0) + 1 + extra;
  bed.crop = null;
  bed.stage = 0;
  bed.plantedHour = 0;
  noteDone(world, "harvest");
  const seeds = 1 + extra;
  const note = `1 ${ITEM_META[meta.crop].label.toLowerCase()}, ${seeds} seed${seeds === 1 ? "" : "s"}.`;
  return gain ? `${note} ${gain}.` : note;
}
