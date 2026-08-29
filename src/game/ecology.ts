import { BARROW, MAP, PLACES, inGreybarrow } from "./atlas";
import { FAUNA_META, isNight } from "./catalog";
import { astar, nearestWalkable, tileOf } from "./pathfinding";
import { nid } from "./world";
import type { Creature, FaunaKind, World } from "./types";

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
  const oak = PLACES.find((p) => p.id === "oakstand")!;
  world.fauna.push(spawn(world, "hare", oak.tx + 2, oak.ty + 4));
  for (const p of PLACES) {
    if (p.kind === "woods") {
      const n = p.id === "oakstand" ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const x = p.tx + Math.floor((rng() - 0.5) * p.radius);
        const z = p.ty + Math.floor((rng() - 0.5) * p.radius);
        const dest = nearestWalkable(world, x, z);
        if (!dest) continue;
        const kind: FaunaKind = rng() < 0.45 ? "hare" : rng() < 0.7 ? "hart" : "wolf";
        world.fauna.push(spawn(world, kind, dest.x, dest.y));
      }
    }
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
