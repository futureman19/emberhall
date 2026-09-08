import { BARROW, MAP, PLACES, inGreybarrow } from "./atlas.ts";
import { CURSE_SLOW, FAUNA_META, isNight, POISON_TICK_HOURS } from "./catalog.ts";
import { astar, nearestWalkable, tileOf } from "./pathfinding.ts";
import { spawnCorpsePile } from "./piles.ts";
import { sheltering } from "./weather.ts";
import { log, nid } from "./world.ts";
import type { Creature, FaunaKind, World } from "./types.ts";

type SpawnEntry = { kind: FaunaKind; weight: number };

type SpawnZone = {
  placeId: string;
  count: number;
  pool: SpawnEntry[];
  radiusBias?: number;
};

export function spawn(world: World, kind: FaunaKind, x: number, z: number): Creature {
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
  "frosthorn_ram",
  "redtail_squirrel",
  "whiteback_elk",
  "highland_aurochs",
  "reed_heron",
  "river_otter",
  "cave_mole",
  "dusk_owl",
]);
const WARDEN_KINDS: ReadonlySet<FaunaKind> = new Set(["wight", "greybarrow_wightling", "barrow_hound", "ashen_banshee", "bonecrow", "tomb_sentinel", "ossuary_knight", "grave_lich"]);
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
  "oak_bear",
  "fen_leech",
  "tideclaw_crab",
  "cavern_bat",
  "tomb_sentinel",
  "cinder_drake",
  "willow_wisp",
  "blackbriar_hag",
  "rime_revenant",
  "fen_ghoul",
  "drowned_reaver",
  "deepmaw_basilisk",
  "ossuary_knight",
  "ash_demon",
  "grave_lich",
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
  { kind: "oak_bear", weight: 3 },
  { kind: "willow_wisp", weight: 2 },
  { kind: "blackbriar_hag", weight: 1 },
  { kind: "redtail_squirrel", weight: 9 },
  { kind: "whiteback_elk", weight: 4 },
  { kind: "dusk_owl", weight: 3 },
];

const HIGHLAND_POOL: SpawnEntry[] = [
  { kind: "ridgeback_warg", weight: 10 },
  { kind: "thornhide_doe", weight: 9 },
  { kind: "brambleback_stag", weight: 8 },
  { kind: "ironwood_boar", weight: 5 },
  { kind: "reedback_stalker", weight: 8 },
  { kind: "orebeetle", weight: 4 },
  { kind: "dune_crawler", weight: 2 },
  { kind: "stonefang_ogre", weight: 1 },
  { kind: "orc_marauder", weight: 1 },
  { kind: "frosthorn_ram", weight: 8 },
  { kind: "cinder_drake", weight: 1 },
  { kind: "rime_revenant", weight: 2 },
  { kind: "ash_demon", weight: 1 },
  { kind: "whiteback_elk", weight: 6 },
  { kind: "highland_aurochs", weight: 6 },
];

const MARSH_POOL: SpawnEntry[] = [
  { kind: "mire_croaker", weight: 12 },
  { kind: "bog_toad", weight: 12 },
  { kind: "moss_badger", weight: 7 },
  { kind: "saltback_tortoise", weight: 4 },
  { kind: "bog_toad", weight: 6 },
  { kind: "brine_hound", weight: 5 },
  { kind: "ironwood_boar", weight: 3 },
  { kind: "fen_leech", weight: 5 },
  { kind: "willow_wisp", weight: 2 },
  { kind: "fen_ghoul", weight: 3 },
  { kind: "reed_heron", weight: 8 },
  { kind: "river_otter", weight: 6 },
];

const COAST_POOL: SpawnEntry[] = [
  { kind: "brine_hound", weight: 11 },
  { kind: "saltback_tortoise", weight: 9 },
  { kind: "dune_crawler", weight: 10 },
  { kind: "brine_troll", weight: 2 },
  { kind: "coal_salamander", weight: 6 },
  { kind: "bog_toad", weight: 7 },
  { kind: "tideclaw_crab", weight: 8 },
  { kind: "drowned_reaver", weight: 2 },
  { kind: "brine_seal", weight: 7 },
  { kind: "river_otter", weight: 5 },
  { kind: "reed_heron", weight: 4 },
];

const RUIN_POOL: SpawnEntry[] = [
  { kind: "wight", weight: 1 },
  { kind: "greybarrow_wightling", weight: 7 },
  { kind: "barrow_hound", weight: 8 },
  { kind: "ashen_banshee", weight: 4 },
  { kind: "bonecrow", weight: 6 },
  { kind: "stonecrawl_spider", weight: 6 },
  { kind: "orebeetle", weight: 4 },
  { kind: "tomb_sentinel", weight: 3 },
  { kind: "willow_wisp", weight: 2 },
  { kind: "ossuary_knight", weight: 3 },
  { kind: "grave_lich", weight: 1 },
  { kind: "dusk_owl", weight: 4 },
];

const MINE_POOL: SpawnEntry[] = [
  { kind: "orebeetle", weight: 16 },
  { kind: "coal_salamander", weight: 8 },
  { kind: "stonecrawl_spider", weight: 4 },
  { kind: "mire_croaker", weight: 4 },
  { kind: "reedback_stalker", weight: 3 },
  { kind: "cavern_bat", weight: 10 },
  { kind: "cinder_drake", weight: 2 },
  { kind: "deepmaw_basilisk", weight: 3 },
  { kind: "ash_demon", weight: 1 },
  { kind: "cave_mole", weight: 8 },
  { kind: "dusk_owl", weight: 2 },
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

const EXTRA_SPAWNS: { id: string; kind: FaunaKind; dx: number; dz: number; ensure?: boolean }[] = [
  { id: "ridgewatch", kind: "ironwood_boar", dx: 3, dz: 8 },
  { id: "ridgewatch", kind: "brambleback_stag", dx: -4, dz: 6 },
  { id: "ridgewatch", kind: "stonefang_ogre", dx: 2, dz: -5 },
  { id: "ridgewatch", kind: "orc_marauder", dx: -2, dz: 3 },
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
  { id: "oakstand", kind: "oak_bear", dx: -7, dz: 5, ensure: true },
  { id: "ridgewatch", kind: "frosthorn_ram", dx: 7, dz: -2, ensure: true },
  { id: "hearthfen", kind: "fen_leech", dx: -6, dz: -3, ensure: true },
  { id: "brinegate", kind: "tideclaw_crab", dx: 6, dz: -6, ensure: true },
  { id: "ironfold", kind: "cavern_bat", dx: -5, dz: 4, ensure: true },
  { id: "greybarrow", kind: "tomb_sentinel", dx: 3, dz: 5, ensure: true },
  { id: "ironfold", kind: "cinder_drake", dx: 6, dz: -4, ensure: true },
  { id: "southmere", kind: "willow_wisp", dx: 5, dz: 5, ensure: true },
  { id: "wolfhollow", kind: "blackbriar_hag", dx: 5, dz: -7, ensure: true },
  { id: "ridgewatch", kind: "rime_revenant", dx: -7, dz: -4, ensure: true },
  { id: "hearthfen", kind: "fen_ghoul", dx: 4, dz: -6, ensure: true },
  { id: "brinegate", kind: "drowned_reaver", dx: -5, dz: 6, ensure: true },
  { id: "ironfold", kind: "deepmaw_basilisk", dx: -7, dz: -3, ensure: true },
  { id: "greybarrow", kind: "ossuary_knight", dx: -4, dz: 6, ensure: true },
  { id: "cairnash", kind: "ash_demon", dx: 4, dz: -6, ensure: true },
  { id: "greybarrow", kind: "grave_lich", dx: 0, dz: 6, ensure: true },
  { id: "oakstand", kind: "redtail_squirrel", dx: 6, dz: 6, ensure: true },
  { id: "ridgewatch", kind: "whiteback_elk", dx: -6, dz: 7, ensure: true },
  { id: "ridgewatch", kind: "highland_aurochs", dx: 8, dz: 5, ensure: true },
  { id: "hearthfen", kind: "reed_heron", dx: 7, dz: -5, ensure: true },
  { id: "southmere", kind: "river_otter", dx: -7, dz: -4, ensure: true },
  { id: "brinegate", kind: "brine_seal", dx: 8, dz: 3, ensure: true },
  { id: "ironfold", kind: "cave_mole", dx: 4, dz: 7, ensure: true },
  { id: "cairnash", kind: "dusk_owl", dx: -7, dz: 5, ensure: true },
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

/** Add expansion fauna missing from a continued world without duplicating survivors. */
export function ensureExpansionFauna(world: World) {
  const present = new Set(world.fauna.map((creature) => creature.kind));
  for (const entry of EXTRA_SPAWNS) {
    if (!entry.ensure || present.has(entry.kind)) continue;
    const place = PLACES.find((candidate) => candidate.id === entry.id);
    if (!place) continue;
    const dest = nearestWalkable(world, place.tx + entry.dx, place.ty + entry.dz);
    if (!dest) continue;
    world.fauna.push(spawn(world, entry.kind, dest.x, dest.y));
    present.add(entry.kind);
  }
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
    // Kal Xen loosens — a bound beast crumbles back into the vale.
    if (c.boundUntil && world.hour >= c.boundUntil) {
      world.fauna = world.fauna.filter((x) => x.id !== c.id);
      log(world, `The binding loosens; the ${FAUNA_META[c.kind].label.toLowerCase()} returns to the vale.`);
      continue;
    }
    // An Ex Por holds — no stride, no shelter, no hunt. The lock simply keeps.
    if (c.paralyzeUntil && world.hour < c.paralyzeUntil) {
      c.path = [];
      continue;
    }
    if (c.paralyzeUntil && world.hour >= c.paralyzeUntil) {
      c.paralyzeUntil = 0;
      c.task = "wander";
      c.taskUntil = world.hour + 0.4;
    }
    // Venom keeps its teeth — the Poison spell's damage-over-time.
    if (c.poisonUntil && c.poisonUntil > 0) {
      if (world.hour >= c.poisonUntil) {
        c.poisonUntil = 0;
        c.poisonTickAt = 0;
      } else if (world.hour >= (c.poisonTickAt ?? 0)) {
        c.hp -= 1;
        c.poisonTickAt = world.hour + POISON_TICK_HOURS;
        if (c.hp <= 0) {
          c.hp = 0;
          c.task = "dead";
          c.path = [];
          c.corpseUntil = world.hour + 8;
          spawnCorpsePile(world, c);
          continue;
        }
      }
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
    if (you && NIGHT_HUNTERS.has(c.kind) && night && !c.ownerId && c.task !== "fight" && !you.ghost && world.hour >= world.player.invisUntil) {
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
      const slow = c.curseUntil && world.hour < c.curseUntil ? CURSE_SLOW : 1;
      const step = Math.min(dist, 2.2 * dt * slow);
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
