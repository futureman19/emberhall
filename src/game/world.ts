import {
  BARROW,
  CHUNK,
  COURT,
  EMBERHALL_BANK,
  EMBERHALL_BANKER,
  GATE,
  MAP,
  PLACES,
  ROADS,
  inBounds,
  inGreybarrow,
  placeById,
} from "./atlas.ts";
import { emptyChest, emptyLastGain, emptyPack, emptySkills } from "./catalog.ts";
import { ensureCity, stampCityTiles } from "./city.ts";
import { personName } from "./names.ts";
import { hash2, irange, mulberry32, pick } from "./rng.ts";
import { buildingBox, boxesOverlap, siteError } from "./building-size.ts";
import { seedFarmPlots } from "./farm.ts";
import { initialWeather } from "./weather.ts";
import { createResourceInventory } from "./inventory/resources.ts";
import { createResourceNodeStateMap } from "./resources/state.ts";
import type { BuildingKind, ClassId, Person, Tile, TileKind, World } from "./types.ts";
import { emitConstructionFx } from "./construction-animation.ts";

let nidAcc = 1;
export function nid(world: World, prefix: string) {
  nidAcc += 1;
  return `${prefix}-${world.tickCount + nidAcc}`;
}

export function log(world: World, text: string) {
  world.log.unshift({ t: world.hour, text });
  if (world.log.length > 48) world.log.length = 48;
}

export function completeObjective(world: World, id: string) {
  const o = world.objectives.find((x) => x.id === id);
  if (o && !o.done) o.done = true;
}

export function revealAround(world: World, x: number, z: number, r = 10) {
  const cx = Math.floor(x / CHUNK);
  const cy = Math.floor(z / CHUNK);
  const cr = Math.ceil(r / CHUNK);
  let added = false;
  for (let y = cy - cr; y <= cy + cr; y++) {
    for (let xx = cx - cr; xx <= cr + cx; xx++) {
      const k = `${xx},${y}`;
      if (!world.seen[k]) {
        world.seen[k] = true;
        added = true;
      }
    }
  }
  if (added) world.seenRev += 1;
}

function fbm(x: number, y: number, seed: number) {
  let v = 0;
  let a = 0.55;
  let f = 0.018;
  for (let i = 0; i < 4; i++) {
    v += a * hash2(x * f, y * f, seed + i * 19);
    a *= 0.5;
    f *= 2.05;
  }
  return v;
}

function paintLine(tiles: Tile[][], ax: number, ay: number, bx: number, by: number, kind: TileKind, w = 1) {
  const n = Math.max(1, Math.hypot(bx - ax, by - ay));
  const steps = Math.ceil(n);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(ax + (bx - ax) * t);
    const y = Math.round(ay + (by - ay) * t);
    for (let dy = -w; dy <= w; dy++) {
      for (let dx = -w; dx <= w; dx++) {
        if (!inBounds(x + dx, y + dy)) continue;
        const tile = tiles[y + dy]![x + dx]!;
        if (tile.kind === "water" && kind !== "road") continue;
        if (kind === "road" && Math.abs(dx) + Math.abs(dy) > w) continue;
        tile.kind = kind === "road" && Math.abs(dx) + Math.abs(dy) === 0 ? "road" : kind === "road" ? "dirt" : kind;
      }
    }
  }
}

function flatten(tiles: Tile[][], cx: number, cy: number, r: number, h: number, kind?: TileKind) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!inBounds(x, y)) continue;
      if (Math.hypot(x - cx, y - cy) > r) continue;
      const t = tiles[y]![x]!;
      t.h = h;
      if (kind) t.kind = kind;
    }
  }
}

export function generateTiles(seed: number): Tile[][] {
  const tiles: Tile[][] = new Array(MAP);
  for (let y = 0; y < MAP; y++) {
    const row: Tile[] = new Array(MAP);
    for (let x = 0; x < MAP; x++) {
      const n = fbm(x, y, seed);
      let h = Math.round(1 + n * 7 + (1 - y / MAP) * 3);
      let kind: TileKind = "grass";
      if (y > 360 && y < 410 && Math.abs(x - 256) > 6) {
        const river = Math.abs(y - (384 + Math.sin(x * 0.04) * 6));
        if (river < 3.2) {
          kind = "water";
          h = 0;
        } else if (river < 5) {
          kind = "sand";
          h = 1;
        }
      }
      if (x > 450 && y > 390) {
        if (n > 0.42) {
          kind = "sand";
          h = 1;
        }
      }
      if (kind === "grass" && hash2(x, y, seed + 3) > 0.91) kind = "tree";
      row[x] = { h: Math.max(0, h), kind };
    }
    tiles[y] = row;
  }

  for (const [a, b] of ROADS) {
    const pa = placeById(a);
    const pb = placeById(b);
    paintLine(tiles, pa.tx, pa.ty, pb.tx, pb.ty, "road", 1);
  }

  for (const p of PLACES) {
    if (p.kind === "woods") {
      for (let y = p.ty - p.radius; y <= p.ty + p.radius; y++) {
        for (let x = p.tx - p.radius; x <= p.tx + p.radius; x++) {
          if (!inBounds(x, y)) continue;
          const t = tiles[y]![x]!;
          if (t.kind === "road" || t.kind === "water") continue;
          if (Math.hypot(x - p.tx, y - p.ty) > p.radius) continue;
          if (hash2(x, y, seed + 7) > 0.62) t.kind = "tree";
        }
      }
    }
    if (p.kind === "mine") {
      for (let y = p.ty - p.radius; y <= p.ty + p.radius; y++) {
        for (let x = p.tx - p.radius; x <= p.tx + p.radius; x++) {
          if (!inBounds(x, y)) continue;
          const t = tiles[y]![x]!;
          if (t.kind === "road" || t.kind === "water") continue;
          if (Math.hypot(x - p.tx, y - p.ty) > p.radius) continue;
          t.h = Math.max(t.h, 4);
          if (hash2(x, y, seed + 11) > 0.7) t.kind = "rock";
        }
      }
    }
    if (p.kind === "town") flatten(tiles, p.tx, p.ty, 5, tiles[p.ty]![p.tx]!.h, "dirt");
    if (p.kind === "ridge") flatten(tiles, p.tx, p.ty, 8, 8, "dirt");
  }

  flatten(tiles, COURT.tx, COURT.ty, 8, 3, "cobble");
  for (let y = COURT.ty + 4; y <= GATE.ty; y++) {
    for (let x = COURT.tx - 1; x <= COURT.tx + 1; x++) {
      const t = tiles[y]![x]!;
      t.kind = y === COURT.ty + 4 ? "step" : "dirt";
      t.h = y === COURT.ty + 4 ? 2 : 1;
    }
  }
  tiles[GATE.ty]![GATE.tx]!.kind = "cobble";

  for (let y = BARROW.cy - 8; y <= BARROW.cy + 8; y++) {
    for (let x = BARROW.cx - 6; x <= BARROW.cx + 6; x++) {
      if (!inBounds(x, y)) continue;
      const t = tiles[y]![x]!;
      if (inGreybarrow(x, y)) {
        t.h = 0;
        t.kind = "pit";
      } else if (Math.abs(x - BARROW.cx) <= 5 && Math.abs(y - BARROW.cy) <= 9) {
        if (t.kind !== "road") t.kind = "rock";
      }
    }
  }
  for (let y = BARROW.mouth.ty; y <= 432; y++) {
    tiles[y]![BARROW.cx]!.kind = "step";
    tiles[y]![BARROW.cx]!.h = y === BARROW.mouth.ty ? 1 : 0;
    tiles[y]![BARROW.cx - 1]!.kind = "step";
    tiles[y]![BARROW.cx - 1]!.h = 1;
  }
  flatten(tiles, 261, 304, 2, 1, "cobble");

  stampCityTiles(tiles);
  return tiles;
}

export function seedFieldStones(world: World) {
  const { tiles, seed } = world;
  const iron = placeById("ironfold");
  for (let y = 0; y < MAP; y++) {
    for (let x = 0; x < MAP; x++) {
      const t = tiles[y]![x]!;
      const field = hash2(x, y, seed + 19) >= 0.99;
      const named =
        Math.hypot(x - iron.tx, y - iron.ty) <= iron.radius ||
        (Math.abs(x - BARROW.cx) <= 5 && Math.abs(y - BARROW.cy) <= 9);
      if (t.kind === "rock" && !named && !field) {
        t.kind = "grass";
        continue;
      }
      if (t.kind !== "grass") continue;
      if (Math.hypot(x - COURT.tx, y - COURT.ty) < 10) continue;
      if (!field) continue;
      if (world.plots?.some((p) => p.tx === x && p.ty === y)) continue;
      let taken = false;
      for (const b of world.buildings) {
        const box = buildingBox(b.kind, b.tx, b.ty);
        if (x + 0.5 > box.x0 && x + 0.5 < box.x1 && y + 0.5 > box.z0 && y + 0.5 < box.z1) {
          taken = true;
          break;
        }
      }
      if (taken) continue;
      t.kind = "rock";
    }
  }
}

export function createPerson(
  world: World,
  rng: () => number,
  opts: { x: number; z: number; cls?: ClassId; member?: boolean; role?: Person["role"]; name?: string; isPlayer?: boolean },
): Person {
  const cls = opts.cls ?? pick(rng, ["ranger", "warrior", "mage", "rogue", "merchant"] as ClassId[]);
  return {
    id: nid(world, opts.isPlayer ? "you" : "p"),
    name: opts.name ?? personName(rng),
    cls,
    isPlayer: Boolean(opts.isPlayer),
    member: Boolean(opts.member || opts.isPlayer),
    role: opts.role ?? null,
    vocation: null,
    x: opts.x,
    z: opts.z,
    facing: 0,
    hp: 40,
    maxHp: 40,
    hunger: 80,
    energy: 80,
    morale: 70,
    int: 8 + irange(rng, 0, 4),
    str: 8 + irange(rng, 0, 4),
    dex: 8 + irange(rng, 0, 4),
    path: [],
    task: "idle",
    taskUntil: 0,
    lingerUntil: world.hour + 8,
    awayUntil: 0,
    home: { tx: Math.round(opts.x), ty: Math.round(opts.z) },
    bob: 0,
    ghost: false,
  };
}

export function placeBuilding(world: World, kind: BuildingKind, tx: number, ty: number) {
  const err = siteError(world, kind, tx, ty);
  if (err) return err;
  const cost = kind === "dormitory" ? 40 : 28;
  const id = nid(world, "b");
  world.buildings.push({
    id,
    kind,
    tx,
    ty,
    beds: kind === "dormitory" ? [{ occupantId: null }, { occupantId: null }] : [],
  });
  emitConstructionFx(world, id, kind, tx, ty, "gold");
  world.gold -= cost;
  if (kind === "dormitory") completeObjective(world, "dorm");
  if (kind === "farm") {
    seedFarmPlots(world, tx, ty);
    completeObjective(world, "farm");
  }
  log(world, `The ${kind} is raised.`);
  return null;
}

function baseWorld(seed: number, tiles: Tile[][]): World {
  return {
    seed,
    hour: 8,
    speed: 1,
    gold: 80,
    prestige: 1,
    tiles,
    people: [],
    fauna: [],
    piles: [],
    campfires: [],
    buildings: [],
    plots: [],
    saplings: [],
    plantedTimber: {},
    player: {
      id: "",
      skills: emptySkills(),
      lastGain: emptyLastGain(),
      pack: { ...emptyPack(), hatchet: 0 },
      resources: createResourceInventory(),
      chest: emptyChest(),
      wear: { head: "hood", hands: "gloves", neck: "pendant", finger: "ring", main: "hatchet" },
      rares: [],
      wearRare: {},
      vault: 0,
      notoriety: "innocent",
      criminalUntil: 0,
      intent: { kind: "none", tx: 0, ty: 0, targetId: null, spell: null },
      mana: 22,
      nightSightUntil: 0,
      armedSpell: null,
      marks: [],
      gateCoolUntil: 0,
      ghost: false,
      corpseAt: null,
      workT: 0,
    },
    log: [],
    objectives: [
      { id: "chop", text: "Chop a tree with your hatchet", done: false },
      { id: "forest", text: "Plant an acorn on grass or dirt", done: false },
      { id: "plank", text: "Saw a log into boards at the yard", done: false },
      { id: "smelt", text: "Smelt ore at a forge", done: false },
      { id: "smith", text: "Beat ingot into a tool at the fire", done: false },
      { id: "hunt", text: "Bring down a beast", done: false },
      { id: "skin", text: "Dress a kill with the knife", done: false },
      { id: "oakstand", text: "Walk the north road to Oakstand", done: false },
      { id: "southmere", text: "Cross the Ford and reach Southmere", done: false },
      { id: "dress", text: "Hold a tool or wear something from You", done: false },
      { id: "npc", text: "Talk to a banker, healer, or stall", done: false },
      { id: "pile", text: "Drop something on the dirt, then pick it up", done: false },
      { id: "gate", text: "Step through a moongate", done: false },
      { id: "tame", text: "Tame a beast — right-click, then Tame", done: false },
      { id: "barrow", text: "Descend the Greybarrow", done: false },
      { id: "relic", text: "Take the relic from the burial", done: false },
      { id: "book", text: "Open your spellbook", done: false },
      { id: "healcast", text: "Cast Heal from the book", done: false },
      { id: "arrow", text: "Bring down a beast with Magic Arrow", done: false },
      { id: "teleport", text: "Teleport a few paces", done: false },
      { id: "fireball", text: "Strike with Fireball", done: false },
      { id: "mark", text: "Mark a place from the book", done: false },
      { id: "recall", text: "Recall to a mark", done: false },
      { id: "die", text: "Fall, and walk as a ghost", done: false },
      { id: "rise", text: "Ask a healer to return you", done: false },
      { id: "recover", text: "Take back what your corpse kept", done: false },
      { id: "recruit", text: "Recruit a traveler", done: false },
      { id: "dorm", text: "Raise a dormitory", done: false },
      { id: "farm", text: "Raise a farm", done: false },
      { id: "till", text: "Till a plot of land", done: false },
      { id: "plant", text: "Sow a seed in a bed", done: false },
      { id: "harvest", text: "Take a crop from the dirt", done: false },
    ],
    quests: [],
    rep: {},
    resourceNodes: createResourceNodeStateMap(),
    scars: {},
    seen: {},
    seenRev: 0,
    landRev: 1,
    tickCount: 0,
    restored: false,
    weather: initialWeather(seed, 8),
    boom: null,
    nightOffer: null,
  };
}

export function createStubWorld(): World {
  const tiles: Tile[][] = [];
  for (let y = 0; y < MAP; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < MAP; x++) row.push({ h: 1, kind: "grass" });
    tiles.push(row);
  }
  flatten(tiles, COURT.tx, COURT.ty, 8, 3, "cobble");
  const w = baseWorld(1, tiles);
  return w;
}

export function createWorld(): World {
  const seed = (Math.random() * 1e9) | 0;
  const tiles = generateTiles(seed);
  const world = baseWorld(seed, tiles);
  const rng = mulberry32(seed);
  const you = createPerson(world, rng, {
    x: COURT.tx,
    z: COURT.ty + 1,
    cls: "ranger",
    member: true,
    isPlayer: true,
  });
  world.player.id = you.id;
  world.people.push(you);
  world.people.push(
    createPerson(world, rng, { x: COURT.tx + 1, z: COURT.ty, cls: "ranger", member: true }),
    createPerson(world, rng, { x: COURT.tx - 1, z: COURT.ty + 1, cls: "merchant" }),
  );
  world.buildings.push({
    id: nid(world, "b"),
    kind: "hall",
    tx: COURT.tx,
    ty: COURT.ty - 2,
    beds: [{ occupantId: you.id }, { occupantId: null }],
  });
  world.buildings.push(
    { id: nid(world, "b"), kind: "notice", tx: COURT.tx + 7, ty: COURT.ty - 1, beds: [] },
    { id: nid(world, "b"), kind: "yard", tx: COURT.tx - 8, ty: COURT.ty - 1, beds: [] },
  );
  seedTownNpcs(world, rng);
  seedEmberhallBank(world);
  ensureCity(world);
  log(world, `You are ${you.name}. The vale is a country — Ridgewatch to Brinegate. Follow the dirt.`);
  revealAround(world, COURT.tx, COURT.ty, 28);
  return world;
}

export function seedTownNpcs(world: World, rng: () => number) {
  if (world.people.some((p) => p.role)) return;
  const spots: { x: number; z: number; role: Person["role"]; name: string; cls: ClassId }[] = [
    { x: EMBERHALL_BANKER.x, z: EMBERHALL_BANKER.z, role: "banker", name: "Old Pell", cls: "merchant" },
    { x: COURT.tx - 4, z: COURT.ty + 2, role: "provisioner", name: "Brann Wain", cls: "merchant" },
    { x: COURT.tx + 2, z: COURT.ty + 3, role: "healer", name: "Ione Hale", cls: "mage" },
    { x: 98, z: 302, role: "provisioner", name: "Kip Reed", cls: "merchant" },
    { x: 362, z: 458, role: "healer", name: "Mira Dusk", cls: "mage" },
  ];
  for (const s of spots) {
    const p = createPerson(world, rng, { x: s.x, z: s.z, cls: s.cls, name: s.name, role: s.role });
    p.home = { tx: s.x, ty: s.z };
    world.people.push(p);
  }
  void rng;
}

/** Raise the hall bank if a save predates it, and keep Pell on the door. */
export function seedEmberhallBank(world: World) {
  if (!world.buildings.some((b) => b.kind === "bank")) {
    const { tx, ty } = EMBERHALL_BANK;
    const box = buildingBox("bank", tx, ty);
    const taken = world.buildings.some((b) => boxesOverlap(box, buildingBox(b.kind, b.tx, b.ty)));
    if (!taken) {
      world.buildings.push({ id: nid(world, "b"), kind: "bank", tx, ty, beds: [] });
    }
  }
  const pell = world.people.find((p) => p.role === "banker" && p.name === "Old Pell");
  if (!pell) return;
  pell.x = EMBERHALL_BANKER.x;
  pell.z = EMBERHALL_BANKER.z;
  pell.path = [];
  pell.home = { tx: Math.round(pell.x), ty: Math.round(pell.z) };
}
