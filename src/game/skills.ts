import { SKILL_META } from "./catalog";
import { mulberry32 } from "./rng";
import type { SkillId, World } from "./types";

function rngAt(world: World, salt: number) {
  return mulberry32((world.seed + world.tickCount * 31 + salt) >>> 0)();
}

function totalSkill(world: World) {
  return Object.values(world.player.skills).reduce((a, b) => a + b, 0);
}

function ggsWait(skill: number, total: number) {
  const s = Math.max(0, skill);
  const t = Math.max(50, total);
  return 0.35 + (s / 100) * 2.4 + (t / 700) * 1.8;
}

export function successChance(skill: number, difficulty: number) {
  const delta = skill - difficulty;
  return Math.max(0.05, Math.min(0.95, 0.5 + delta / 80));
}

export function tryGain(world: World, skill: SkillId, succeeded: boolean, inBand: boolean): string | null {
  if (!succeeded) return null;
  const cur = world.player.skills[skill];
  if (cur >= 100) return null;
  const total = totalSkill(world);
  const wait = ggsWait(cur, total);
  const due = world.hour - world.player.lastGain[skill] >= wait;
  const p = inBand ? 0.42 : 0.1;
  const roll = rngAt(world, skill.length * 17 + Math.floor(cur * 10));
  if (!due && roll > p) return null;
  world.player.skills[skill] = Math.min(100, Math.round((cur + 0.1) * 10) / 10);
  world.player.lastGain[skill] = world.hour;
  return `${SKILL_META[skill].label} rises to ${world.player.skills[skill].toFixed(1)}`;
}
