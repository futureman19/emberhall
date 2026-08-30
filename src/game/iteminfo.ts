import { ITEM_META } from "./catalog.ts";
import { weaponDmg } from "./rare.ts";
import type { ItemId } from "./types.ts";

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
