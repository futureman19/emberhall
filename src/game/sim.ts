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

type MotionWatch = { x: number; z: number; stillFor: number };
const motionWatches = new WeakMap<Person, MotionWatch>();

export function setSpeed(world: World, s: Speed) {
  world.speed = s;
}

function followPath(world: World, p: Person, dt: number): "idle" | "moving" | "stuck" {
  if (!p.path.length) {
    motionWatches.delete(p);
    return "idle";
  }
  const n = p.path[0]!;
  const here = tileOf(p.x, p.z);
  if (!lineWalkable(world, here.tx, here.ty, n.tx, n.ty)) {
    p.path = [];
    motionWatches.delete(p);
    return "stuck";
  }
  const dx = n.tx - p.x;
  const dz = n.ty - p.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.12) {
    p.path.shift();
    p.x = n.tx;
    p.z = n.ty;
    motionWatches.delete(p);
    return "moving";
  }
  const step = Math.min(dist, WALK_SPEED * (p.ghost ? 1.4 : 1) * dt);
  p.x += (dx / dist) * step;
  p.z += (dz / dist) * step;
  p.facing = Math.atan2(dx, dz);
  const previous = motionWatches.get(p);
  const moved = previous ? Math.hypot(p.x - previous.x, p.z - previous.z) : step;
  const stillFor = moved < 0.001 ? (previous?.stillFor ?? 0) + dt : 0;
  motionWatches.set(p, { x: p.x, z: p.z, stillFor });
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
