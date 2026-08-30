import { BARROW, MAP, PLACES, inGreybarrow } from "./atlas.ts";
import { FAUNA_META, isNight } from "./catalog.ts";
import { astar, nearestWalkable, tileOf } from "./pathfinding.ts";
import { sheltering } from "./weather.ts";
import { nid } from "./world.ts";
import type { Creature, FaunaKind, World } from "./types.ts";

type SpawnEntry = { kind: FaunaKind; weight: number };

type SpawnZone = {
  placeId: string;
  count: number;
  pool: SpawnEntry[];
  radiusBias?: number;
};

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

function pickFauna(rng: () => number, pool: readonly SpawnEntry[]): FaunaKind {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  if (total <= 0) return pool[0]!.kind;
  let roll = rng() * total;
  for (const p of pool) {
    roll -= p.weight;
    if (roll <= 0) return p.kind;
  }
  return pool[0]!.kind;
}

function addZoneFauna(
  world: World,
  rng: () => number,
  placeId: string,
  count: number,
  pool: readonly SpawnEntry[],
  radiusBias = 1,
) {
  const p = PLACES.find((x) => x.id === placeId);
  if (!p) return;
  const radius = Math.max(2, Math.floor(p.radius * radiusBias));
  for (let i = 0; i < count; i++) {
    const x = p.tx + Math.floor((rng() - 0.5) * radius);
    const z = p.ty + Math.floor((rng() - 0.5) * radius);
    const dest = nearestWalkable(world, x, z);
    if (!dest) continue;
    world.fauna.push(spawn(world, pickFauna(rng, pool), dest.x, dest.y));
  }
}

const SHELTER_SEEKERS: ReadonlySet<FaunaKind> = new Set([
  "hare",
  "hart",
  "thornhide_doe",
  "moss_badger",
  "bog_toad",
]);
const WARDEN_KINDS: ReadonlySet<FaunaKind> = new Set(["wight", "greybarrow_wightling", "barrow_hound", "ashen_banshee", "bonecrow"]);
const NIGHT_HUNTERS: ReadonlySet<FaunaKind> = new Set([
  "wolf",
  "pine_lynx",
  "ridgeback_warg",
  "brine_hound",
  "brine_troll",
  "barrow_hound",
  "stonefang_ogre",
  "orc_marauder",
  "reedback_stalker",
  "orebeetle",
  "stonecrawl_spider",
  "coal_salamander",
  "brambleback_stag",
  "ironwood_boar",
  "thornhide_doe",
]);

const WOODLAND_POOL: SpawnEntry[] = [
  { kind: "hare", weight: 20 },
  { kind: "hart", weight: 12 },
  { kind: "wolf", weight: 10 },
  { kind: "pine_lynx", weight: 8 },
  { kind: "brambleback_stag", weight: 7 },
  { kind: "ironwood_boar", weight: 9 },
  { kind: "thornhide_doe", weight: 6 },
  { kind: "moss_badger", weight: 8 },
  { kind: "ember_fox", weight: 4 },
];

const HIGHLAND_POOL: SpawnEntry[] = [
  { kind: "ridgeback_warg", weight: 10 },
  { kind: "thornhide_doe", weight: 9 },
  { kind: "brambleback_stag", weight: 8 },
  { kind: "ironwood_boar", weight: 5 },
  { kind: "reedback_stalker", weight: 8 },
  { kind: "orebeetle", weight: 4 },
  { kind: "dune_crawler", weight: 2 },
];

const MARSH_POOL: SpawnEntry[] = [
  { kind: "mire_croaker", weight: 12 },
  { kind: "bog_toad", weight: 12 },
  { kind: "moss_badger", weight: 7 },
  { kind: "saltback_tortoise", weight: 4 },
  { kind: "bog_toad", weight: 6 },
  { kind: "brine_hound", weight: 5 },
  { kind: "ironwood_boar", weight: 3 },
];

const COAST_POOL: SpawnEntry[] = [
  { kind: "brine_hound", weight: 11 },
  { kind: "saltback_tortoise", weight: 9 },
  { kind: "dune_crawler", weight: 10 },
  { kind: "brine_troll", weight: 2 },
  { kind: "coal_salamander", weight: 6 },
  { kind: "bog_toad", weight: 7 },
];

const RUIN_POOL: SpawnEntry[] = [
  { kind: "wight", weight: 1 },
  { kind: "greybarrow_wightling", weight: 7 },
  { kind: "barrow_hound", weight: 8 },
  { kind: "ashen_banshee", weight: 4 },
  { kind: "bonecrow", weight: 6 },
  { kind: "stonecrawl_spider", weight: 6 },
  { kind: "orebeetle", weight: 4 },
];

const MINE_POOL: SpawnEntry[] = [
  { kind: "orebeetle", weight: 16 },
  { kind: "coal_salamander", weight: 8 },
  { kind: "stonecrawl_spider", weight: 4 },
  { kind: "mire_croaker", weight: 4 },
  { kind: "reedback_stalker", weight: 3 },
];

const SPAWN_ZONES: SpawnZone[] = [
  { placeId: "oakstand", count: 7, pool: WOODLAND_POOL },
  { placeId: "wolfhollow", count: 8, pool: [...WOODLAND_POOL, { kind: "pine_lynx", weight: 4 }, { kind: "brambleback_stag", weight: 4 }, { kind: "ridgeback_warg", weight: 4 }] },
  { placeId: "ridgewatch", count: 6, pool: HIGHLAND_POOL },
  { placeId: "hearthfen", count: 6, pool: MARSH_POOL },
  { placeId: "southmere", count: 7, pool: [...MARSH_POOL, { kind: "brine_hound", weight: 4 }, { kind: "bog_toad", weight: 6 }, { kind: "saltback_tortoise", weight: 4 }] },
  { placeId: "brinegate", count: 7, pool: COAST_POOL },
  { placeId: "ironfold", count: 5, pool: MINE_POOL },
  { placeId: "cairnash", count: 4, pool: RUIN_POOL },
  { placeId: "greybarrow", count: 5, pool: RUIN_POOL },
];

const EXTRA_SPAWNS: { id: string; kind: FaunaKind; dx: number; dz: number }[] = [
  { id: "ridgewatch", kind: "ironwood_boar", dx: 3, dz: 8 },
  { id: "ridgewatch", kind: "brambleback_stag", dx: -4, dz: 6 },
  { id: "hearthfen", kind: "moss_badger", dx: 6, dz: 2 },
  { id: "hearthfen", kind: "bog_toad", dx: -5, dz: 4 },
  { id: "southmere", kind: "saltback_tortoise", dx: 4, dz: -3 },
  { id: "southmere", kind: "orebeetle", dx: -5, dz: 2 },
  { id: "southmere", kind: "mire_croaker", dx: 2, dz: 5 },
  { id: "southmere", kind: "brine_hound", dx: -3, dz: -6 },
  { id: "brinegate", kind: "dune_crawler", dx: -8, dz: -4 },
  { id: "ironfold", kind: "coal_salamander", dx: 7, dz: 2 },
  { id: "cairnash", kind: "barrow_hound", dx: 6, dz: 3 },
  { id: "cairnash", kind: "bonecrow", dx: -6, dz: -1 },
];

function addExtraFauna(world: World, rng: () => number) {
  for (const e of EXTRA_SPAWNS) {
    const p = PLACES.find((x) => x.id === e.id);
    if (!p) continue;
    const dest = nearestWalkable(world, p.tx + e.dx, p.ty + e.dz);
    if (dest) world.fauna.push(spawn(world, e.kind, dest.x, dest.y));
  }
  void rng;
}

export function seedFauna(world: World, rng: () => number) {
  if (world.fauna.length) return;
  for (const zone of SPAWN_ZONES) {
    const pool = zone.pool;
    if (!pool.length || zone.count <= 0) continue;
    addZoneFauna(world, rng, zone.placeId, zone.count, pool, zone.radiusBias);
  }
  addExtraFauna(world, rng);
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
    if (WARDEN_KINDS.has(c.kind) && !inGreybarrow(Math.round(c.x), Math.round(c.z))) {
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
    } else if (shelter && SHELTER_SEEKERS.has(c.kind) && c.task !== "fight") {
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
    } else if (c.task === "idle" && SHELTER_SEEKERS.has(c.kind)) {
      // The sky cleared — back to grazing.
      c.task = "wander";
      c.taskUntil = world.hour + 0.2 + Math.random() * 0.6;
    } else if (c.task === "wander" && !c.path.length && world.hour > c.taskUntil) {
      const home = c.home;
      const scale = NIGHT_HUNTERS.has(c.kind) ? 10 : 8;
      const dest = nearestWalkable(
        world,
        home.tx + Math.floor((Math.random() - 0.5) * scale),
        home.ty + Math.floor((Math.random() - 0.5) * scale),
      );
      if (dest) {
        const path = astar(world, Math.round(c.x), Math.round(c.z), dest.x, dest.y, 1800);
        if (path) c.path = path.map((n) => ({ tx: n.x, ty: n.y }));
      }
      c.taskUntil = world.hour + 0.6 + Math.random();
    }
    if (you && NIGHT_HUNTERS.has(c.kind) && night && !c.ownerId && c.task !== "fight" && !you.ghost) {
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
