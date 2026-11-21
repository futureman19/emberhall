/**
 * Verb candidates — the legal-action menu a brain chooses from.
 *
 * Target enumeration mirrors `src/components/game/actions-targets.ts` (same
 * CtxTarget identities the pointer path builds) but reads a World directly
 * instead of the React snapshot. Verbs themselves come from the ONE source
 * of truth, `verbsFor` in ../context.ts — never a parallel rules copy.
 *
 * Phase 0 constraint: `verbsFor` reads the live world (`getWorld()`), so the
 * caller's world must be the live one (tests: `setWorld(world)` first). The
 * multi-body refactor parameterizes `verbsFor(world, actor, target)` and
 * lifts this constraint.
 *
 * Note: like the UI's own menu, `verbsFor` may record resource-node
 * discoveries on the world while labeling (see harvestVerbLabel).
 */
import { verbsFor } from "../context.ts";
import { CROP_META } from "../farm.ts";
import { HERB_META } from "../herbs.ts";
import { getWorld } from "../live.ts";
import type { CtxTarget, TileKind, World } from "../types.ts";
import type { VerbCandidate } from "./types.ts";

/** Entities within this radius get menu targets. */
export const AGENT_MENU_RADIUS = 12;
/** Ground tiles within this radius (walk/dig/till/track/chop/mine/fish). */
const TILE_MENU_RADIUS = 2;

const RESOURCE_TILE_LABEL: Partial<Record<TileKind, string>> = {
  tree: "tree",
  rock: "rock",
  water: "water",
};

/** Ground kinds worth a menu tile (walk, dig, till, track live on these). */
const GROUND_TILE_LABEL: Partial<Record<TileKind, string>> = {
  grass: "grass",
  dirt: "dirt",
  sand: "sand",
  snow: "snow",
  marsh: "marsh",
  cobble: "cobble",
  road: "road",
  pit: "pit",
};

export function candidateTargets(world: World, radius = AGENT_MENU_RADIUS): CtxTarget[] {
  const me = world.people.find((p) => p.isPlayer);
  const px = me?.x ?? 0;
  const pz = me?.z ?? 0;
  const near = (tx: number, ty: number) => Math.hypot(tx - px, ty - pz) <= radius;
  const out: CtxTarget[] = [];

  for (const p of world.people) {
    if (p.isPlayer) continue;
    const tx = Math.round(p.x);
    const ty = Math.round(p.z);
    if (near(tx, ty)) out.push({ kind: "person", id: p.id, tx, ty, label: p.name });
  }
  for (const c of world.fauna) {
    const tx = Math.round(c.x);
    const ty = Math.round(c.z);
    if (near(tx, ty)) out.push({ kind: "fauna", id: c.id, tx, ty, label: c.name ?? c.kind });
  }
  for (const pile of world.piles) {
    if (near(pile.tx, pile.ty)) out.push({ kind: "pile", id: pile.id, tx: pile.tx, ty: pile.ty, label: pile.label });
  }
  for (const herb of world.herbs ?? []) {
    if (near(herb.tx, herb.ty)) {
      out.push({ kind: "herb", id: herb.id, tx: herb.tx, ty: herb.ty, label: HERB_META[herb.kind].label });
    }
  }
  for (const bed of world.plots) {
    if (near(bed.tx, bed.ty)) {
      out.push({
        kind: "plot",
        id: bed.id,
        tx: bed.tx,
        ty: bed.ty,
        label: bed.crop ? CROP_META[bed.crop].label : "bed",
      });
    }
  }
  for (const b of world.buildings) {
    if (near(b.tx, b.ty)) out.push({ kind: "building", id: b.id, tx: b.tx, ty: b.ty, label: b.kind });
  }

  const cx = Math.round(px);
  const cy = Math.round(pz);
  for (let ty = cy - TILE_MENU_RADIUS; ty <= cy + TILE_MENU_RADIUS; ty++) {
    for (let tx = cx - TILE_MENU_RADIUS; tx <= cx + TILE_MENU_RADIUS; tx++) {
      const tile = world.tiles[ty]?.[tx];
      if (!tile) continue;
      const label = RESOURCE_TILE_LABEL[tile.kind] ?? GROUND_TILE_LABEL[tile.kind];
      if (label) out.push({ kind: "tile", id: `${tx},${ty}`, tx, ty, label });
    }
  }
  return out;
}

/** The full legal menu: every verb every nearby target affords right now. */
export function candidatesForPlayer(world?: World, radius = AGENT_MENU_RADIUS): VerbCandidate[] {
  const w = world ?? getWorld();
  if (getWorld() !== w) {
    throw new Error(
      "candidatesForPlayer reads the live world; call setWorld(world) first " +
        "(verbsFor is player-centric until the multi-body refactor lands).",
    );
  }
  const out: VerbCandidate[] = [];
  for (const target of candidateTargets(w, radius)) {
    for (const v of verbsFor(target)) out.push({ verb: v.verb, label: v.label, target });
  }
  return out;
}
