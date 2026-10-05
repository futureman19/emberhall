import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  EARTHQUAKE_RADIUS,
  FAUNA_META,
  FLAME_WALL_HOURS,
  NATURES_FURY_RADIUS,
  SANCTUARY_RADIUS,
  STONE_WALL_RADIUS,
  TAR_PIT_RADIUS,
  ZONE_CAP,
} from "./catalog.ts";
import { strikePlayer, tickEcology } from "./ecology.ts";
import {
  SPELL_CIRCLES,
  SPELL_META,
  ZONE_SPELLS,
  commandCast,
  spellSfx,
} from "./magery.ts";
import { spellFxProfile } from "./magery-animation.ts";
import { astar, walkable } from "./pathfinding.ts";
import { tickPlayer } from "./player.ts";
import type { Creature, FaunaKind, SpellId, World } from "./types.ts";
import { createPerson, createStubWorld } from "./world.ts";
import { placeZone, sanctuaryAt, tickZones, zoneBlocksAt } from "./zones.ts";

/**
 * Batch two of the spellbook expansion: the ground-zone system. One placed-
 * working machinery (zones.ts) powers Flame Wall, Tar Pit, Wall of Stone,
 * Sanctuary, Earthquake and Nature's Fury.
 * Run: node --experimental-strip-types --test src/game/magery-batch2.test.ts
 */

const BATCH2: SpellId[] = ["flamewall", "tarpit", "stonewall", "sanctuary", "earthquake", "naturesfury"];

const originalRandom = Math.random;
function withRandom<T>(value: number, fn: () => T): T {
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

function creature(kind: FaunaKind, x: number, z: number, hp?: number): Creature {
  const base = FAUNA_META[kind].hp;
  return {
    id: `b2-${kind}-${x}-${z}-${Math.floor(base)}`,
    kind,
    x,
    z,
    hp: hp ?? base,
    maxHp: hp ?? base,
    path: [],
    task: "wander",
    taskUntil: 0,
    corpseUntil: 0,
    home: { tx: Math.round(x), ty: Math.round(z) },
    ownerId: null,
    loyalty: 0,
    stay: false,
  };
}

function fixture() {
  const world = createStubWorld();
  const player = createPerson(world, () => 0.5, { x: 30, z: 30, isPlayer: true, member: true });
  world.people.push(player);
  world.player.id = player.id;
  world.player.pack.spellbook = 1;
  world.player.skills.magery = 50;
  world.player.mana = 90;
  for (const id of ["silk", "ash", "garlic", "ginseng", "pearl", "mandrake", "nightshade", "moss"] as const) {
    world.player.pack[id] = 8;
  }
  return { world, player };
}

function tickUntilNote(world: World): string {
  for (let i = 0; i < 40; i++) {
    const note = tickPlayer(world, 0.1);
    if (note !== null) return note;
    if (world.player.intent.kind === "none" && world.player.armedSpell === null) return "intent cleared without a note";
  }
  return "beat never landed";
}

test("batch two - every zone spell has meta, a circle, a profile, and a voice on disk", () => {
  const circles = new Set(SPELL_CIRCLES.flatMap((c) => c.ids));
  for (const id of BATCH2) {
    const meta = SPELL_META[id];
    assert.ok(meta, `${id} has meta`);
    assert.ok(meta.words.length > 2, `${id} has words of power`);
    assert.ok(circles.has(id), `${id} sits in a circle`);
    assert.ok(ZONE_SPELLS.has(id), `${id} rides the ground-zone path`);
    const profile = spellFxProfile(id);
    assert.ok(profile.duration > 0.2, `${id} has a release profile`);
    assert.equal(spellSfx(id), `spell_${id}`);
    const file = path.join(process.cwd(), "public", "audio", "sfx", `spell-${id}.mp3`);
    assert.ok(existsSync(file), `${file} exists`);
  }
  const fifth = SPELL_CIRCLES.find((c) => c.circle === 5);
  assert.ok(fifth, "the fifth circle opens");
  for (const id of ["earthquake", "naturesfury"]) {
    assert.ok(fifth.ids.includes(id as SpellId), `the fifth circle holds ${id}`);
  }
});

test("flame wall - the ring keeps its teeth until the working lapses", () => {
  const { world, player } = fixture();
  const inside = creature("wolf", 32, 30, 200);
  const outside = creature("wolf", 40, 30, 200);
  world.fauna.push(inside, outside);
  assert.equal(commandCast(world, "flamewall", { kind: "tile", tx: 32, ty: 30 }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Vas Flam Hur/);
  const zone = world.zones.find((z) => z.kind === "flamewall");
  assert.ok(zone, "the working stands");
  assert.equal(zone.tx, 32);
  assert.equal(zone.ownerId, player.id);
  const hpBefore = inside.hp;
  world.hour += 0.09;
  tickZones(world, 0.016);
  assert.ok(inside.hp < hpBefore, "the fire bites what stands in it");
  assert.equal(outside.hp, 200, "outside the ring stands untouched");
  world.hour += FLAME_WALL_HOURS + 0.1;
  tickZones(world, 0.016);
  assert.ok(!world.zones.some((z) => z.id === zone.id), "the working lapses");
});

test("tar pit - the mire drags at every stride", () => {
  const { world } = fixture();
  const mired = creature("wolf", 32, 30, 200);
  const free = creature("wolf", 32, 40, 200);
  world.fauna.push(mired, free);
  placeZone(world, "tarpit", 32, 30, null);
  assert.ok(Math.hypot(32 - 32, 30 - 30) <= TAR_PIT_RADIUS, "fixture sanity");
  mired.path = [{ tx: 38, ty: 30 }];
  mired.task = "wander";
  free.path = [{ tx: 38, ty: 40 }];
  free.task = "wander";
  for (let i = 0; i < 10; i++) tickEcology(world, 0.1);
  const miredGain = mired.x - 32;
  const freeGain = free.x - 32;
  assert.ok(freeGain > 0.5, `the free beast strides (${freeGain.toFixed(2)})`);
  assert.ok(miredGain < freeGain / 2.5, `the mire drags (${miredGain.toFixed(2)} vs ${freeGain.toFixed(2)})`);
});

test("wall of stone - the way closes, then opens again when the working lapses", () => {
  const { world } = fixture();
  assert.ok(walkable(world, 32, 30), "open ground before the working");
  assert.equal(commandCast(world, "stonewall", { kind: "tile", tx: 32, ty: 30 }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Rel Tym Hur/);
  assert.ok(!walkable(world, 32, 30), "the stone bars the tile");
  assert.ok(zoneBlocksAt(world, 32, 30), "the zone bars the tile");
  const path = astar(world, 29, 30, 36, 30, 2000);
  assert.ok(path, "a way around exists");
  for (const node of path!) {
    assert.ok(Math.hypot(node.x - 32, node.y - 30) > STONE_WALL_RADIUS, `the path skirts the stone (${node.x},${node.y})`);
  }
  const zone = world.zones.find((z) => z.kind === "stonewall")!;
  world.hour = zone.until + 0.1;
  tickZones(world, 0.016);
  assert.ok(walkable(world, 32, 30), "the way opens when the working lapses");
});

test("sanctuary - ground no beast will cross, and no bite lands inside", () => {
  const { world, player } = fixture();
  const wolf = creature("wolf", 33, 30, 200);
  world.fauna.push(wolf);
  assert.equal(commandCast(world, "sanctuary", { kind: "tile", tx: 30, ty: 30 }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /In Sanct Hur/);
  assert.ok(sanctuaryAt(world, player.x, player.z), "the seal holds the ground you stand on");
  player.hp = player.maxHp;
  strikePlayer(world, wolf, player);
  assert.equal(player.hp, player.maxHp, "no bite lands on hallowed ground");
  // A hunting beast refuses the crossing: it lets the fight go at the seal.
  wolf.task = "fight";
  wolf.taskUntil = world.hour + 1;
  wolf.path = [{ tx: 30, ty: 30 }];
  for (let i = 0; i < 6; i++) tickEcology(world, 0.1);
  assert.notEqual(wolf.task as string, "fight", "the beast lets the fight go at the seal");
  assert.ok(Math.hypot(wolf.x - 30, wolf.z - 30) >= SANCTUARY_RADIUS - 0.5, "it keeps out of the seal");
});

test("earthquake - three pulses shake the ring, each weaker, and knock beasts off their stride", () => {
  const { world } = fixture();
  const near = creature("wolf", 32, 30, 400);
  near.task = "fight";
  near.taskUntil = world.hour + 1;
  const edge = creature("wolf", 30 + EARTHQUAKE_RADIUS, 30, 400);
  const outside = creature("wolf", 30 + EARTHQUAKE_RADIUS + 3, 30, 400);
  world.fauna.push(near, edge, outside);
  assert.equal(commandCast(world, "earthquake", { kind: "tile", tx: 31, ty: 30 }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Vas Tym Por/);
  const drops: number[] = [];
  for (let pulse = 0; pulse < 3; pulse++) {
    const before = near.hp;
    world.hour += 0.06;
    tickZones(world, 0.016);
    drops.push(before - near.hp);
  }
  assert.ok(drops[0]! > 0, "the first shake bites");
  assert.ok(drops[0]! >= drops[1]! && drops[1]! >= drops[2]!, `each shake weaker (${drops.join(" > ")})`);
  assert.notEqual(near.task as string, "fight", "knocked off its stride");
  assert.ok(edge.hp < 400, "the edge of the ring shakes too");
  assert.equal(outside.hp, 400, "beyond the ring stands untouched");
});

test("nature's fury - the unbound swarm harries the ring but not you", () => {
  const { world, player } = fixture();
  const near = creature("wolf", 32, 30, 200);
  world.fauna.push(near);
  assert.equal(commandCast(world, "naturesfury", { kind: "tile", tx: 32, ty: 30 }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Vas Xen Grav/);
  assert.ok(Math.hypot(32 - 32, 30 - 30) <= NATURES_FURY_RADIUS, "fixture sanity");
  const hpBefore = near.hp;
  const playerHp = player.hp;
  world.hour += 0.09;
  tickZones(world, 0.016);
  assert.ok(near.hp < hpBefore, "the swarm harries");
  assert.equal(player.hp, playerHp, "the swarm leaves you be");
});

test("the vale holds a bounded number of workings", () => {
  const { world } = fixture();
  for (let i = 0; i < ZONE_CAP + 3; i++) {
    placeZone(world, "tarpit", 20 + i, 20, null);
  }
  assert.ok(world.zones.length <= ZONE_CAP, `the workings stay bounded (${world.zones.length})`);
});

test("a fizzled zone spell burns the reagents but raises no working", () => {
  const { world } = fixture();
  assert.equal(commandCast(world, "stonewall", { kind: "tile", tx: 32, ty: 30 }), null);
  const note = withRandom(0.999, () => tickUntilNote(world));
  assert.match(note, /fizzles/i);
  assert.equal(world.player.pack.ash, 7, "reagents burn on a fizzle");
  assert.equal(world.zones.length, 0, "no working stands");
});

test("workings survive a save round-trip", () => {
  const { world } = fixture();
  placeZone(world, "sanctuary", 31, 29, world.player.id);
  placeZone(world, "stonewall", 34, 30, world.player.id);
  const clone = JSON.parse(JSON.stringify(world)) as World;
  assert.equal(clone.zones.length, 2, "the workings ride the save");
  assert.equal(clone.zones[1]!.kind, "stonewall");
  assert.ok(clone.zones[1]!.until > 0);
});
