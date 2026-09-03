import type { World } from "./types.ts";

export interface MoongateCompanionArrival {
  id: string;
  x: number;
  z: number;
}

export interface MoongateFx {
  sourceId: string | null;
  destinationId: string;
  destinationName: string;
  x: number;
  z: number;
  tx: number;
  tz: number;
  companions: readonly MoongateCompanionArrival[];
  at: number;
}

export const MOONGATE_DURATION = 1.25;
const effects = new WeakMap<World, MoongateFx>();

export function emitMoongateFx(world: World, fx: Omit<MoongateFx, "at">) {
  const event = Object.freeze({ ...fx, companions: Object.freeze(fx.companions.map((arrival) => Object.freeze({ ...arrival }))), at: world.hour });
  effects.set(world, event);
  return event;
}

export function getMoongateFx(world: World) {
  return effects.get(world) ?? null;
}

function clamp01(value: number) { return Math.max(0, Math.min(1, value)); }

export function moongatePhase(age: number) {
  const progress = clamp01(age / MOONGATE_DURATION);
  return {
    progress,
    departure: 1 - progress,
    transit: progress <= 0 || progress >= 1 ? 0 : Math.sin(progress * Math.PI),
    arrival: Math.sin(clamp01(progress / 0.78) * Math.PI),
    settle: progress < 0.45 ? 0 : clamp01((progress - 0.45) / 0.55),
  };
}
