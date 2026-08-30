import { BARROW, MAP, PLACES, inGreybarrow } from "./atlas.ts";
import { FAUNA_META, isNight } from "./catalog.ts";
import { astar, nearestWalkable, tileOf } from "./pathfinding.ts";
import { sheltering } from "./weather.ts";
import { nid } from "./world.ts";
import type { Creature, FaunaKind, World } from "./types.ts";

function spawn(world: World, kind: FaunaKind, x: number, z: number): Creature {
  const meta = FAUNA_META[kind];
  return {
    id: nid(world, "f"),
    kind,
    x,
    z,
    hp: meta.hp,
    maxHp: meta.hp,
    path: [],
    task: "wander",
    taskUntil: world.hour + 0.4,
    corpseUntil: 0,
    home: { tx: Math.round(x), ty: Math.round(z) },
    ownerId: null,
    loyalty: 0,
    stay: false,
  };
}

export function seedFauna(world: World, rng: () => number) {
  if (world.fauna.length) return;
  for (const p of PLACES) {
    if (p.kind === "woods") {
      const taiga = p.id === "wolfhollow";
      const n = taiga ? 7 : 6;
      for (let i = 0; i < n; i++) {
        const x = p.tx + Math.floor((rng() - 0.5) * p.radius);
        const z = p.ty + Math.floor((rng() - 0.5) * p.radius);
        const dest = nearestWalkable(world, x, z);
        if (!dest) continue;
        const kind: FaunaKind = taiga
          ? rng() < 0.72
            ? "wolf"
            : "hare"
          : rng() < 0.55
            ? "hare"
            : rng() < 0.78
              ? "hart"
              : "wolf";
        world.fauna.push(spawn(world, kind, dest.x, dest.y));
      }
    }
  }
  const extra: { id: string; kind: FaunaKind; dx: number; dz: number }[] = [
    { id: "ridgewatch", kind: "hare", dx: 3, dz: 8 },
    { id: "ridgewatch", kind: "hare", dx: -4, dz: 6 },
    { id: "hearthfen", kind: "hare", dx: 6, dz: 2 },
    { id: "hearthfen", kind: "hare", dx: -5, dz: 4 },
    { id: "southmere", kind: "hart", dx: 4, dz: -3 },
    { id: "southmere", kind: "hart", dx: -5, dz: 2 },
    { id: "southmere", kind: "hare", dx: 2, dz: 5 },
    { id: "southmere", kind: "hare", dx: -3, dz: -6 },
    { id: "brinegate", kind: "hare", dx: -8, dz: -4 },
  ];
  for (const e of extra) {
    const p = PLACES.find((x) => x.id === e.id);
    if (!p) continue;
    const dest = nearestWalkable(world, p.tx + e.dx, p.ty + e.dz);
    if (dest) world.fauna.push(spawn(world, e.kind, dest.x, dest.y));
  }
}

export function seedBarrow(world: World, rng: () => number) {
  if (world.fauna.some((c) => c.kind === "wight")) return;
  for (let i = 0; i < 3; i++) {
    const x = BARROW.cx + Math.floor((rng() - 0.5) * 4);
    const z = BARROW.cy + 2 + i;
    world.fauna.push(spawn(world, "wight", x, z));
  }
  if (!world.piles.some((p) => p.label === "burial")) {
    world.piles.push({
      id: nid(world, "pile"),
      tx: BARROW.relic.tx,
      ty: BARROW.relic.ty,
      items: { relic: 1 },
      gold: 0,
      until: world.hour + 999,
      source: "drop",
      label: "burial",
    });
  }
}

export function tickEcology(world: World, dt: number) {
  const night = isNight(world.hour);
  const shelter = sheltering(world);
  for (const c of world.fauna) {
    if (c.task === "dead") {
      if (world.hour > c.corpseUntil) {
        world.fauna = world.fauna.filter((x) => x.id !== c.id);
      }
      continue;
    }
    if (c.kind === "wight" && !inGreybarrow(Math.round(c.x), Math.round(c.z))) {
      const dest = nearestWalkable(world, BARROW.cx, BARROW.cy);
      if (dest) {
        c.x = dest.x;
        c.z = dest.y;
        c.path = [];
      }
    }
    const you = world.people.find((p) => p.isPlayer);
    if (c.ownerId === world.player.id) {
      if (c.stay) {
        c.task = "idle";
        c.path = [];
        continue;
      }
      if (you && Math.hypot(c.x - you.x, c.z - you.z) > 3.2) {
        const dest = nearestWalkable(world, Math.round(you.x), Math.round(you.z));
        if (dest) {
          const path = astar(world, Math.round(c.x), Math.round(c.z), dest.x, dest.y, 2500);
          if (path) c.path = path.map((n) => ({ tx: n.x, ty: n.y }));
        }
        c.task = "follow";
      }
    } else if (shelter && (c.kind === "hare" || c.kind === "hart") && c.task !== "fight") {
      // Small game bolts for cover when the sky opens. Wolves don't mind the wet.
      const home = c.home;
      if (Math.hypot(c.x - home.tx, c.z - home.ty) > 1.5) {
        if (!c.path.length) {
          const dest = nearestWalkable(world, home.tx, home.ty);
          if (dest) {
            const path = astar(world, Math.round(c.x), Math.round(c.z), dest.x, dest.y, 1800);
            if (path) c.path = path.map((n) => ({ tx: n.x, ty: n.y }));
          }
        }
      } else {
        c.task = "idle";
        c.path = [];
      }
    } else if (c.task === "idle" && (c.kind === "hare" || c.kind === "hart")) {
      // The sky cleared — back to grazing.
      c.task = "wander";
      c.taskUntil = world.hour + 0.2 + Math.random() * 0.6;
    } else if (c.task === "wander" && !c.path.length && world.hour > c.taskUntil) {
      const home = c.home;
      const dest = nearestWalkable(
        world,
        home.tx + Math.floor((Math.random() - 0.5) * 8),
        home.ty + Math.floor((Math.random() - 0.5) * 8),
      );
      if (dest) {
        const path = astar(world, Math.round(c.x), Math.round(c.z), dest.x, dest.y, 1800);
        if (path) c.path = path.map((n) => ({ tx: n.x, ty: n.y }));
      }
      c.taskUntil = world.hour + 0.6 + Math.random();
    }
    if (you && c.kind === "wolf" && night && !c.ownerId && c.task !== "fight" && !you.ghost) {
      if (Math.hypot(c.x - you.x, c.z - you.z) < 10) {
        c.task = "fight";
        const path = astar(world, Math.round(c.x), Math.round(c.z), Math.round(you.x), Math.round(you.z), 2000);
        if (path) c.path = path.map((n) => ({ tx: n.x, ty: n.y }));
      }
    }
    if (c.path.length) {
      const n = c.path[0]!;
      const dx = n.tx - c.x;
      const dz = n.ty - c.z;
      const dist = Math.hypot(dx, dz);
      const step = Math.min(dist, 2.2 * dt);
      if (dist < 0.12) c.path.shift();
      else {
        c.x += (dx / dist) * step;
        c.z += (dz / dist) * step;
      }
    }
  }
  void MAP;
  void tileOf;
}
