import {
  EARTHQUAKE_PULSE_GAP_HOURS,
  NATURES_FURY_HOURS,
  NATURES_FURY_RADIUS,
  SANCTUARY_HOURS,
  SANCTUARY_RADIUS,
  STONE_WALL_HOURS,
  STONE_WALL_RADIUS,
  TAR_PIT_FAUNA_SLOW,
  TAR_PIT_HOURS,
  TAR_PIT_PERSON_SLOW,
  TAR_PIT_RADIUS,
  FLAME_WALL_HOURS,
  FLAME_WALL_RADIUS,
  ZONE_CAP,
  ZONE_TICK_HOURS,
} from "./catalog.ts";
import { groundY } from "./height.ts";
import { spawnCorpsePile } from "./piles.ts";
import { rareName, rollKillRare } from "./rare.ts";
import { TERRAIN_STREAM_WINDOW } from "./terrain-stream.ts";
import type { Creature, GroundZone, World, ZoneKind } from "./types.ts";
import { completeObjective, log, nid } from "./world.ts";

/** Ground workings (batch two): one placed-working system powers Flame Wall,
 * Tar Pit, Wall of Stone, Sanctuary, Earthquake and Nature's Fury. A zone is
 * plain save data (types.ts); this module owns its behavior. The sim ticks it
 * (sim.ts), pathfinding bars the stone (pathfinding.ts), ecology reads the
 * mire and the seal (ecology.ts), and the renderer rings it (zones-mesh.tsx).
 * Imports stay leafward — piles/rare/world/height — so nothing cycles. */

const ZONE_SHAPE: Record<ZoneKind, { radius: number; hours: number }> = {
  flamewall: { radius: FLAME_WALL_RADIUS, hours: FLAME_WALL_HOURS },
  tarpit: { radius: TAR_PIT_RADIUS, hours: TAR_PIT_HOURS },
  stonewall: { radius: STONE_WALL_RADIUS, hours: STONE_WALL_HOURS },
  sanctuary: { radius: SANCTUARY_RADIUS, hours: SANCTUARY_HOURS },
  earthquake: { radius: 5, hours: EARTHQUAKE_PULSE_GAP_HOURS * 4 },
  naturesfury: { radius: NATURES_FURY_RADIUS, hours: NATURES_FURY_HOURS },
};

/** Ring colors for the renderer — one voice per working, keyed to its magic. */
export const ZONE_VISUALS: Record<ZoneKind, { color: string }> = {
  flamewall: { color: "#ff8a38" },
  tarpit: { color: "#4a3a52" },
  stonewall: { color: "#8a8a7a" },
  sanctuary: { color: "#ffe9a8" },
  earthquake: { color: "#a87a4a" },
  naturesfury: { color: "#5a6a22" },
};

/** Fixtures built outside baseWorld (untyped harnesses, old saves) may lack
 * the field entirely — readers stay total over them. */
function of(world: World): GroundZone[] {
  return (world.zones as GroundZone[] | undefined) ?? [];
}

function live(zone: GroundZone, world: World): boolean {
  return zone.until > world.hour;
}

function contains(zone: GroundZone, x: number, z: number): boolean {
  return Math.hypot(x - zone.tx, z - zone.ty) <= zone.radius;
}

/** Raise a working on the ground. `power` bakes the caster's skill in at the
 * moment of the raising. When the vale already holds its fill of workings,
 * the oldest crumbles. */
export function placeZone(world: World, kind: ZoneKind, tx: number, ty: number, ownerId: string | null, power = 0): GroundZone {
  if (!Array.isArray(world.zones)) world.zones = [];
  const shape = ZONE_SHAPE[kind];
  const zone: GroundZone = {
    id: nid(world, "zn"),
    kind,
    tx,
    ty,
    radius: shape.radius,
    until: world.hour + shape.hours,
    // The fault shakes at once; every other working breathes in first.
    tickAt: kind === "earthquake" ? world.hour : world.hour + ZONE_TICK_HOURS,
    ownerId,
    power,
    pulses: kind === "earthquake" ? 3 : 0,
  };
  world.zones.push(zone);
  if (kind === "stonewall") world.landRev++;
  while (world.zones.length > ZONE_CAP) {
    const oldest = world.zones.shift()!;
    if (oldest.kind === "stonewall") world.landRev++;
    log(world, "The oldest working crumbles.");
  }
  return zone;
}

/** Death rites for a beast a working finishes — the same rites a blade gives,
 * but no foe to turn on: the ring is not something you can fight. */
function finishBeast(world: World, c: Creature): void {
  if (c.hp > 0) return;
  c.hp = 0;
  c.task = "dead";
  c.path = [];
  c.corpseUntil = world.hour + 8;
  spawnCorpsePile(world, c);
  completeObjective(world, "hunt");
  const found = rollKillRare(world, c.kind, Math.random);
  if (found) {
    world.player.rares.push(found);
    log(world, `In the stillness you find ${rareName(found)}.`);
  }
}

function knockLoose(world: World, c: Creature): void {
  c.task = "wander";
  c.taskUntil = world.hour + 0.4;
  c.path = [];
}

function pulse(world: World, zone: GroundZone): void {
  switch (zone.kind) {
    case "flamewall": {
      for (const c of world.fauna) {
        if (c.task === "dead" || c.ownerId || !contains(zone, c.x, c.z)) continue;
        c.hp -= zone.power;
        finishBeast(world, c);
      }
      zone.tickAt += ZONE_TICK_HOURS;
      return;
    }
    case "sanctuary": {
      // The seal holds only while someone stands inside it: hunting beasts
      // lose the scent at the boundary and let the fight go.
      const you = world.people.find((p) => p.isPlayer);
      if (you && contains(zone, you.x, you.z)) {
        for (const c of world.fauna) {
          if (c.task === "dead" || c.ownerId || c.task !== "fight") continue;
          if (Math.hypot(c.x - zone.tx, c.z - zone.ty) <= zone.radius + 1) knockLoose(world, c);
        }
      }
      zone.tickAt += ZONE_TICK_HOURS;
      return;
    }
    case "earthquake": {
      if (zone.pulses <= 0) return;
      const scale = zone.pulses === 3 ? 1 : zone.pulses === 2 ? 0.5 : 0.25;
      const dmg = Math.max(1, Math.floor(zone.power * scale));
      for (const c of world.fauna) {
        if (c.task === "dead" || c.ownerId || !contains(zone, c.x, c.z)) continue;
        c.hp -= dmg;
        if (c.hp > 0) knockLoose(world, c);
        else finishBeast(world, c);
      }
      zone.pulses--;
      zone.tickAt += EARTHQUAKE_PULSE_GAP_HOURS;
      return;
    }
    case "naturesfury": {
      let best: Creature | null = null;
      let bestD = Infinity;
      for (const c of world.fauna) {
        if (c.task === "dead" || c.ownerId || !contains(zone, c.x, c.z)) continue;
        const d = Math.hypot(c.x - zone.tx, c.z - zone.ty);
        if (d < bestD) {
          best = c;
          bestD = d;
        }
      }
      if (best) {
        best.hp -= zone.power;
        finishBeast(world, best);
      }
      zone.tickAt += ZONE_TICK_HOURS;
      return;
    }
    case "tarpit":
    case "stonewall":
      return;
  }
}

/** Tick every standing working: pulse what is due, crumble what has lapsed. */
export function tickZones(world: World, _dt: number): void {
  if (!Array.isArray(world.zones)) world.zones = [];
  for (let i = world.zones.length - 1; i >= 0; i--) {
    const zone = world.zones[i]!;
    if (!live(zone, world)) {
      world.zones.splice(i, 1);
      if (zone.kind === "stonewall") world.landRev++;
      continue;
    }
    if (world.hour >= zone.tickAt) pulse(world, zone);
    if (zone.kind === "earthquake" && zone.pulses <= 0) world.zones.splice(i, 1);
  }
}

/** The stone bars the tile — pathfinding asks this of every tile it weighs. */
export function zoneBlocksAt(world: World, tx: number, ty: number): boolean {
  for (const zone of of(world)) {
    if (zone.kind === "stonewall" && live(zone, world) && contains(zone, tx, ty)) return true;
  }
  return false;
}

/** The mire drags at a beast's stride while it stands in the tar. */
export function zoneFaunaSlowAt(world: World, x: number, z: number): number {
  for (const zone of of(world)) {
    if (zone.kind === "tarpit" && live(zone, world) && contains(zone, x, z)) return TAR_PIT_FAUNA_SLOW;
  }
  return 1;
}

/** People wade the tar a little better than beasts do. */
export function zonePersonSlowAt(world: World, x: number, z: number): number {
  for (const zone of of(world)) {
    if (zone.kind === "tarpit" && live(zone, world) && contains(zone, x, z)) return TAR_PIT_PERSON_SLOW;
  }
  return 1;
}

/** The live sanctuary holding this ground, if any. */
export function sanctuaryAt(world: World, x: number, z: number): GroundZone | null {
  for (const zone of of(world)) {
    if (zone.kind === "sanctuary" && live(zone, world) && contains(zone, x, z)) return zone;
  }
  return null;
}

/** A tile a non-owned beast will not step onto: hallowed ground. */
export function sanctuaryBlocksTile(world: World, tx: number, ty: number): boolean {
  return sanctuaryAt(world, tx, ty) !== null;
}

/** No-allocation iteration for the renderer: (center, kind, radius). */
export function visitZones(world: World, visit: (x: number, z: number, kind: ZoneKind, radius: number) => void): void {
  for (const zone of of(world)) {
    if (live(zone, world)) visit(zone.tx, zone.ty, zone.kind, zone.radius);
  }
}

/** Same slope-sheared ground hug as the status seals, at a working's radius:
 * the ring lifts just enough that terrain triangles cannot bury it. */
export function writeZoneMatrix(world: World, x: number, z: number, radius: number, m: number[]): void {
  const step = TERRAIN_STREAM_WINDOW / Math.min(TERRAIN_STREAM_WINDOW * 2, 180);
  const sx = (groundY(world, x + 1, z) - groundY(world, x - 1, z)) / 2;
  const sz = (groundY(world, x, z + 1) - groundY(world, x, z - 1)) / 2;
  const reach = radius + step;
  let y = -Infinity;
  for (let tz = Math.floor(z - reach); tz <= Math.ceil(z + reach); tz++) {
    for (let tx = Math.floor(x - reach); tx <= Math.ceil(x + reach); tx++) {
      y = Math.max(y, groundY(world, tx, tz) - sx * (tx - x) - sz * (tz - z));
    }
  }
  m[0] = radius; m[2] = 0; m[3] = 0;
  m[4] = 0; m[6] = -radius; m[7] = 0;
  m[1] = sx * m[0] + sz * m[2]; m[5] = sx * m[4] + sz * m[6];
  m[8] = 0; m[9] = radius; m[10] = 0; m[11] = 0;
  m[12] = x; m[13] = y + 0.06; m[14] = z; m[15] = 1;
}
