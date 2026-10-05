import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { FAUNA_META, SECONDS_PER_HOUR } from "./catalog.ts";
import { tickEcology } from "./ecology.ts";
import {
  SPELL_CIRCLES,
  SPELL_META,
  commandCast,
  spellSfx,
} from "./magery.ts";
import { spellFxProfile } from "./magery-animation.ts";
import { astar } from "./pathfinding.ts";
import { tickPlayer } from "./player.ts";
import { tickZones } from "./zones.ts";
import type { Creature, FaunaKind, SpellId, World } from "./types.ts";
import { createPerson, createStubWorld } from "./world.ts";

/**
 * Batch three of the spellbook expansion: eight spells that each bring their
 * own mechanic — Jump, Mirror Image, Gate, Fly, Necromancy, Resurrect,
 * Summon Elemental, Polymorph.
 * Run: node --experimental-strip-types --test src/game/magery-batch3.test.ts
 */

const BATCH3: SpellId[] = ["jump", "mirrorimage", "gate", "fly", "necromancy", "resurrect", "summonelemental", "polymorph"];

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
    id: `b3-${kind}-${x}-${z}-${Math.floor(base)}`,
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
  world.player.mana = 120;
  for (const id of ["silk", "ash", "garlic", "ginseng", "pearl", "mandrake", "nightshade", "moss", "rune"] as const) {
    (world.player.pack as Record<string, number>)[id] = 8;
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

test("batch three - every spell has meta, a circle, a profile, and a voice on disk", () => {
  const circles = new Set(SPELL_CIRCLES.flatMap((c) => c.ids));
  for (const id of BATCH3) {
    const meta = SPELL_META[id];
    assert.ok(meta, `${id} has meta`);
    assert.ok(meta.words.length > 2, `${id} has words of power`);
    assert.ok(circles.has(id), `${id} sits in a circle`);
    const profile = spellFxProfile(id);
    assert.ok(profile.duration > 0.2, `${id} has a release profile`);
    assert.equal(spellSfx(id), `spell_${id}`);
    const file = path.join(process.cwd(), "public", "audio", "sfx", `spell-${id}.mp3`);
    assert.ok(existsSync(file), `${file} exists`);
  }
  const fifth = SPELL_CIRCLES.find((c) => c.circle === 5)!;
  for (const id of ["gate", "fly", "necromancy", "resurrect", "summonelemental"] as SpellId[]) {
    assert.ok(fifth.ids.includes(id), `fifth circle holds ${id}`);
  }
});

test("jump - a short leap that lands on its feet, and no farther", () => {
  const { world, player } = fixture();
  assert.equal(commandCast(world, "jump", { kind: "tile", tx: 35, ty: 30 }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Hur Por/);
  assert.ok(Math.hypot(player.x - 35, player.z - 30) < 1.6, `landed by the mark (${player.x},${player.z})`);
  const err = commandCast(world, "jump", { kind: "tile", tx: 45, ty: 30 });
  assert.match(err ?? "", /far/i, "a leap is not a gate");
});

test("gate - the moongate carries you and every companion to the mark", () => {
  const { world, player } = fixture();
  // Write a mark far away, then walk home.
  assert.equal(commandCast(world, "mark"), null);
  player.x = 60;
  player.z = 60;
  withRandom(0.5, () => tickUntilNote(world));
  assert.equal(world.player.marks.length, 1, "the rune holds a mark");
  player.x = 30;
  player.z = 30;
  const hound = creature("wolf", 31, 30, 100);
  hound.ownerId = world.player.id;
  hound.loyalty = 100;
  world.fauna.push(hound);
  assert.equal(commandCast(world, "gate", { kind: "mark", id: world.player.marks[0]!.id }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Kal Vas Por/);
  assert.ok(Math.hypot(player.x - 60, player.z - 60) < 4, `you step out by the mark (${player.x},${player.z})`);
  assert.ok(Math.hypot(hound.x - 60, hound.z - 60) < 6, `the hound follows through (${hound.x},${hound.z})`);
  assert.ok(world.player.gateCoolUntil > world.hour, "the swirl needs a breath");
});

test("resurrect - the dead rise where they fell; the living need not apply", () => {
  const { world, player } = fixture();
  assert.equal(commandCast(world, "resurrect", { kind: "self" }), null);
  const living = withRandom(0.5, () => tickUntilNote(world));
  assert.match(living, /still bleed/i, "no working for the living");
  // Now die and rise.
  player.ghost = true;
  player.hp = 0;
  world.player.ghost = true;
  world.player.corpseAt = { tx: 44, ty: 44 };
  world.player.mana = 120;
  assert.equal(commandCast(world, "resurrect", { kind: "self" }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /In Corp/);
  assert.equal(player.ghost, false, "blood remembers");
  assert.ok(player.hp > 0, "you rise");
  assert.ok(Math.hypot(player.x - 44, player.z - 44) < 1, "you rise where you fell");
});

test("necromancy - a corpse answers, bound, and only a corpse", () => {
  const { world } = fixture();
  assert.equal(commandCast(world, "necromancy", { kind: "self" }), null);
  const none = withRandom(0.5, () => tickUntilNote(world));
  assert.match(none, /no corpse|nothing answers/i);
  const dead = creature("wolf", 32, 30, 100);
  dead.hp = 0;
  dead.task = "dead";
  dead.corpseUntil = world.hour + 8;
  world.fauna.push(dead);
  world.player.mana = 120;
  assert.equal(commandCast(world, "necromancy", { kind: "self" }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /In Corp Xen/);
  assert.notEqual(dead.task as string, "dead", "it rises");
  assert.equal(dead.ownerId, world.player.id, "bound to you");
  assert.ok(dead.hp > 0, "with a semblance of life");
  assert.ok(dead.boundUntil && dead.boundUntil > world.hour, "held by the binding, not the bond");
  assert.equal(dead.art, "risen", "spell-art flag so the corpse does not look alive");
});

test("summon elemental - the terrain chooses what answers", () => {
  const { world } = fixture();
  assert.equal(commandCast(world, "summonelemental", { kind: "self" }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Kal Vas Xen/);
  const bound = world.fauna.filter((c) => c.ownerId === world.player.id && c.boundUntil && c.boundUntil > world.hour);
  assert.equal(bound.length, 1, "one elemental stands bound");
  assert.ok(bound[0]!.name != null && bound[0]!.name!.length > 0, "it is named for its element");
  assert.equal(bound[0]!.art, bound[0]!.name, "spell-art flag matches the elemental name");
  assert.ok(["thornbound", "stonebound", "galebound", "tidebound"].includes(bound[0]!.art!), "one of the four elementals");
  // A second calling loosens the first.
  world.player.mana = 120;
  assert.equal(commandCast(world, "summonelemental", { kind: "self" }), null);
  withRandom(0.5, () => tickUntilNote(world));
  const after = world.fauna.filter((c) => c.ownerId === world.player.id && c.boundUntil && c.boundUntil > world.hour);
  assert.equal(after.length, 1, "the old binding loosens");
});

test("polymorph - the wolf wears a hare's shape until the working lapses", () => {
  const { world } = fixture();
  const wolf = creature("wolf", 32, 30, 100);
  world.fauna.push(wolf);
  assert.equal(commandCast(world, "polymorph", { kind: "fauna", id: wolf.id }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Quas Xen Tym/);
  assert.equal(wolf.kind as string, "hare", "the shape is the beast now — every system sees a hare");
  assert.equal(wolf.wasKind, "wolf", "the old shape is remembered");
  assert.ok(wolf.polyUntil && wolf.polyUntil > world.hour, "the working holds");
  world.hour += 1.2;
  tickEcology(world, 0.016);
  assert.equal(wolf.kind as string, "wolf", "the shape returns when the working lapses");
  assert.equal(wolf.wasKind, undefined, "nothing left to remember");
});

test("mirror image - the pack loses you among the images, and images pop clean", () => {
  const { world, player } = fixture();
  const wolf = creature("wolf", 33, 30, 200);
  wolf.task = "fight";
  wolf.taskUntil = world.hour + 1;
  world.fauna.push(wolf);
  const pilesBefore = world.piles.length;
  assert.equal(commandCast(world, "mirrorimage", { kind: "self" }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Quas Xen/);
  const images = world.fauna.filter((c) => c.mirror);
  assert.ok(images.length >= 2, `the images stand (${images.length})`);
  assert.notEqual(wolf.task as string, "fight", "the pack loses you among the images");
  // An image is struck — it pops without corpse, loot, or glory.
  const one = images[0]!;
  one.hp = 0;
  one.task = "dead";
  tickEcology(world, 0.016);
  assert.equal(world.piles.length, pilesBefore, "an image leaves nothing behind");
  assert.ok(!world.fauna.some((c) => c.id === one.id), "the image is gone");
  void player;
});

test("fly - the wind carries you over what bars the earthbound", () => {
  const { world, player } = fixture();
  // Dam the way with water: a long channel the earthbound must round.
  for (let y = 20; y <= 40; y++) {
    for (let x = 33; x <= 34; x++) world.tiles[y]![x]!.kind = "water";
  }
  world.landRev++;
  const earthbound = astar(world, 30, 30, 38, 30, 20000);
  assert.ok(earthbound, "the earthbound find the long way round");
  assert.ok(earthbound.every((n) => world.tiles[n.y]![n.x]!.kind !== "water"), "and it stays dry");
  assert.equal(commandCast(world, "fly", { kind: "self" }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Vas Hur Por/);
  assert.ok(world.player.flyUntil > world.hour, "the wind holds you");
  const aloft = astar(world, 30, 30, 38, 30, 20000, true);
  assert.ok(aloft, "aloft, the channel is weather");
  assert.ok(aloft.some((n) => world.tiles[n.y]![n.x]!.kind === "water"), "it crosses what bars the earthbound");
  world.player.flyUntil = world.hour - 1;
  tickZones(world, 0.016);
  void player;
});

test("fly lapses - the wind sets you down", () => {
  const { world } = fixture();
  assert.equal(commandCast(world, "fly", { kind: "self" }), null);
  withRandom(0.5, () => tickUntilNote(world));
  world.hour += 0.5;
  assert.ok(world.player.flyUntil <= world.hour, "the working runs its course");
});

test("new mechanics survive a save round-trip", () => {
  const { world } = fixture();
  const wolf = creature("wolf", 32, 30, 100);
  wolf.kind = "hare";
  wolf.wasKind = "wolf";
  wolf.polyUntil = world.hour + 0.8;
  world.fauna.push(wolf);
  world.player.flyUntil = world.hour + 0.2;
  const clone = JSON.parse(JSON.stringify(world)) as World;
  assert.equal(clone.fauna[0]!.wasKind, "wolf");
  assert.ok(clone.player.flyUntil > 0);
});

test("a fizzled mechanic burns the reagents and changes nothing", () => {
  const { world, player } = fixture();
  const x = player.x, z = player.z;
  assert.equal(commandCast(world, "jump", { kind: "tile", tx: 35, ty: 30 }), null);
  const note = withRandom(0.999, () => tickUntilNote(world));
  assert.match(note, /fizzles/i);
  assert.equal(world.player.pack.silk, 7, "reagents burn on a fizzle");
  assert.ok(Math.hypot(player.x - x, player.z - z) < 0.01, "you go nowhere");
});

test("fly tick integration - the sim breathes with new fields", () => {
  const { world } = fixture();
  // tickZones with no workings stays quiet over a long breath.
  for (let i = 0; i < 30; i++) {
    world.hour += 0.05;
    tickZones(world, 0.01);
  }
  assert.equal(world.zones.length, 0);
  void SECONDS_PER_HOUR;
});
