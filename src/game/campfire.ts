import { you } from "./player.ts";
import type { World } from "./types.ts";
import { log } from "./world.ts";

/**
 * Campfires — the field kitchen. Three wood and a moment buys a fire
 * that burns for three hours; it cooks like a hearth and dies to
 * embers when its time is spent.
 */

/** How close you must stand to cook (matches the building reach scale). */
export const FIRE_REACH = 2.4;
/** Hours a campfire burns. */
export const FIRE_HOURS = 3;

let fireSeq = 0;

/** The lit fire near the player, if one burns within reach. */
export function litFireNear(world: World): boolean {
  const p = you(world);
  if (!p) return false;
  return world.campfires.some((f) => world.hour < f.until && Math.hypot(p.x - f.tx, p.z - f.ty) <= FIRE_REACH);
}

/** Light a new fire at the player's feet. */
export function placeCampfire(world: World): void {
  const p = you(world);
  if (!p) return;
  world.campfires.push({
    id: `fire_${world.hour}_${fireSeq++}`,
    tx: Math.round(p.x),
    ty: Math.round(p.z),
    until: world.hour + FIRE_HOURS,
  });
}

/** Burnout — dead fires leave the world with a word. */
export function tickCampfires(world: World): void {
  if (!world.campfires) world.campfires = [];
  const before = world.campfires.length;
  world.campfires = world.campfires.filter((f) => world.hour < f.until);
  if (world.campfires.length < before) log(world, "The campfire dies to embers.");
}
