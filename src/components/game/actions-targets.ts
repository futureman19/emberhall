import { CROP_META } from "@/game/farm";
import { HERB_META } from "@/game/herbs";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import type { CtxTarget, TileKind } from "@/game/types";

export const PANEL_RADIUS = 6;
export const PANEL_MAX_TARGETS = 12;

export type NearbyTarget = { target: CtxTarget; distance: number };

const RESOURCE_TILE_LABEL: Partial<Record<TileKind, string>> = {
  tree: "tree",
  rock: "rock",
  water: "water",
};

/** Everything within reach that has a verb, nearest first. The same
 *  CtxTarget identities the pointer path builds — the verbs run the same
 *  commands, never a parallel simulation. */
export function nearbyTargets(radius = PANEL_RADIUS): NearbyTarget[] {
  const snap = useGame.getState().snap;
  const px = snap.youX;
  const pz = snap.youZ;
  const out: NearbyTarget[] = [];
  const dist = (tx: number, ty: number) => Math.hypot(tx - px, ty - pz);
  const push = (target: CtxTarget) => {
    const distance = dist(target.tx, target.ty);
    if (distance <= radius) out.push({ target, distance });
  };
  for (const p of snap.people) {
    if (p.isPlayer) continue;
    push({ kind: "person", id: p.id, tx: Math.round(p.x), ty: Math.round(p.z), label: p.name });
  }
  for (const c of snap.fauna) {
    push({ kind: "fauna", id: c.id, tx: Math.round(c.x), ty: Math.round(c.z), label: c.name ?? c.kind });
  }
  for (const pile of snap.piles) {
    push({ kind: "pile", id: pile.id, tx: pile.tx, ty: pile.ty, label: pile.label });
  }
  for (const herb of snap.herbs) {
    push({ kind: "herb", id: herb.id, tx: herb.tx, ty: herb.ty, label: HERB_META[herb.kind].label });
  }
  for (const bed of snap.plots) {
    push({
      kind: "plot",
      id: bed.id,
      tx: bed.tx,
      ty: bed.ty,
      label: bed.crop ? CROP_META[bed.crop].label : "bed",
    });
  }
  // Resource tiles: chop, mine, fish — the first gathering actions.
  const w = getWorld();
  const reach = Math.ceil(radius);
  for (let ty = Math.floor(pz) - reach; ty <= Math.floor(pz) + reach; ty++) {
    for (let tx = Math.floor(px) - reach; tx <= Math.floor(px) + reach; tx++) {
      const tile = w.tiles[ty]?.[tx];
      const label = tile ? RESOURCE_TILE_LABEL[tile.kind] : undefined;
      if (label) push({ kind: "tile", id: `${tx},${ty}`, tx, ty, label });
    }
  }
  return out.sort((a, b) => a.distance - b.distance).slice(0, PANEL_MAX_TARGETS);
}
