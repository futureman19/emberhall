// Techniques — spells for warriors. Each weapon family knows three moves,
// gated by weapon-skill tiers (25/50/75). A move arms like a spell, rides
// the next landed strike, then catches its breath (cooldown). No mana —
// the blade's only cost is patience.

import { SKILL_META } from "./catalog.ts";
import { effSkill, you } from "./player.ts";
import { effectiveMain } from "./rare.ts";
import type { SkillId, World } from "./types.ts";

export type TechniqueWeapon = "sword" | "bow" | "knife" | "mace";
export type TechniqueId =
  | "lunge" | "riposte" | "cleave"
  | "aimed_shot" | "double_loose" | "hunters_mark"
  | "flurry" | "hamstring" | "veinfind"
  | "bash" | "sunder" | "doomblow";

export interface TechniqueMeta {
  id: TechniqueId;
  label: string;
  weapon: TechniqueWeapon;
  skill: SkillId;
  minSkill: number;
  cooldownHours: number;
  blurb: string;
}

export const TECHNIQUES: Record<TechniqueId, TechniqueMeta> = {
  lunge: {
    id: "lunge",
    label: "Lunge",
    weapon: "sword",
    skill: "swords",
    minSkill: 25,
    cooldownHours: 0.4,
    blurb: "A committed thrust that bites deeper (+3, truer).",
  },
  riposte: {
    id: "riposte",
    label: "Riposte",
    weapon: "sword",
    skill: "swords",
    minSkill: 50,
    cooldownHours: 0.6,
    blurb: "Answer fresh teeth with half again.",
  },
  cleave: {
    id: "cleave",
    label: "Cleave",
    weapon: "sword",
    skill: "swords",
    minSkill: 75,
    cooldownHours: 0.8,
    blurb: "The swing carries to a second beast at half strength.",
  },
  aimed_shot: {
    id: "aimed_shot",
    label: "Aimed Shot",
    weapon: "bow",
    skill: "archery",
    minSkill: 25,
    cooldownHours: 0.5,
    blurb: "The arrow never grazes.",
  },
  double_loose: {
    id: "double_loose",
    label: "Double Loose",
    weapon: "bow",
    skill: "archery",
    minSkill: 50,
    cooldownHours: 0.9,
    blurb: "Two shafts in one breath.",
  },
  hunters_mark: {
    id: "hunters_mark",
    label: "Hunter's Mark",
    weapon: "bow",
    skill: "archery",
    minSkill: 75,
    cooldownHours: 1.2,
    blurb: "Marked prey bleeds a quarter more.",
  },
  flurry: {
    id: "flurry",
    label: "Flurry",
    weapon: "knife",
    skill: "fencing",
    minSkill: 25,
    cooldownHours: 0.4,
    blurb: "Quick wrists — the strike rolls twice, takes the better.",
  },
  hamstring: {
    id: "hamstring",
    label: "Hamstring",
    weapon: "knife",
    skill: "fencing",
    minSkill: 50,
    cooldownHours: 0.8,
    blurb: "A cut to the leg — the beast limps, weakened, for a spell.",
  },
  veinfind: {
    id: "veinfind",
    label: "Veinfind",
    weapon: "knife",
    skill: "fencing",
    minSkill: 75,
    cooldownHours: 1.0,
    blurb: "You read the seams — a clean hit always opens one.",
  },
  bash: {
    id: "bash",
    label: "Bash",
    weapon: "mace",
    skill: "mace",
    minSkill: 25,
    cooldownHours: 0.5,
    blurb: "A ringing blow that holds the beast still.",
  },
  sunder: {
    id: "sunder",
    label: "Sunder",
    weapon: "mace",
    skill: "mace",
    minSkill: 50,
    cooldownHours: 0.7,
    blurb: "Crushing force tells on big game; a flat thump on the small.",
  },
  doomblow: {
    id: "doomblow",
    label: "Doomblow",
    weapon: "mace",
    skill: "mace",
    minSkill: 75,
    cooldownHours: 1.2,
    blurb: "Everything behind one swing — double damage.",
  },
};

export const TECHNIQUE_IDS: ReadonlySet<string> = new Set(Object.keys(TECHNIQUES));

/** The kit the held weapon answers to, if any. */
export function techniqueWeaponOf(world: World): TechniqueWeapon | null {
  const main = effectiveMain(world);
  if (main === "sword") return "sword";
  if (main === "bow") return "bow";
  if (main === "knife") return "knife";
  if (main === "club" || main === "mace" || main === "war_hammer" || main === "quarterstaff") return "mace";
  return null;
}

export function techniqueUnlocked(world: World, id: TechniqueId): boolean {
  const meta = TECHNIQUES[id];
  return effSkill(world, meta.skill) >= meta.minSkill;
}

/** Hours until the move catches its breath; 0 when ready. */
export function techniqueCooldownLeft(world: World, id: TechniqueId): number {
  return Math.max(0, (world.player.techniqueCoolUntil[id] ?? 0) - world.hour);
}

/** The armed move, validated against the held weapon; stale arms clear. */
export function armedTechniqueFor(world: World): TechniqueMeta | null {
  const id = world.player.armedTechnique;
  if (!id) return null;
  const meta = TECHNIQUES[id];
  if (!meta || techniqueWeaponOf(world) !== meta.weapon) {
    world.player.armedTechnique = null;
    return null;
  }
  return meta;
}

/** Arm a move for the next strike — or let go of it. Returns a refusal, or null. */
export function commandArmTechnique(world: World, id: TechniqueId): string | null {
  const meta = TECHNIQUES[id];
  if (!meta) return "No such move.";
  if (you(world)?.ghost) return "The dead have no techniques.";
  if (world.player.armedTechnique === id) {
    world.player.armedTechnique = null;
    return null;
  }
  if (techniqueWeaponOf(world) !== meta.weapon) return `${meta.label} asks for a ${meta.weapon} in hand.`;
  if (!techniqueUnlocked(world, id)) return `${meta.label} asks for ${meta.minSkill} ${SKILL_META[meta.skill].label.toLowerCase()}.`;
  if (techniqueCooldownLeft(world, id) > 0) return `${meta.label} is still catching its breath.`;
  world.player.armedTechnique = id;
  return null;
}
