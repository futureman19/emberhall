/**
 * Water survival — thirst, drinking, and the narrow drowning rule.
 * Contract: docs/water-survival-slice.md (t_dd0f07c3 audit, t_77f1af48 slice).
 *
 * Scope guard: this is NOT a boating/swimming redesign. Water stays
 * non-walkable for planning; a living body only ends up on water when the
 * fly spell lapses mid-crossing (the sole existing entry path). From there
 * the existing pathfinder already allows the water-to-shore step (canStep
 * checks the destination only), so escape is a normal walk order at half
 * speed while the body is on water.
 */
import { MAP } from "./atlas.ts";
import { tileOf, walkable } from "./pathfinding.ts";
import type { Person, World } from "./types.ts";

/** Fresh bodies start at 80 (same footing as hunger/energy). */
export const THIRST_START = 80;
/** Slightly faster than hunger's 3.2/h: water is the tighter daily loop. */
export const THIRST_DECAY_PER_HOUR = 4.8;
export const THIRST_LOW = 25;
export const THIRST_CRITICAL = 10;
/** One drink from any water tile restores 40, capped at 100. */
export const DRINK_RESTORE = 40;
/** At zero thirst the body loses 1 HP per 0.25 vale-hours. */
export const DEHYDRATION_HP = 1;
export const DEHYDRATION_BEAT_HOURS = 0.25;
/** On open water: 0.5h grace, then 2 HP per 0.1h until shore or death. */
export const DROWN_GRACE_HOURS = 0.5;
export const DROWN_HP = 2;
export const DROWN_BEAT_HOURS = 0.1;
/** Movement on water is half speed — the scramble is urgent, not instant. */
export const IN_WATER_SPEED = 0.5;
/** Observation radius for nearest-water awareness (tiles). */
export const WATER_OBS_RADIUS = 24;
/** Reflex autopilot offers a visible drink at or below this thirst. */
export const DRINK_OFFER_THIRST = 60;

export function tileIsWater(world: World, tx: number, ty: number): boolean {
  return world.tiles[ty]?.[tx]?.kind === "water";
}

export function bodyTileIsWater(world: World, p: Person): boolean {
  const t = tileOf(p.x, p.z);
  return tileIsWater(world, t.tx, t.ty);
}

/** Nearest water tile to a real position, Chebyshev-bounded scan radius. */
export function nearestWater(
  world: World,
  x: number,
  z: number,
  radius = WATER_OBS_RADIUS,
): { tx: number; ty: number; dist: number } | null {
  const c = tileOf(x, z);
  let best: { tx: number; ty: number; dist: number } | null = null;
  const x0 = Math.max(0, c.tx - radius);
  const x1 = Math.min(MAP - 1, c.tx + radius);
  const y0 = Math.max(0, c.ty - radius);
  const y1 = Math.min(MAP - 1, c.ty + radius);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!tileIsWater(world, tx, ty)) continue;
      const dist = Math.hypot(tx - x, ty - z);
      if (!best || dist < best.dist) best = { tx, ty, dist };
    }
  }
  return best;
}

const SHORE_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** A walkable tile beside a water tile — the go-to-water destination. */
export function shoreBesideWater(world: World, tx: number, ty: number): { tx: number; ty: number } | null {
  for (const [dx, dy] of SHORE_DIRS) {
    const x = tx + dx;
    const y = ty + dy;
    if (walkable(world, x, y)) return { tx: x, ty: y };
  }
  return null;
}

/** Per-body water clock. WeakMap keyed by the Person object: a save/load
 *  rebuilds bodies, so the drowning grace re-derives on load by design. */
interface WaterClock {
  /** Hour the body entered open water; 0 = on shore. */
  enteredAt: number;
  /** Hour of the next drowning beat; 0 = no drowning clock. */
  nextDrownBeat: number;
  /** Latched once the first drowning beat lands (observation flag). */
  drowning: boolean;
  /** Hour of the next dehydration beat; 0 = thirst above zero. */
  nextDehydrationBeat: number;
  /** Last observed thirst, for once-per-crossing log lines. */
  lastThirst: number;
}
const clocks = new WeakMap<Person, WaterClock>();

function clockFor(p: Person): WaterClock {
  let c = clocks.get(p);
  if (!c) {
    c = { enteredAt: 0, nextDrownBeat: 0, drowning: false, nextDehydrationBeat: 0, lastThirst: p.thirst };
    clocks.set(p, c);
  }
  return c;
}

function resetDrowning(c: WaterClock) {
  c.enteredAt = 0;
  c.nextDrownBeat = 0;
  c.drowning = false;
}

/** Pure read for the observation layer (never mutates). Ghosts, sleepers
 *  and bodies aloft on the fly spell are not drowning. */
export function waterStatus(world: World, p: Person, flyUntil: number): { inWater: boolean; drowning: boolean } {
  if (p.ghost || p.task === "sleep" || world.hour < flyUntil) return { inWater: false, drowning: false };
  if (!bodyTileIsWater(world, p)) return { inWater: false, drowning: false };
  const c = clocks.get(p);
  return { inWater: true, drowning: Boolean(c?.drowning) };
}

/**
 * One body's water beat, called from tickPlayer. Returns at most one log
 * note (death > drowning beat > dehydration beat > entry > threshold).
 * `die` routes death through the existing ghost/corpse machinery.
 */
export function tickWaterSurvival(
  world: World,
  p: Person,
  opts: { flyUntil: number; die: (p: Person) => string | null },
): string | null {
  const c = clockFor(p);
  const prevThirst = c.lastThirst;
  c.lastThirst = p.thirst;
  if (p.ghost) {
    resetDrowning(c);
    c.nextDehydrationBeat = 0;
    return null;
  }
  const sleeping = p.task === "sleep";
  const flying = world.hour < opts.flyUntil;
  let note: string | null = null;

  // Dehydration: zero thirst drains health on a fixed vale-hour beat.
  if (!sleeping && p.thirst <= 0) {
    if (c.nextDehydrationBeat === 0) c.nextDehydrationBeat = world.hour + DEHYDRATION_BEAT_HOURS;
    if (world.hour >= c.nextDehydrationBeat) {
      c.nextDehydrationBeat = world.hour + DEHYDRATION_BEAT_HOURS;
      p.hp -= DEHYDRATION_HP;
      if (p.hp <= 0) return opts.die(p);
      note = "Dehydration drains you.";
    }
  } else {
    c.nextDehydrationBeat = 0;
  }

  // Threshold crossings log once each (the reflex events carry the rest).
  if (!sleeping && !note) {
    if (prevThirst > THIRST_LOW && p.thirst <= THIRST_LOW) note = "Your throat is dry — find water.";
    else if (prevThirst > THIRST_CRITICAL && p.thirst <= THIRST_CRITICAL) note = "You are parched. Drink soon.";
  }

  // Drowning: a living body on open water gets a grace window, then beats.
  if (!sleeping && !flying && bodyTileIsWater(world, p)) {
    if (c.enteredAt === 0) {
      c.enteredAt = world.hour;
      c.nextDrownBeat = world.hour + DROWN_GRACE_HOURS;
      c.drowning = false;
      if (!note) note = "You are in over your head — reach shore!";
    }
    if (world.hour >= c.nextDrownBeat) {
      c.nextDrownBeat = world.hour + DROWN_BEAT_HOURS;
      c.drowning = true;
      p.hp -= DROWN_HP;
      if (p.hp <= 0) return opts.die(p);
      note = "The water drags you under.";
    }
  } else {
    // Shore, aloft, or asleep: the drowning clock resets. Landing back on
    // water after fly lapses starts a fresh grace window.
    resetDrowning(c);
  }
  return note;
}
