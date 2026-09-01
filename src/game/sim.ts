import { COURT, GATE, placeById } from "./atlas.ts";
import { SECONDS_PER_HOUR } from "./catalog.ts";
import { tickEcology } from "./ecology.ts";
import { tickCrops } from "./farm.ts";
import { astar, lineWalkable, nearestWalkable, tileOf } from "./pathfinding.ts";
import { tickPiles } from "./piles.ts";
import { tickCampfires } from "./campfire.ts";
import { tickPets } from "./pets.ts";
import { replanIntentPath, tickPlayer, you } from "./player.ts";
import { regrowResourceNodes } from "./resources/state.ts";
import { tickWeather } from "./weather.ts";
import { completeObjective, log, revealAround } from "./world.ts";
import type { Person, Speed, World } from "./types.ts";

const WALK_SPEED = 2.6;
const STUCK_AFTER = 0.55;

type MotionWatch = {
  x: number;
  z: number;
  stillFor: number;
  landRev: number;
  nextTx: number | null;
  nextTy: number | null;
};
const motionWatches = new WeakMap<Person, MotionWatch>();

export function setSpeed(world: World, s: Speed) {
  world.speed = s;
}

function followPath(world: World, p: Person, dt: number): "idle" | "moving" | "stuck" {
  if (!p.path.length) {
    motionWatches.delete(p);
    return "idle";
  }
  const startX = p.x;
  const startZ = p.z;
  let remaining = WALK_SPEED * (p.ghost ? 1.4 : 1) * dt;
  const previous = motionWatches.get(p);
  const first = p.path[0]!;
  // Planned segments are already corner/climb checked. Revalidate only when
  // the terrain revision changes while this exact segment is active; checking
  // again every frame from a rounded fractional position can invent a
  // different diagonal raster and falsely stop a valid click route.
  if (
    previous
    && previous.landRev !== world.landRev
    && previous.nextTx === first.tx
    && previous.nextTy === first.ty
  ) {
    const here = tileOf(p.x, p.z);
    if (!lineWalkable(world, here.tx, here.ty, first.tx, first.ty)) {
      p.path = [];
      motionWatches.delete(p);
      return "stuck";
    }
  }

  // Spend one continuous movement budget across as many short waypoint
  // handoffs as it reaches. Returning at a waypoint used to insert a whole
  // stationary frame at every turn, which read as a periodic walking pause.
  while (p.path.length && remaining > 1e-9) {
    const n = p.path[0]!;
    const dx = n.tx - p.x;
    const dz = n.ty - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= 1e-9) {
      p.path.shift();
      continue;
    }
    p.facing = Math.atan2(dx, dz);
    if (dist <= remaining) {
      p.x = n.tx;
      p.z = n.ty;
      p.path.shift();
      remaining -= dist;
      continue;
    }
    p.x += (dx / dist) * remaining;
    p.z += (dz / dist) * remaining;
    remaining = 0;
  }

  const moved = Math.hypot(p.x - startX, p.z - startZ);
  const stillFor = moved < 0.001 ? (previous?.stillFor ?? 0) + dt : 0;
  const next = p.path[0];
  motionWatches.set(p, {
    x: p.x,
    z: p.z,
    stillFor,
    landRev: world.landRev,
    nextTx: next?.tx ?? null,
    nextTy: next?.ty ?? null,
  });
  if (stillFor >= STUCK_AFTER) {
    p.path = [];
    motionWatches.delete(p);
    return "stuck";
  }
  return "moving";
}

export function tickWorld(world: World, realDt: number) {
  if (world.speed === 0) return;
  const dt = Math.min(realDt, 0.1) * world.speed;
  world.hour += dt / SECONDS_PER_HOUR;
  world.tickCount += 1;
  // Sparse node metadata is the clock index: no terrain-wide scan is needed.
  regrowResourceNodes(world);

  for (const p of world.people) {
    p.bob += dt * (p.path.length ? 10 : 4);
    if (p.isPlayer) {
      if (p.task !== "sleep" && !p.ghost) {
        p.hunger = Math.max(0, p.hunger - 3.2 * (dt / SECONDS_PER_HOUR));
        p.energy = Math.max(0, p.energy - 2.4 * (dt / SECONDS_PER_HOUR));
      }
      const movement = followPath(world, p, dt);
      if (movement === "stuck" && !replanIntentPath(world, p)) {
        world.player.intent.kind = "none";
        log(world, "The way closes.");
      }
      const oak = placeById("oakstand");
      const mere = placeById("southmere");
      if (Math.hypot(p.x - oak.tx, p.z - oak.ty) < oak.radius * 0.45) completeObjective(world, "oakstand");
      if (Math.hypot(p.x - mere.tx, p.z - mere.ty) < mere.radius + 2) completeObjective(world, "southmere");
      revealAround(world, Math.round(p.x), Math.round(p.z));
      continue;
    }
    if (p.role) {
      const home = p.home ?? { tx: Math.round(p.x), ty: Math.round(p.z) };
      if (Math.hypot(p.x - home.tx, p.z - home.ty) > 2.6) {
        const path = astar(world, Math.round(p.x), Math.round(p.z), home.tx, home.ty, 2000);
        if (path) p.path = path.map((n) => ({ tx: n.x, ty: n.y }));
      }
      followPath(world, p, dt);
      continue;
    }
    followPath(world, p, dt);
    if (!p.path.length && Math.random() < 0.01) {
      const dest = nearestWalkable(world, Math.round(p.x) + (Math.random() < 0.5 ? 4 : -4), Math.round(p.z) + (Math.random() < 0.5 ? 3 : -3));
      if (dest) {
        const path = astar(world, Math.round(p.x), Math.round(p.z), dest.x, dest.y, 1500);
        if (path) p.path = path.map((n) => ({ tx: n.x, ty: n.y }));
      }
    }
  }

  const note = tickPlayer(world, dt);
  if (note) log(world, note);
  tickWeather(world, dt);
  tickCrops(world);
  tickEcology(world, dt);
  tickPiles(world);
  tickCampfires(world);
  tickPets(world, dt);
  void COURT;
  void GATE;
  void tileOf;
  void you;
}

export function recruitPerson(world: World, id: string) {
  const p = world.people.find((x) => x.id === id);
  if (!p || p.member) return "They already belong.";
  if (p.role) return "They keep a stall.";
  if (world.gold < 20) return "Need 20 gold.";
  world.gold -= 20;
  p.member = true;
  completeObjective(world, "recruit");
  return `${p.name} stands with the hall.`;
}

export function assignVocation() {
  return;
}
