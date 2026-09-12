import { houseAt } from "./house.ts";
import type { World } from "./types.ts";
import type { TouchTile } from "./touch-hold.ts";

/** Only ordinary ground near a house; higher-priority resource/entity input stays unchanged. */
export function houseTouchTarget(world: World, { tx, ty }: TouchTile) {
  if (world.player.ghost || world.player.armedSpell) return null;
  const tile = world.tiles[ty]?.[tx];
  if (!tile || !["dirt", "grass", "sand", "snow", "road"].includes(tile.kind)) return null;
  if (world.piles.some(p => p.tx === tx && p.ty === ty)
    || world.herbs.some(h => h.tx === tx && h.ty === ty)
    || world.fauna.some(c => (Math.round(c.x) === tx && Math.round(c.z) === ty)
      || (c.task !== "dead" && Math.hypot(c.x - tx, c.z - ty) < 0.9))
    || world.people.some(p => !p.isPlayer && ((Math.round(p.x) === tx && Math.round(p.z) === ty)
      || Math.hypot(p.x - tx, p.z - ty) < 0.9))
    || world.plots.some(p => p.tx === tx && p.ty === ty)) return null;
  return houseAt(world, tx, ty, 2.6);
}
