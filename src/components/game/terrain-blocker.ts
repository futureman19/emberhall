import { buildingBox } from "../../game/building-size.ts";
import type { World } from "../../game/types.ts";

/** Snapshot for one synchronous scenery scan, never retained across frames. */
export function createTerrainBlocker(world: Pick<World, "plots" | "buildings">) {
  const boxes = world.buildings.map((b) => buildingBox(b.kind, b.tx, b.ty));
  const plots = new Map<number, Set<number>>();
  for (const p of world.plots ?? []) {
    if (Number.isNaN(p.tx) || Number.isNaN(p.ty)) continue;
    let row = plots.get(p.ty);
    if (!row) plots.set(p.ty, (row = new Set()));
    row.add(p.tx);
  }
  return (tx: number, ty: number): boolean => {
    if (plots.get(ty)?.has(tx)) return true;
    for (const box of boxes) {
      if (tx + 0.5 > box.x0 && tx + 0.5 < box.x1 && ty + 0.5 > box.z0 && ty + 0.5 < box.z1) return true;
    }
    return false;
  };
}
