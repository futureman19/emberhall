import { BUILDING_META } from "./catalog.ts";
import type { BuildingKind, World } from "./types.ts";

export interface ConstructionFx {
  buildingId: string;
  kind: BuildingKind;
  x: number;
  z: number;
  at: number;
  source: "gold" | "deed";
}

export const CONSTRUCTION_DURATION = 1.55;

const effects = new WeakMap<World, ConstructionFx>();

export function emitConstructionFx(world: World, buildingId: string, kind: BuildingKind, x: number, z: number, source: "gold" | "deed") {
  const fx = { buildingId, kind, x, z, at: world.hour, source };
  effects.set(world, fx);
  return fx;
}

export function getConstructionFx(world: World) {
  return effects.get(world) ?? null;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function constructionPose(age: number) {
  const phase = clamp01(age / CONSTRUCTION_DURATION);
  const envelope = phase <= 0 || phase >= 1 ? 0 : Math.sin(phase * Math.PI);
  return {
    crouch: envelope * 0.12,
    lean: envelope * 0.18,
    hammer: Math.sin(age * 18) * envelope,
    lift: Math.sin(clamp01(phase / 0.72) * Math.PI * 0.5),
  };
}

export function constructionLabel(kind: BuildingKind) {
  return BUILDING_META[kind].label;
}
