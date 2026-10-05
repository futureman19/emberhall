import { groundY } from "../../game/height.ts";
import type { World } from "../../game/types.ts";

/** Render-only distant surface; gameplay ground sampling remains unchanged. */
export function horizonSurfaceY(world: World, x: number, z: number, distance: number) {
  // Match groundY's bilinear footprint instead of rounding the tile kind:
  // that would create a new half-tile step at every shoreline.
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const wet00 = world.tiles[z0]?.[x0]?.kind === "water" ? 1 : 0;
  const wet10 = world.tiles[z0]?.[x0 + 1]?.kind === "water" ? 1 : 0;
  const wet01 = world.tiles[z0 + 1]?.[x0]?.kind === "water" ? 1 : 0;
  const wet11 = world.tiles[z0 + 1]?.[x0 + 1]?.kind === "water" ? 1 : 0;
  const wet = wet00 * (1 - fx) * (1 - fz) + wet10 * fx * (1 - fz)
    + wet01 * (1 - fx) * fz + wet11 * fx * fz;
  const lift = 1 + Math.max(0, distance - 50) / 320 * 0.5 * (1 - wet);
  return groundY(world, x, z) * lift - 0.08;
}
