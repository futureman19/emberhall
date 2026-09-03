import { KEEP } from "./city.ts";
import type { Person } from "./types.ts";

/** Voxel rows per storey — matches the keep's window bands. */
export const KEEP_STORY_VOX = 4;
export const KEEP_STORY_Y = KEEP_STORY_VOX * 0.5;
export const KEEP_MAX_STORY = 3;

/** East-interior stair well. North climbs. */
export const KEEP_STAIR = { x0: 184, x1: 185, z0: 316, z1: 325 };
const TILES_PER_STORY = (KEEP_STAIR.z1 - KEEP_STAIR.z0) / KEEP_MAX_STORY;

export function insideKeep(x: number, z: number) {
  const tx = Math.round(x);
  const ty = Math.round(z);
  return tx > KEEP.x0 && tx < KEEP.x1 && ty > KEEP.z0 && ty < KEEP.z1;
}

export function onKeepStairs(x: number, z: number) {
  const tx = Math.round(x);
  const ty = Math.round(z);
  return tx >= KEEP_STAIR.x0 && tx <= KEEP_STAIR.x1 && ty >= KEEP_STAIR.z0 && ty <= KEEP_STAIR.z1;
}

export function keepStoryY(story: number) {
  return Math.max(0, story) * KEEP_STORY_Y;
}

export function applyKeepStory(p: Person, prevX: number, prevZ: number) {
  if (!p.isPlayer) return;
  if (p.story == null || Number.isNaN(p.story)) p.story = 0;
  if (!insideKeep(p.x, p.z)) {
    p.story = 0;
    return;
  }
  const was = onKeepStairs(prevX, prevZ);
  const now = onKeepStairs(p.x, p.z);
  if (now && was) {
    const dz = prevZ - p.z;
    p.story = Math.min(KEEP_MAX_STORY, Math.max(0, p.story + dz / TILES_PER_STORY));
  } else if (!now && was) {
    p.story = Math.round(p.story);
  }
}
