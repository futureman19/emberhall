import { SECONDS_PER_HOUR } from "./catalog.ts";
import type { World } from "./types.ts";

export type CorpseAnimationKind = "skinning" | "looting";

export interface CorpseFx {
  kind: CorpseAnimationKind;
  targetId: string;
  x: number;
  z: number;
  at: number;
}

export const CORPSE_DURATION = 1.05;

let corpseFx: CorpseFx | null = null;

export function emitCorpseFx(world: World, kind: CorpseAnimationKind, targetId: string, x: number, z: number) {
  corpseFx = { kind, targetId, x, z, at: world.hour };
  return corpseFx;
}

export function getCorpseFx() {
  return corpseFx;
}

export function clearCorpseFx() {
  corpseFx = null;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function corpseFxAge(world: World, fx: CorpseFx) {
  return (world.hour - fx.at) * SECONDS_PER_HOUR;
}

export function corpsePose(kind: CorpseAnimationKind, age: number) {
  const phase = clamp01(age / CORPSE_DURATION);
  const envelope = Math.sin(phase * Math.PI);
  if (kind === "skinning") {
    return {
      crouch: envelope * 0.24,
      lean: envelope * 0.34,
      reach: envelope * 0.78,
      cut: Math.sin(age * 24) * envelope,
    };
  }
  return {
    crouch: envelope * 0.2,
    lean: envelope * 0.28,
    reach: Math.sin(phase * Math.PI) * 0.9,
    cut: 0,
  };
}
