import { ITEM_META } from "./catalog.ts";
import type { ItemId, WearSlot, World } from "./types.ts";

/** Capture identity, not just a slot: a stale menu/drag must not stow its replacement. */
export type EquipmentSource =
  | { kind: "pack"; id: ItemId }
  | { kind: "rare"; uid: string }
  | { kind: "worn"; slot: WearSlot; id?: ItemId; uid?: string };
export type EquipmentTarget = WearSlot | "pack";
export type EquipmentAction =
  | { kind: "equip"; id: ItemId }
  | { kind: "rare"; uid: string }
  | { kind: "stow"; slot: WearSlot };

type EquipmentInventory = Pick<World["player"], "pack" | "wear" | "wearRare" | "rares">;

export function equipmentTarget(player: EquipmentInventory, source: EquipmentSource): EquipmentTarget | null {
  if (source.kind === "worn") return "pack";
  const id = source.kind === "pack" ? source.id : player.rares.find((r) => r.uid === source.uid)?.base;
  return id ? ITEM_META[id].slot ?? null : null;
}

/** Resolve again at commit time. Transfers never create world drops or reorder the pack. */
export function equipmentAction(player: EquipmentInventory, ghost: boolean, source: EquipmentSource, target: EquipmentTarget | null): EquipmentAction | null {
  if (ghost || !target || equipmentTarget(player, source) !== target) return null;
  if (source.kind === "worn") {
    const matches = source.uid
      ? player.wearRare[source.slot] === source.uid
      : Boolean(source.id) && player.wear[source.slot] === source.id && !player.wearRare[source.slot];
    return matches ? { kind: "stow", slot: source.slot } : null;
  }
  if (source.kind === "rare") {
    return Object.values(player.wearRare).includes(source.uid) ? null : { kind: "rare", uid: source.uid };
  }
  return (player.pack[source.id] ?? 0) > 0 ? { kind: "equip", id: source.id } : null;
}
