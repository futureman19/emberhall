import type { ItemId, World } from "./types.ts";

export type CompanionAnimationKind = "feed" | "stay" | "follow" | "release" | "name";

export type CompanionFx =
  | Readonly<{ kind: "feed"; targetId: string; x: number; z: number; at: number; item: ItemId }>
  | Readonly<{ kind: "name"; targetId: string; x: number; z: number; at: number; name: string }>
  | Readonly<{ kind: "stay" | "follow" | "release"; targetId: string; x: number; z: number; at: number }>;

export const COMPANION_DURATION = 1.05;
const effects = new WeakMap<World, CompanionFx>();
type CompanionFxInput = CompanionFx extends infer Event ? Event extends CompanionFx ? Omit<Event, "at"> : never : never;

export function emitCompanionFx(world: World, fx: CompanionFxInput) {
  const event = Object.freeze({ ...fx, at: world.hour }) as CompanionFx;
  effects.set(world, event);
  return event;
}

export function getCompanionFx(world: World) {
  return effects.get(world) ?? null;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function companionPose(kind: CompanionAnimationKind, age: number) {
  const phase = clamp01(age / COMPANION_DURATION);
  const pulse = phase <= 0 || phase >= 1 ? 0 : Math.sin(phase * Math.PI);
  if (kind === "feed") return { hop: pulse * 0.06, bow: pulse * 0.62, turn: 0, stretch: pulse * 0.18 };
  if (kind === "stay") return { hop: 0, bow: pulse * 0.18, turn: 0, stretch: -pulse * 0.07 };
  if (kind === "follow") return { hop: pulse * 0.46, bow: 0, turn: pulse * 0.22, stretch: pulse * 0.16 };
  if (kind === "release") return { hop: pulse * 0.18, bow: 0, turn: pulse * 0.58, stretch: -pulse * 0.04 };
  return { hop: pulse * 0.22, bow: pulse * 0.08, turn: -pulse * 0.12, stretch: pulse * 0.1 };
}

const LABELS: Record<CompanionAnimationKind, string> = {
  feed: "Eating",
  stay: "Staying",
  follow: "Following",
  release: "Released",
  name: "Named",
};

export function companionLabel(kind: CompanionAnimationKind) {
  return LABELS[kind];
}
