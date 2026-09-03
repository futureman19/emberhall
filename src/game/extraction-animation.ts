import type { World } from "./types.ts";

export type ExtractionAnimationKind = "lumberjacking" | "mining";

export interface ExtractionFx {
  kind: ExtractionAnimationKind;
  success: boolean;
  x: number;
  z: number;
  at: number;
}

export const EXTRACTION_DURATION = 0.86;
export const EXTRACTION_BEAT = 0.72;
export const EXTRACTION_IMPACT = 0.52;

const extractionFx = new WeakMap<World, ExtractionFx>();

export function emitExtractionFx(world: World, kind: ExtractionAnimationKind, success: boolean, x: number, z: number) {
  const fx = { kind, success, x, z, at: world.hour };
  extractionFx.set(world, fx);
  return fx;
}

export function getExtractionFx(world: World) {
  return extractionFx.get(world) ?? null;
}

export function clearExtractionFx(world: World) {
  extractionFx.delete(world);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function extractionPose(kind: ExtractionAnimationKind, workT: number) {
  const beatTime = Math.max(0, workT) % EXTRACTION_BEAT;
  const windup = clamp01(beatTime / EXTRACTION_IMPACT);
  const swing = beatTime <= EXTRACTION_IMPACT
    ? windup * windup * (3 - 2 * windup)
    : 1 - clamp01((beatTime - EXTRACTION_IMPACT) / (EXTRACTION_BEAT - EXTRACTION_IMPACT));
  if (kind === "lumberjacking") {
    return { swing, brace: 0.42 + windup * 0.48, crouch: swing * 0.05, twist: Math.sin(windup * Math.PI) * 0.24 };
  }
  return { swing, brace: 0.7 + windup * 0.28, crouch: swing * 0.13, twist: 0 };
}

const PROFILES = Object.freeze({
  lumberjacking: Object.freeze({ label: "Lumberjacking", tool: "BLADE", primary: "#e2b66f", secondary: "#7a5230", height: 1.1 }),
  mining: Object.freeze({ label: "Mining", tool: "PICK", primary: "#f1d78e", secondary: "#8a8680", height: 0.56 }),
} satisfies Record<ExtractionAnimationKind, Readonly<{ label: string; tool: string; primary: string; secondary: string; height: number }>>);

export function extractionVisualProfile(kind: ExtractionAnimationKind) {
  return PROFILES[kind];
}
