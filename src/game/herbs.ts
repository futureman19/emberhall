import { MAP } from "./atlas.ts";
import { biomeAt } from "./biome.ts";
import { ITEM_META } from "./catalog.ts";
import { astar, nearestWalkable, tileOf, walkable } from "./pathfinding.ts";
import { mulberry32 } from "./rng.ts";
import { playSfx } from "./vale-sfx.ts";
import type { HerbKind, ItemId, Person, World } from "./types.ts";

/**
 * Wild reagents — the vale keeps its own dust. Herb patches grow where the
 * land suits them: blood moss in the fen, mandrake under the taiga pines,
 * ginseng in the open meadows, sulfurous ash in the eastern sands, black
 * pearls where the water curls. A picked patch goes dormant and regrows
 * in about a day. Plant-tasting kinds sometimes yield a seed — carry it
 * home and the farm beds learn the herb (see farm.ts reagent crops).
 */

export const HERB_REGROW_HOURS = 22;
/** Stand this close (or closer) to pluck. */
export const PICK_REACH = 1.8;
/** Chance a plucked herb comes with a second pinch. */
const DOUBLE_PINCH = 0.45;
/** Chance a plantable herb brings its seed up with the roots. */
const SEED_CHANCE = 0.24;

export const HERB_ORDER: HerbKind[] = ["moss", "mandrake", "ginseng", "ash", "pearl"];

export const HERB_META: Record<
  HerbKind,
  { item: ItemId; seed: ItemId | null; label: string; patches: number; pickNote: string }
> = {
  moss: { item: "moss", seed: "moss_seed", label: "blood moss", patches: 14, pickNote: "The peat gives it up dark and wet." },
  mandrake: { item: "mandrake", seed: "mandrake_seed", label: "mandrake", patches: 12, pickNote: "The root comes up screaming small." },
  ginseng: { item: "ginseng", seed: "ginseng_seed", label: "ginseng", patches: 12, pickNote: "The little man-root rests in your palm." },
  ash: { item: "ash", seed: null, label: "sulfurous ash", patches: 12, pickNote: "The crystals reek of the deep fire." },
  pearl: { item: "pearl", seed: null, label: "black pearl", patches: 12, pickNote: "The shell opens on a drop of night." },
};

function self(world: World): Person | null {
  return world.people.find((p) => p.isPlayer) ?? world.people.find((p) => p.id === world.player.id) ?? null;
}

/** Is the wild patch ready to pick right now? */
export function herbReady(world: World, patch: { until: number }): boolean {
  return world.hour >= patch.until;
}

function openGround(world: World, tx: number, ty: number): boolean {
  const t = world.tiles[ty]?.[tx];
  if (!t) return false;
  if (!walkable(world, tx, ty)) return false;
  return t.kind === "grass" || t.kind === "dirt" || t.kind === "sand" || t.kind === "marsh";
}

function nearWater(world: World, tx: number, ty: number): boolean {
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (world.tiles[ty + dz]?.[tx + dx]?.kind === "water") return true;
    }
  }
  return false;
}

/** Land-suitability per kind — the flavor rule the whole feature hangs on. */
export function herbSuits(world: World, kind: HerbKind, tx: number, ty: number): boolean {
  if (!openGround(world, tx, ty)) return false;
  const tile = world.tiles[ty]?.[tx];
  if (!tile) return false;
  const biome = biomeAt(tx, ty);
  if (kind === "moss") return biome === "fen" || tile.kind === "marsh";
  if (kind === "mandrake") return biome === "taiga" && tile.kind !== "sand";
  if (kind === "ginseng") return biome === "vale" && (tile.kind === "grass" || tile.kind === "dirt");
  if (kind === "ash") return biome === "desert";
  if (kind === "pearl") return nearWater(world, tx, ty);
  return false;
}

/**
 * Scatter the wild patches. Idempotent — a world that already knows its
 * herbs keeps them (old saves get their scatter once, from withFauna).
 * Rare-biome kinds (taiga, fen, shoreline) are a rounding error of the map,
 * so rejection sampling starves them — instead bucket every suitable tile
 * in one pass, shuffle, and place with breathing room between patches.
 */
export function ensureHerbs(world: World): void {
  if (!world.herbs) world.herbs = [];
  if (world.herbs.length) return;
  const cand: Record<HerbKind, { tx: number; ty: number }[]> = {
    moss: [],
    mandrake: [],
    ginseng: [],
    ash: [],
    pearl: [],
  };
  for (let ty = 1; ty < MAP - 1; ty++) {
    for (let tx = 1; tx < MAP - 1; tx++) {
      if (!openGround(world, tx, ty)) continue;
      for (const kind of HERB_ORDER) {
        if (herbSuits(world, kind, tx, ty)) cand[kind].push({ tx, ty });
      }
    }
  }
  const rng = mulberry32(world.seed + 7331);
  let seq = 0;
  for (const kind of HERB_ORDER) {
    const list = cand[kind];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    let placed = 0;
    for (const c of list) {
      if (placed >= HERB_META[kind].patches) break;
      if (world.herbs.some((h) => Math.abs(h.tx - c.tx) + Math.abs(h.ty - c.ty) < 5)) continue;
      world.herbs.push({ id: `herb_${seq++}`, kind, tx: c.tx, ty: c.ty, until: 0 });
      placed++;
    }
  }
}

export function herbAt(world: World, tx: number, ty: number) {
  return world.herbs?.find((h) => h.tx === tx && h.ty === ty) ?? null;
}

function pathTo(world: World, p: Person, tx: number, ty: number): string | null {
  const dest = nearestWalkable(world, tx, ty);
  if (!dest) return "No footing.";
  const from = tileOf(p.x, p.z);
  const path = astar(world, from.tx, from.ty, dest.x, dest.y);
  if (!path) return "The way is closed.";
  p.path = path.map((n) => ({ tx: n.x, ty: n.y }));
  return null;
}

/** Right-click "Pick" (or a tap on the patch): walk over and pluck it. */
export function commandPick(world: World, patchId: string): string | null {
  const p = self(world);
  if (!p) return "You are not in the vale.";
  if (p.ghost || world.player.ghost) return "A ghost cannot.";
  const patch = world.herbs?.find((h) => h.id === patchId);
  if (!patch) return "Nothing grows there.";
  const meta = HERB_META[patch.kind];
  if (!herbReady(world, patch)) return `The ${meta.label} is picked clean.`;
  world.player.intent = { kind: "pick", tx: patch.tx, ty: patch.ty, targetId: patch.id, spell: null };
  if (Math.hypot(p.x - patch.tx, p.z - patch.ty) > PICK_REACH) return pathTo(world, p, patch.tx, patch.ty);
  p.path = [];
  return null;
}

/** The work-beat lands — the pluck itself. */
export function pickNow(world: World): string {
  const patch = world.herbs?.find((h) => h.id === world.player.intent.targetId);
  world.player.intent.kind = "none";
  if (!patch) return "Nothing grows there.";
  const p = self(world);
  if (!p) return "You are not in the vale.";
  if (Math.hypot(p.x - patch.tx, p.z - patch.ty) > PICK_REACH + 0.6) return "Too far.";
  const meta = HERB_META[patch.kind];
  if (!herbReady(world, patch)) return `The ${meta.label} is picked clean.`;
  patch.until = world.hour + HERB_REGROW_HOURS;
  const n = 1 + (Math.random() < DOUBLE_PINCH ? 1 : 0);
  world.player.pack[meta.item] = (world.player.pack[meta.item] ?? 0) + n;
  playSfx("chop", 0.3);
  const itemLabel = ITEM_META[meta.item].label.toLowerCase();
  let note = `You pluck ${n > 1 ? `${n} ` : ""}${itemLabel}. ${meta.pickNote}`;
  if (meta.seed && Math.random() < SEED_CHANCE) {
    world.player.pack[meta.seed] = (world.player.pack[meta.seed] ?? 0) + 1;
    note += ` A ${ITEM_META[meta.seed].label.toLowerCase()} comes with the roots.`;
  }
  return note;
}
