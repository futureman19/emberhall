import { EH, MAP } from "./atlas.ts";
import type { World } from "./types.ts";

function rawH(world: World, tx: number, ty: number) {
  if (tx < 0 || ty < 0 || tx >= MAP || ty >= MAP) return 0;
  return world.tiles[ty]?.[tx]?.h ?? 0;
}

export function smoothH(world: World, tx: number, ty: number) {
  if (tx < 0 || ty < 0 || tx >= MAP || ty >= MAP) return 0;
  const t = world.tiles[ty]?.[tx];
  if (!t) return 0;
  if (t.kind === "water" || t.kind === "pit" || t.kind === "wall") return t.h;
  const c = t.h;
  return (c * 4 + rawH(world, tx - 1, ty) + rawH(world, tx + 1, ty) + rawH(world, tx, ty - 1) + rawH(world, tx, ty + 1)) / 8;
}

export function groundY(world: World, x: number, z: number) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const h00 = smoothH(world, x0, z0);
  const h10 = smoothH(world, x0 + 1, z0);
  const h01 = smoothH(world, x0, z0 + 1);
  const h11 = smoothH(world, x0 + 1, z0 + 1);
  const h = h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz;
  return h * EH;
}
