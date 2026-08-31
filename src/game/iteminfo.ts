import { ITEM_META } from "./catalog.ts";
import { AFFIXES, rareName, weaponDmg } from "./rare.ts";
import type { ItemId, RareItem, World } from "./types.ts";

/**
 * Item info lines — the tooltip backbone. Everything an item wants to
 * say about itself, as short rows: what it does, what it's made of,
 * what the shop thinks it's worth.
 */

/** Combat stats worth showing, if the item has any. */
export function statLines(id: ItemId): string[] {
  const out: string[] = [];
  const meta = ITEM_META[id];
  const isWeapon = meta.tags.includes("weapon") || meta.tags.includes("blade");
  if (isWeapon) {
    const dmg = weaponDmg(id);
    if (dmg > 2) out.push(`${dmg} damage`);
    else if (dmg === 2) out.push("2 damage — barely a weapon");
  }
  if (meta.armor > 0) out.push(`${meta.armor} armor`);
  if (meta.tool) out.push("a tool");
  return out;
}

/** The resource tags, readable. */
export function tagLine(id: ItemId): string {
  return ITEM_META[id].tags.join(" · ");
}

/** Shop worth, when there is any. */
export function worthLine(id: ItemId): string | null {
  const meta = ITEM_META[id];
  if (meta.buy > 0 && meta.sell > 0) return `shops: buy ${meta.buy}g · sell ${meta.sell}g`;
  if (meta.sell > 0) return `shops pay ${meta.sell}g`;
  return null;
}

/** How a worn rare (or hovered one) shifts a stat beyond its base. */
function rareBonus(rare: RareItem, key: "dmg" | "armor"): number {
  return rare.affixes.reduce((sum, a) => sum + (AFFIXES[a]?.[key] ?? 0), 0);
}

function rareDamage(rare: RareItem): number {
  return rare.resolvedStats?.damage ?? weaponDmg(rare.base) + rareBonus(rare, "dmg");
}

function rareArmor(rare: RareItem): number {
  return rare.resolvedStats?.armor ?? ITEM_META[rare.base].armor + rareBonus(rare, "armor");
}

const ALL_SLOTS = ["main", "off", "head", "neck", "chest", "cloak", "hands", "finger", "legs", "feet"] as const;

export interface DressedStats {
  /** Main-hand damage, affixes included (bare hands = 2). */
  dmg: number;
  /** Total armor across every slot, affixes included. */
  armor: number;
  /** What the hand holds, readable ("a sword", a rare's name, "bare hands"). */
  mainLabel: string;
}

/** One glance at how the body is dressed — the paperdoll's battle line. */
export function dressedStats(world: World): DressedStats {
  const { wear, wearRare, rares } = world.player;
  const wornMainRare = wearRare.main ? (rares.find((r) => r.uid === wearRare.main) ?? null) : null;
  const mainId = wornMainRare ? wornMainRare.base : (wear.main ?? null);
  const dmg = wornMainRare ? rareDamage(wornMainRare) : weaponDmg(mainId);
  const mainLabel = wornMainRare ? rareName(wornMainRare) : mainId ? ITEM_META[mainId].label : "bare hands";
  let armor = 0;
  for (const slot of ALL_SLOTS) {
    const uid = wearRare[slot];
    const rare = uid ? (rares.find((r) => r.uid === uid) ?? null) : null;
    if (rare) armor += rareArmor(rare);
    else {
      const id = wear[slot];
      if (id) armor += ITEM_META[id].armor ?? 0;
    }
  }
  return { dmg, armor, mainLabel };
}

export interface GearCmp {
  stat: "damage" | "armor";
  delta: number;
  /** What the slot holds now ("your sword", "bare hands", "nothing"). */
  vsLabel: string;
}

/**
 * Gear compare — hover an equippable and learn whether it's a step up
 * or a step down from what the slot wears right now. Weapons compare
 * damage, everything worn compares armor; rares count their affixes.
 * Returns null when there is nothing meaningful to say.
 */
export function gearCompare(world: World, id: ItemId, rare?: RareItem | null): GearCmp | null {
  const meta = ITEM_META[id];
  const slot = meta.slot;
  if (!slot) return null;

  const wornRareUid = world.player.wearRare[slot];
  const wornRare = wornRareUid ? (world.player.rares.find((r) => r.uid === wornRareUid) ?? null) : null;
  if (rare && wornRare && wornRare.uid === rare.uid) return null; // already wearing this very wonder
  const wornId = wornRare ? wornRare.base : (world.player.wear[slot] ?? null);
  const vsLabel = wornRare ? rareName(wornRare) : wornId ? `your ${ITEM_META[wornId].label.toLowerCase()}` : null;

  if (slot === "main") {
    const mine = rare ? rareDamage(rare) : weaponDmg(id);
    const theirs = wornRare
      ? rareDamage(wornRare)
      : weaponDmg(wornId); // null → bare hands, 2
    return { stat: "damage", delta: mine - theirs, vsLabel: vsLabel ?? "bare hands" };
  }

  const mine = rare ? rareArmor(rare) : meta.armor;
  const theirs = wornRare
    ? rareArmor(wornRare)
    : wornId
      ? (ITEM_META[wornId].armor ?? 0)
      : 0;
  if (mine === 0 && theirs === 0) return null; // jewelry & trinkets: no tale to tell
  return { stat: "armor", delta: mine - theirs, vsLabel: vsLabel ?? "nothing" };
}
