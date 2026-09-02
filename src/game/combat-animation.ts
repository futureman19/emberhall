import type { SpellId } from "./types.ts";

export const COMBAT_BEAT = 0.55;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smooth(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function attackPhase(workT: number) {
  if (!Number.isFinite(workT) || workT <= 0) return 0;
  return (workT % COMBAT_BEAT) / COMBAT_BEAT;
}

export function meleeSwingPitch(workT: number) {
  const phase = attackPhase(workT);
  if (phase < 0.42) return smooth(phase / 0.42) * 1.32;
  if (phase < 0.68) return 1.32 + smooth((phase - 0.42) / 0.26) * -2.82;
  return -1.5 * (1 - smooth((phase - 0.68) / 0.32));
}

export function bowDrawAmount(workT: number) {
  const phase = attackPhase(workT);
  if (phase < 0.62) return smooth(phase / 0.62);
  if (phase < 0.76) return 1 - smooth((phase - 0.62) / 0.14);
  return 0;
}

export function projectileProgress(ageSeconds: number, durationSeconds: number) {
  if (!Number.isFinite(ageSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return clamp01(ageSeconds / durationSeconds);
}

export interface SpellProjectileProfile {
  core: string;
  trail: string;
  impact: string;
  coreScale: number;
  trailScale: number;
  impactScale: number;
}

const SPELL_PROJECTILES: Record<"magicarrow" | "fireball", Readonly<SpellProjectileProfile>> = {
  magicarrow: Object.freeze({
    core: "#ffffff",
    trail: "#79c8ff",
    impact: "#8ec8ff",
    coreScale: 2.1,
    trailScale: 2,
    impactScale: 1.8,
  }),
  fireball: Object.freeze({
    core: "#ff8a38",
    trail: "#ff3d1f",
    impact: "#ff6a2f",
    coreScale: 3.5,
    trailScale: 3.2,
    impactScale: 3.8,
  }),
};

export function spellProjectileProfile(spell: SpellId): Readonly<SpellProjectileProfile> {
  return spell === "fireball" ? SPELL_PROJECTILES.fireball : SPELL_PROJECTILES.magicarrow;
}

export interface TravelEffectProfile {
  source: string;
  destination: string;
  accent: string;
}

const TRAVEL_EFFECTS: Record<"teleport" | "recall", Readonly<TravelEffectProfile>> = {
  teleport: Object.freeze({ source: "#d8efff", destination: "#ffffff", accent: "#79c8ff" }),
  recall: Object.freeze({ source: "#d9824b", destination: "#ffd36a", accent: "#c74722" }),
};

export function travelEffectProfile(spell: SpellId): Readonly<TravelEffectProfile> {
  return spell === "recall" ? TRAVEL_EFFECTS.recall : TRAVEL_EFFECTS.teleport;
}
