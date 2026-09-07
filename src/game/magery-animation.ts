import type { SpellId } from "./types.ts";

/**
 * Per-spell visual identity for magery: the release animation archetype,
 * palette, particle counts, and the windup glow tint. Pure and deterministic
 * so node tests can pin the math; the renderer (world-scene.tsx) reads these
 * profiles instead of hardcoding per-spell colors.
 */

export type SpellFxKind =
  | "spiral" // motes corkscrew upward around the caster (nightsight)
  | "fountain" // soft motes rise straight up (heal)
  | "dart" // fast projectile + shard impact (magicarrow)
  | "burst" // heavy projectile + ember impact (fireball)
  | "fold" // blink: collapse at source, bloom at destination (teleport)
  | "sigil" // rune circle drawn on the ground (mark)
  | "surge"; // gate bloom at both ends (recall)

export interface SpellFxProfile {
  kind: SpellFxKind;
  /** bolt / core flash color */
  core: string;
  /** ground ring color */
  ring: string;
  /** drifting particle color */
  motes: string;
  /** secondary highlight */
  accent: string;
  /** seconds the release FX lives */
  duration: number;
  /** particle count for self-target releases */
  motesCount: number;
  /** palm-flame tint while the words are spoken */
  glow: string;
}

const PROFILES: Record<SpellId, Readonly<SpellFxProfile>> = {
  nightsight: Object.freeze({
    kind: "spiral",
    core: "#b9a7ff",
    ring: "#6d5bd0",
    motes: "#8f7bff",
    accent: "#e6deff",
    duration: 1.1,
    motesCount: 10,
    glow: "#8f7bff",
  }),
  heal: Object.freeze({
    kind: "fountain",
    core: "#eaffd0",
    ring: "#7fae5a",
    motes: "#b8e986",
    accent: "#fff3c9",
    duration: 1.0,
    motesCount: 12,
    glow: "#a8e07a",
  }),
  magicarrow: Object.freeze({
    kind: "dart",
    core: "#ffffff",
    ring: "#8ec8ff",
    motes: "#79c8ff",
    accent: "#dff2ff",
    duration: 0.78,
    motesCount: 8,
    glow: "#79c8ff",
  }),
  teleport: Object.freeze({
    kind: "fold",
    core: "#d8efff",
    ring: "#79c8ff",
    motes: "#bfe6ff",
    accent: "#ffffff",
    duration: 0.82,
    motesCount: 8,
    glow: "#a8d8ff",
  }),
  fireball: Object.freeze({
    kind: "burst",
    core: "#ff8a38",
    ring: "#ff6a2f",
    motes: "#ffb066",
    accent: "#ff3d1f",
    duration: 0.9,
    motesCount: 10,
    glow: "#ff9a4a",
  }),
  mark: Object.freeze({
    kind: "sigil",
    core: "#ffd36a",
    ring: "#e0a83a",
    motes: "#ffe9ad",
    accent: "#fff8e0",
    duration: 1.15,
    motesCount: 8,
    glow: "#ffd36a",
  }),
  recall: Object.freeze({
    kind: "surge",
    core: "#ffd36a",
    ring: "#d9824b",
    motes: "#f4b36a",
    accent: "#c74722",
    duration: 1.0,
    motesCount: 8,
    glow: "#f4a35a",
  }),
};

export function spellFxProfile(spell: SpellId): Readonly<SpellFxProfile> {
  return PROFILES[spell];
}

/** Palm-flame tint while the words of power are spoken. */
export function windupGlow(spell: SpellId | null | undefined): string {
  return (spell && PROFILES[spell]?.glow) || "#e8f2ff";
}

const GOLDEN = 2.399963229728653; // golden angle — spreads particles without rng

function hash(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export interface MoteState {
  /** offset from the effect origin, world units */
  dx: number;
  dy: number;
  dz: number;
  scale: number;
  opacity: number;
}

/**
 * Particle i of a self-target release at `age` seconds after the words land.
 * Pure function of (spell, i, age) — no randomness, so tests can pin it and
 * the renderer can call it every frame without allocation surprises.
 */
export function moteState(spell: SpellId, i: number, age: number): MoteState {
  const p = PROFILES[spell];
  const t = Math.max(0, Math.min(1, age / p.duration));
  const fade = 1 - t;
  const h0 = hash(i);
  const h1 = hash(i + 41);
  if (p.kind === "spiral") {
    const angle = i * GOLDEN + age * (4.2 + h0 * 2.4);
    const radius = 0.62 * (1 - t * 0.55) * (0.7 + h1 * 0.6);
    return {
      dx: Math.cos(angle) * radius,
      dy: 0.25 + (0.55 + h0) * age * 1.35,
      dz: Math.sin(angle) * radius,
      scale: 0.75 + h1 * 0.5,
      opacity: 0.9 * fade,
    };
  }
  if (p.kind === "fountain") {
    const angle = i * GOLDEN;
    const drift = 0.12 + h0 * 0.3;
    return {
      dx: Math.cos(angle) * (0.2 + age * drift),
      dy: 0.15 + age * (1.15 + h1 * 0.9),
      dz: Math.sin(angle) * (0.2 + age * drift),
      scale: 0.65 + h0 * 0.6,
      opacity: 0.85 * fade,
    };
  }
  if (p.kind === "sigil") {
    const angle = (i / Math.max(1, p.motesCount)) * Math.PI * 2 + age * 0.9;
    return {
      dx: Math.cos(angle) * 0.85,
      dy: 0.06 + Math.sin(age * 5 + i) * 0.05 + t * 0.12,
      dz: Math.sin(angle) * 0.85,
      scale: 0.7 + h0 * 0.4,
      opacity: 0.95 * fade,
    };
  }
  // surge / fold / dart / burst fallback: outward puff
  const angle = i * GOLDEN;
  const reach = 0.3 + age * (0.9 + h0 * 0.9);
  return {
    dx: Math.cos(angle) * reach,
    dy: 0.2 + age * (0.7 + h1 * 0.5),
    dz: Math.sin(angle) * reach,
    scale: 0.7 + h1 * 0.5,
    opacity: 0.8 * fade,
  };
}

/**
 * Shard i of a projectile impact (dart / burst) at progress t in [0,1].
 * Shards fly outward from the impact point, arc, and fade.
 */
export function impactShard(spell: SpellId, i: number, t01: number): MoteState {
  const t = Math.max(0, Math.min(1, t01));
  const h0 = hash(i + 7);
  const h1 = hash(i + 23);
  const angle = i * GOLDEN + h0 * 0.6;
  const speed = 1.4 + h0 * 1.8;
  const dist = speed * t * 0.9;
  return {
    dx: Math.cos(angle) * dist,
    dy: Math.max(0, 0.15 + (1.1 + h1 * 1.3) * t - 2.6 * t * t),
    dz: Math.sin(angle) * dist,
    scale: (0.8 + h1 * 0.6) * (1 - t * 0.5),
    opacity: 0.95 * (1 - t),
  };
}

/** Ground-ring expansion for a release at progress t in [0,1]. */
export function ringBloom(spell: SpellId, t01: number) {
  const p = PROFILES[spell];
  const t = Math.max(0, Math.min(1, t01));
  const grow = p.kind === "sigil" ? 0.9 : 0.55 + t * 1.6;
  return { scale: grow, opacity: (p.kind === "sigil" ? 0.85 : 0.75) * (1 - t) };
}
