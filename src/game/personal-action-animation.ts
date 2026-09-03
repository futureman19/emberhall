import { ITEM_META } from "./catalog.ts";
import type { ItemId, WearSlot, World } from "./types.ts";

export type PersonalActionFx =
  | Readonly<{ kind: "eat"; item: ItemId; fill: number; x: number; z: number; at: number }>
  | Readonly<{ kind: "equipment"; direction: "equip" | "unequip"; item: ItemId | null; slot: WearSlot; rare: boolean; uid: string | null; x: number | null; z: number | null; at: number }>
  | Readonly<{ kind: "ground"; direction: "pickup" | "drop"; item: ItemId | null; count: number; gold: number; x: number; z: number; at: number }>
  | Readonly<{ kind: "chest"; direction: "in" | "out"; buildingId: string; item: ItemId; count: number; x: number; z: number; at: number }>;

export const PERSONAL_ACTION_DURATION = 1.05;
const effects = new WeakMap<World, PersonalActionFx>();
type FxInput = PersonalActionFx extends infer Event ? Event extends PersonalActionFx ? Omit<Event, "at"> : never : never;

export function emitPersonalActionFx(world: World, fx: FxInput) {
  const event = Object.freeze({ ...fx, at: world.hour }) as PersonalActionFx;
  effects.set(world, event);
  return event;
}

export function getPersonalActionFx(world: World) {
  return effects.get(world) ?? null;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function personalActionPose(fx: Pick<PersonalActionFx, "kind">, age: number) {
  const phase = clamp01(age / PERSONAL_ACTION_DURATION);
  const pulse = phase <= 0 || phase >= 1 ? 0 : Math.sin(phase * Math.PI);
  if (fx.kind === "eat") return { crouch: 0, lean: -pulse * 0.08, reach: pulse * 0.82, lift: pulse * 0.18 };
  if (fx.kind === "equipment") return { crouch: 0, lean: pulse * 0.06, reach: pulse * 0.72, lift: pulse * 0.1 };
  if (fx.kind === "ground") return { crouch: pulse * 0.2, lean: pulse * 0.24, reach: pulse * 0.88, lift: 0 };
  return { crouch: pulse * 0.12, lean: pulse * 0.16, reach: pulse * 0.78, lift: pulse * 0.04 };
}

export function personalActionLabel(fx: PersonalActionFx) {
  if (fx.kind === "eat") return `EAT · ${ITEM_META[fx.item].label.toUpperCase()}`;
  if (fx.kind === "equipment") return `${fx.direction === "equip" ? "EQUIPPED" : "STOWED"} · ${fx.item ? ITEM_META[fx.item].label.toUpperCase() : "UNKNOWN GEAR"}`;
  if (fx.kind === "chest") return `${fx.direction === "in" ? "CHEST IN" : "CHEST OUT"} · ${ITEM_META[fx.item].label.toUpperCase()}`;
  if (fx.gold > 0 && !fx.item) return `PICKUP · ${fx.gold} GOLD`;
  const item = fx.item ? ITEM_META[fx.item].label.toUpperCase() : "BUNDLE";
  return `${fx.direction === "pickup" ? "PICKUP" : "DROP"} · ${item}`;
}
