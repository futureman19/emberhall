import { ITEM_META } from "./catalog.ts";
import { plotAt } from "./farm.ts";
import { astar, nearestWalkable, tileOf } from "./pathfinding.ts";
import { RESOURCE_CATALOG, RESOURCE_IDS } from "./resources/catalog.ts";
import type { ResourceId } from "./resources/types.ts";
import { tryGain } from "./skills.ts";
import { playSfx } from "./vale-sfx.ts";
import { completeObjective, log } from "./world.ts";
import type { Sapling, World } from "./types.ts";

export const MAX_SAPLINGS = 40;
/** Game hours from acorn to a standing tree. Rain shortens it. */
export const TREE_HOURS = 1.6;

function you(world: World) {
  return world.people.find((p) => p.isPlayer) ?? world.people.find((p) => p.id === world.player.id) ?? null;
}

/** Plant gate is the catalog extract threshold — new timber joins this ladder automatically. */
export function plantSkillFor(resourceId: ResourceId) {
  const spawn = RESOURCE_CATALOG[resourceId].spawn;
  if (!spawn || spawn.nodeKind !== "tree") return Infinity;
  return spawn.extractSkill.minimum;
}

export function timberSpecies(): ResourceId[] {
  return RESOURCE_IDS.filter((id) => RESOURCE_CATALOG[id].spawn?.nodeKind === "tree").sort(
    (a, b) => plantSkillFor(a) - plantSkillFor(b),
  );
}

export function plantableTimber(forestry: number): ResourceId[] {
  return timberSpecies().filter((id) => forestry >= plantSkillFor(id));
}

export function bestPlantableTimber(forestry: number): ResourceId | null {
  const list = plantableTimber(forestry);
  return list.at(-1) ?? null;
}

export function isTimberId(value: string | null | undefined): value is ResourceId {
  return Boolean(value && timberSpecies().includes(value as ResourceId));
}

export function saplingAt(world: World, tx: number, ty: number) {
  return (world.saplings ?? []).find((s) => s.tx === tx && s.ty === ty) ?? null;
}

export function canPlantTree(world: World, tx: number, ty: number): string | null {
  if ((world.saplings ?? []).length >= MAX_SAPLINGS) return "The vale has enough young trees.";
  if (saplingAt(world, tx, ty)) return "A sapling already grows.";
  if (plotAt(world, tx, ty)) return "That dirt is a bed.";
  const tile = world.tiles[ty]?.[tx];
  if (!tile) return "No footing.";
  if (tile.kind === "tree") return "The tree stands.";
  if (tile.kind === "rock") return "Stone will not take an acorn.";
  if (tile.kind === "water" || tile.kind === "pit") return "The water will not take an acorn.";
  if (tile.kind === "wall" || tile.kind === "floor" || tile.kind === "cobble" || tile.kind === "step") return "Not this stone.";
  if (tile.kind === "snow") return "The frost will not take an acorn.";
  if (tile.kind === "marsh") return "The peat is too wet.";
  if (tile.kind === "road") return "The road will not take a tree.";
  if (tile.kind !== "grass" && tile.kind !== "dirt") return "Not this dirt.";
  return null;
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

export function commandPlantTree(world: World, tx: number, ty: number) {
  const p = you(world);
  if (!p) return "You are not in the vale.";
  if (world.player.ghost) return "A ghost cannot.";
  if ((world.player.pack.acorn ?? 0) < 1) return `Need ${ITEM_META.acorn.label.toLowerCase()}.`;
  const species = bestPlantableTimber(world.player.skills.forestry ?? 0);
  if (!species) return "Forestry is not yet taught.";
  const err = canPlantTree(world, tx, ty);
  if (err) return err;
  world.player.intent = { kind: "forest", tx, ty, targetId: species, spell: null };
  return pathBeside(world, tx, ty);
}

export function plantTreeNow(world: World) {
  const { tx, ty, targetId } = world.player.intent;
  world.player.intent.kind = "none";
  if ((world.player.pack.acorn ?? 0) < 1) return `Need ${ITEM_META.acorn.label.toLowerCase()}.`;
  const forestry = world.player.skills.forestry ?? 0;
  const species = isTimberId(targetId) && forestry >= plantSkillFor(targetId) ? targetId : bestPlantableTimber(forestry);
  if (!species) return "Forestry is not yet taught.";
  const err = canPlantTree(world, tx, ty);
  if (err) return err;
  world.player.pack.acorn -= 1;
  if (!world.saplings) world.saplings = [];
  const sapling: Sapling = {
    id: `sap-${world.tickCount}-${world.saplings.length}-${world.seed}`,
    tx,
    ty,
    plantedHour: world.hour,
    stage: 1,
    resourceId: species,
  };
  world.saplings.push(sapling);
  playSfx("chop", 0.36);
  completeObjective(world, "forest");
  const next = timberSpecies().find((id) => plantSkillFor(id) > forestry);
  const inBand = !next || forestry + 20 >= plantSkillFor(next);
  const gain = tryGain(world, "forestry", true, inBand);
  const label = RESOURCE_CATALOG[species].label.toLowerCase();
  return gain ? `The ${label} takes. ${gain}.` : `The ${label} takes the dirt.`;
}

function raiseTree(world: World, sapling: Sapling) {
  const tile = world.tiles[sapling.ty]?.[sapling.tx];
  const species = isTimberId(sapling.resourceId) ? sapling.resourceId : "oak";
  if (tile) {
    tile.kind = "tree";
    world.scars[`${sapling.tx},${sapling.ty}`] = { kind: "tree" };
    world.landRev += 1;
  }
  if (!world.plantedTimber) world.plantedTimber = {};
  world.plantedTimber[`${sapling.tx},${sapling.ty}`] = species;
  world.saplings = (world.saplings ?? []).filter((s) => s.id !== sapling.id);
  log(world, `A sapling stands as ${RESOURCE_CATALOG[species].label.toLowerCase()}.`);
}

export function tickSaplings(world: World) {
  if (!world.saplings?.length) return;
  const watered = Boolean(world.weather && world.weather.wet >= 0.35);
  const grow = TREE_HOURS * (watered ? 0.75 : 1);
  for (const s of [...world.saplings]) {
    const age = world.hour - s.plantedHour;
    if (age >= grow) raiseTree(world, s);
    else if (age >= grow * 0.62) s.stage = 2;
    else s.stage = 1;
  }
}

export function plantVerbLabel(forestry: number) {
  const species = bestPlantableTimber(forestry);
  if (!species) return "Plant acorn";
  return `Plant ${RESOURCE_CATALOG[species].label.toLowerCase()}`;
}
