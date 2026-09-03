import type { ItemId, World } from "./types.ts";

export type NpcInteractionKind = "talk" | "heal" | "trade" | "bank" | "recruit";
export type NpcInteractionFx =
  | Readonly<{ kind: "talk" | "heal" | "recruit"; targetId: string; x: number; z: number; at: number }>
  | Readonly<{ kind: "trade" | "bank"; targetId: string | null; x: number; z: number; at: number; direction: "in" | "out"; item: ItemId | "gold" | "rare" }>;

export const NPC_INTERACTION_DURATION = 1.05;
const effects = new WeakMap<World, NpcInteractionFx>();
type FxInput = NpcInteractionFx extends infer Event ? Event extends NpcInteractionFx ? Omit<Event, "at"> : never : never;

export function emitNpcInteractionFx(world: World, fx: FxInput) {
  const event = Object.freeze({ ...fx, at: world.hour }) as NpcInteractionFx;
  effects.set(world, event);
  return event;
}

export function getNpcInteractionFx(world: World) {
  return effects.get(world) ?? null;
}

function clamp01(value: number) { return Math.max(0, Math.min(1, value)); }

export function npcInteractionPose(kind: NpcInteractionKind, age: number) {
  const phase = clamp01(age / NPC_INTERACTION_DURATION);
  const pulse = phase <= 0 || phase >= 1 ? 0 : Math.sin(phase * Math.PI);
  if (kind === "talk") return { bow: pulse * 0.12, reach: pulse * 0.42, lift: pulse * 0.08, turn: 0 };
  if (kind === "heal") return { bow: pulse * 0.2, reach: pulse * 0.68, lift: pulse * 0.2, turn: 0 };
  if (kind === "trade") return { bow: pulse * 0.1, reach: pulse * 0.82, lift: pulse * 0.12, turn: 0 };
  if (kind === "bank") return { bow: pulse * 0.08, reach: pulse * 0.72, lift: 0, turn: pulse * 0.08 };
  return { bow: pulse * 0.16, reach: pulse * 0.62, lift: pulse * 0.3, turn: -pulse * 0.12 };
}

export const NPC_INTERACTION_LABEL: Record<NpcInteractionKind, string> = {
  talk: "Speaking",
  heal: "Restored",
  trade: "Trading",
  bank: "Banking",
  recruit: "Recruited",
};
