import { playSfx } from "./vale-sfx.ts";
import { completeObjective, nid } from "./world.ts";
import { FAUNA_META } from "./catalog.ts";
import { emitCorpseFx } from "./corpse-animation.ts";
import type { Creature, GroundPile, ItemId, World } from "./types.ts";

export function addToPile(
  world: World,
  tx: number,
  ty: number,
  items: Partial<Record<ItemId, number>>,
  source: GroundPile["source"],
  until: number,
  label: string,
  gold = 0,
) {
  if (!world.piles) world.piles = [];
  const exist = world.piles.find((p) => p.tx === tx && p.ty === ty && world.hour < p.until);
  if (exist) {
    for (const [k, v] of Object.entries(items)) {
      const id = k as ItemId;
      exist.items[id] = (exist.items[id] ?? 0) + (v ?? 0);
    }
    exist.gold += gold;
    exist.until = Math.max(exist.until, until);
    exist.label = label;
    return exist;
  }
  const pile: GroundPile = {
    id: nid(world, "pile"),
    tx,
    ty,
    items: { ...items },
    gold,
    until,
    source,
    label,
  };
  world.piles.push(pile);
  return pile;
}

function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * What the fallen carried, spilled where they died — rolled from the
 * loot table. The butcher's share (hide and meat) is NOT here: that
 * belongs to skinning. A creature with nothing to leave makes no pile.
 */
export function spawnCorpsePile(world: World, c: Creature) {
  const meta = FAUNA_META[c.kind];
  const items: Partial<Record<ItemId, number>> = {};
  for (const d of meta.loot ?? []) {
    if (Math.random() < d.chance) items[d.item] = (items[d.item] ?? 0) + randInt(d.min, d.max);
  }
  const g = meta.gold;
  const gold = g && Math.random() < g.chance ? randInt(g.min, g.max) : 0;
  if (Object.keys(items).length === 0 && gold === 0) return;
  addToPile(world, Math.round(c.x), Math.round(c.z), items, "corpse", world.hour + 8, `${c.kind} corpse`, gold);
}

/** Lift just the coin from a pile, leaving the rest. */
export function takeGoldFromPile(world: World, id: string) {
  const pile = world.piles.find((p) => p.id === id);
  if (!pile || pile.gold <= 0) return 0;
  world.gold += pile.gold;
  const taken = pile.gold;
  const corpseSource = pile.source === "corpse" || pile.source === "death";
  const { tx, ty } = pile;
  pile.gold = 0;
  const left = Object.values(pile.items).some((n) => (n ?? 0) > 0);
  if (!left) world.piles = world.piles.filter((p) => p.id !== id);
  if (corpseSource) emitCorpseFx(world, "looting", id, tx, ty);
  return taken;
}

export function tickPiles(world: World) {
  if (!world.piles) world.piles = [];
  world.piles = world.piles.filter((p) => world.hour < p.until);
  if (world.player.corpseAt) {
    const at = world.player.corpseAt;
    const still = world.piles.some((p) => p.source === "death" && p.tx === at.tx && p.ty === at.ty);
    if (!still) world.player.corpseAt = null;
  }
}

export function takeFromPile(world: World, pileId: string, item?: ItemId) {
  if (world.player.ghost) return "A ghost cannot lift.";
  const pile = world.piles.find((p) => p.id === pileId);
  if (!pile) return "Nothing there.";
  const corpseSource = pile.source === "corpse" || pile.source === "death";
  const { tx, ty } = pile;
  if (item) {
    const n = pile.items[item] ?? 0;
    if (n < 1) return "Gone.";
    pile.items[item] = n - 1;
    world.player.pack[item] = (world.player.pack[item] ?? 0) + 1;
    if (item === "relic") completeObjective(world, "relic");
  } else {
    for (const [k, v] of Object.entries(pile.items)) {
      if (!v) continue;
      const id = k as ItemId;
      world.player.pack[id] = (world.player.pack[id] ?? 0) + v;
      if (id === "relic") completeObjective(world, "relic");
    }
    world.gold += pile.gold;
    pile.items = {};
    pile.gold = 0;
  }
  const left = Object.values(pile.items).some((n) => (n ?? 0) > 0) || pile.gold > 0;
  if (!left) {
    if (pile.source === "death") {
      completeObjective(world, "recover");
      world.player.corpseAt = null;
    }
    world.piles = world.piles.filter((p) => p.id !== pileId);
  } else if (pile.source === "death") completeObjective(world, "recover");
  playSfx("loot", 0.38);
  if (corpseSource) emitCorpseFx(world, "looting", pileId, tx, ty);
  return null;
}
