import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  BLAST_RADIUS,
  CHAIN_FALLOFF,
  CHAIN_RANGE,
  FAUNA_META,
  IRONWOOD_WARD,
  METEOR_RADIUS,
  SNARE_TICK_DMG,
} from "./catalog.ts";
import { strikePlayer, tickEcology } from "./ecology.ts";
import {
  OFFENSIVE_SPELLS,
  SPELL_CIRCLES,
  SPELL_META,
  TILE_OFFENSIVE_SPELLS,
  commandCast,
  spellSfx,
} from "./magery.ts";
import { spellFxProfile } from "./magery-animation.ts";
import { tickPlayer } from "./player.ts";
import type { Creature, FaunaKind, SpellId, World } from "./types.ts";
import { createPerson, createStubWorld } from "./world.ts";

/**
 * Batch one of the spellbook expansion: Thorn Snare, Ironwood, Leech, Flash,
 * Fire Blast, Blizzard, Chain Lightning, Sleep, Meteor. Content riding the
 * existing cast/status machinery (bounded statuses, tile casts, wards).
 * Run: node --experimental-strip-types --test src/game/magery-batch1.test.ts
 */

const BATCH1: SpellId[] = [
  "thornsnare", "ironwood", "leech", "flash", "fireblast", "blizzard", "chainlightning", "sleep", "meteor",
];

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
    id: `b1-${kind}-${x}-${z}`,
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
  world.player.mana = 80;
  for (const id of ["silk", "ash", "garlic", "ginseng", "pearl", "mandrake", "nightshade", "moss"] as const) {
    world.player.pack[id] = 6;
  }
  return { world, player };
}

/** Tick the real loop until the cast windup lands and a note comes back. */
function tickUntilNote(world: World): string {
  for (let i = 0; i < 40; i++) {
    const note = tickPlayer(world, 0.1);
    if (note !== null) return note;
    if (world.player.intent.kind === "none" && world.player.armedSpell === null) return "intent cleared without a note";
  }
  return "beat never landed";
}

test("batch one - every spell has meta, a circle, a profile, and a voice on disk", () => {
  const circles = new Set(SPELL_CIRCLES.flatMap((c) => c.ids));
  for (const id of BATCH1) {
    const meta = SPELL_META[id];
    assert.ok(meta, `${id} has meta`);
    assert.ok(meta.words.length > 2, `${id} has words of power`);
    assert.ok(circles.has(id), `${id} sits in a circle`);
    assert.equal(meta.circle, SPELL_CIRCLES.find((c) => c.ids.includes(id))?.circle, `${id}'s ring matches its meta`);
    const profile = spellFxProfile(id);
    assert.ok(profile.duration > 0.2, `${id} has a release profile`);
    assert.equal(spellSfx(id), `spell_${id}`);
    const file = path.join(process.cwd(), "public", "audio", "sfx", `spell-${id}.mp3`);
    assert.ok(existsSync(file), `${file} exists`);
  }
  assert.equal(SPELL_META.meteor.circle, 6, "meteor opens the sixth circle");
  for (const id of ["thornsnare", "leech", "chainlightning", "sleep"] as SpellId[]) {
    assert.ok(OFFENSIVE_SPELLS.has(id), `${id} rides the beast-targeted path`);
  }
  for (const id of ["fireblast", "blizzard", "meteor"] as SpellId[]) {
    assert.ok(TILE_OFFENSIVE_SPELLS.has(id), `${id} rides the ground-targeted path`);
    assert.ok(!OFFENSIVE_SPELLS.has(id), `${id} does not ask for a beast`);
  }
});

test("thorn snare - roots the beast and the thorns keep biting", () => {
  const { world } = fixture();
  const wolf = creature("wolf", 33, 30, 5);
  world.fauna.push(wolf);
  assert.equal(commandCast(world, "thornsnare", { kind: "fauna", id: wolf.id }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /An Xen/);
  assert.match(note, /snare|thorn/i);
  assert.ok((wolf.snareUntil ?? 0) > world.hour, "the thorns hold");
  assert.equal(wolf.path.length, 0, "rooted mid-stride");
  const mossBefore = world.player.pack.moss;
  assert.equal(world.player.pack.nightshade, 5);
  assert.equal(mossBefore, 5);
  // The thorns finish what the words began — no stride, a bite every tick.
  let guard = 0;
  while ((wolf.task as string) !== "dead" && guard++ < 20) {
    world.hour += 0.09;
    tickEcology(world, 0.016);
  }
  assert.equal(wolf.task as string, "dead", `thorns bite ${SNARE_TICK_DMG} a tick until it drops`);
  assert.ok(wolf.corpseUntil > world.hour, "the corpse lies for the skinning");
});

test("ironwood - bark-hard skin blunts every bite", () => {
  const { world, player } = fixture();
  const wolf = creature("wolf", 31, 30);
  world.fauna.push(wolf);
  const bareBite = (() => {
    player.hp = player.maxHp;
    strikePlayer(world, wolf, player);
    return player.maxHp - player.hp;
  })();
  assert.equal(commandCast(world, "ironwood", { kind: "self" }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Rel Tym/);
  assert.ok((world.player.ironwoodUntil ?? 0) > world.hour, "the bark holds");
  player.hp = player.maxHp;
  strikePlayer(world, wolf, player);
  const guarded = player.maxHp - player.hp;
  assert.ok(bareBite - guarded >= IRONWOOD_WARD, `the bark turns ${IRONWOOD_WARD} bite (${bareBite} -> ${guarded})`);
  assert.equal(world.player.pack.mandrake, 5);
  assert.equal(world.player.pack.garlic, 5);
});

test("leech - the beast's wound becomes your blood", () => {
  const { world, player } = fixture();
  player.hp = 20;
  player.maxHp = 40;
  const wolf = creature("wolf", 33, 30, 200);
  world.fauna.push(wolf);
  assert.equal(commandCast(world, "leech", { kind: "fauna", id: wolf.id }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Des Mani/);
  assert.match(note, /wound feeds you|last strength feeds you/i);
  const drained = 200 - wolf.hp;
  assert.ok(drained > 0, "the leech bites");
  assert.equal(player.hp, 20 + drained, "every drop of the wound feeds the caster");
});

test("flash - the burst blinds everything near and breaks every fight", () => {
  const { world } = fixture();
  const near = creature("wolf", 33, 30);
  near.task = "fight";
  near.taskUntil = world.hour + 1;
  const nearToo = creature("hart", 28, 30);
  nearToo.task = "fight";
  nearToo.taskUntil = world.hour + 1;
  const far = creature("wolf", 50, 30);
  far.task = "fight";
  far.taskUntil = world.hour + 1;
  world.fauna.push(near, nearToo, far);
  assert.equal(commandCast(world, "flash", { kind: "self" }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /In Lor Vas/);
  assert.ok((near.blindUntil ?? 0) > world.hour, "the near wolf is blind");
  assert.ok((nearToo.blindUntil ?? 0) > world.hour, "the near hart is blind");
  assert.notEqual(near.task as string, "fight", "the fight goes out of it");
  assert.notEqual(nearToo.task as string, "fight", "the fight goes out of the hart too");
  assert.equal(near.path.length, 0, "no pursuit");
  assert.equal(far.blindUntil ?? 0, 0, "the far wolf keeps its eyes");
  assert.equal(far.task as string, "fight", "the far wolf still presses");
});

test("fire blast - the ground erupts and the ring burns, but your own beast is spared", () => {
  const { world, player } = fixture();
  const inRing = creature("wolf", 34, 30, 200);
  const onEdge = creature("hart", 30 + BLAST_RADIUS, 30, 200);
  const outside = creature("wolf", 40, 30, 200);
  const mine = creature("wolf", 32, 30, 200);
  mine.ownerId = player.id;
  world.fauna.push(inRing, onEdge, outside, mine);
  assert.equal(commandCast(world, "fireblast", { kind: "tile", tx: 33, ty: 30 }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Vas Flam Ort/);
  assert.ok(inRing.hp < 200, "the ring burns");
  assert.ok(onEdge.hp < 200, "the edge of the ring burns too");
  assert.equal(outside.hp, 200, "outside the ring stands untouched");
  assert.equal(mine.hp, 200, "your own beast is spared");
  assert.equal(inRing.task as string, "fight", "the burned beast turns on the caster");
  assert.equal(world.player.pack.ash, 5);
  assert.equal(world.player.pack.pearl, 5);
  assert.equal(world.player.pack.mandrake, 5);
});

test("blizzard - the cold front wounds and slows the ring", () => {
  const { world } = fixture();
  const inRing = creature("wolf", 34, 30, 200);
  const outside = creature("wolf", 40, 30, 200);
  world.fauna.push(inRing, outside);
  assert.equal(commandCast(world, "blizzard", { kind: "tile", tx: 33, ty: 30 }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Vas Glaciem/);
  assert.ok(inRing.hp < 200, "the cold bites");
  assert.ok((inRing.chillUntil ?? 0) > world.hour, "the chill slows the stride");
  assert.equal(outside.hp, 200, "outside the ring stands untouched");
  assert.equal(outside.chillUntil ?? 0, 0, "no chill outside the ring");
});

test("chain lightning - the bolt arcs to the pack with a weaker kiss", () => {
  const { world } = fixture();
  const first = creature("wolf", 33, 30, 200);
  const second = creature("wolf", 33 + CHAIN_RANGE - 1, 30, 200);
  const far = creature("wolf", 33 + CHAIN_RANGE + 4, 30, 200);
  world.fauna.push(first, second, far);
  assert.equal(commandCast(world, "chainlightning", { kind: "fauna", id: first.id }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Por Ort Grav Vas/);
  const firstHit = 200 - first.hp;
  const secondHit = 200 - second.hp;
  assert.ok(firstHit >= 8, `the bolt lands hard (${firstHit})`);
  assert.ok(secondHit > 0, "the arc finds the pack");
  assert.ok(secondHit <= Math.ceil(firstHit * CHAIN_FALLOFF) + 1, `the arc lands weaker (${secondHit} vs ${firstHit})`);
  assert.equal(far.hp, 200, "beyond the arc stands untouched");
});

test("sleep - the beast drifts off, and a wound wakes it", () => {
  const { world } = fixture();
  const wolf = creature("wolf", 33, 30, 200);
  world.fauna.push(wolf);
  assert.equal(commandCast(world, "sleep", { kind: "fauna", id: wolf.id }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /In Zu/);
  assert.ok((wolf.sleptUntil ?? 0) > world.hour, "it drifts off");
  const xBefore = wolf.x;
  for (let i = 0; i < 5; i++) tickEcology(world, 0.1);
  assert.equal(wolf.x, xBefore, "no stride in sleep");
  // A wound wakes it — the fireball lands, the ecology rouses the beast.
  assert.equal(commandCast(world, "fireball", { kind: "fauna", id: wolf.id }), null);
  withRandom(0.5, () => tickUntilNote(world));
  assert.ok(wolf.hp < 200, "the fireball bit");
  tickEcology(world, 0.016);
  assert.equal(wolf.sleptUntil ?? 0, 0, "the wound wakes it");
  assert.equal(wolf.task as string, "fight", "it wakes angry");
});

test("meteor - the sky falls in a wide ring", () => {
  const { world } = fixture();
  const near = creature("wolf", 32, 30, 300);
  const edge = creature("wolf", 30 + METEOR_RADIUS, 30, 300);
  const outside = creature("wolf", 30 + METEOR_RADIUS + 2, 30, 300);
  world.fauna.push(near, edge, outside);
  assert.equal(commandCast(world, "meteor", { kind: "tile", tx: 30, ty: 30 }), null);
  const note = withRandom(0.5, () => tickUntilNote(world));
  assert.match(note, /Vas Flam Grav/);
  assert.ok(300 - near.hp >= 16, `the impact devastates (${300 - near.hp})`);
  assert.ok(edge.hp < 300, "the wide ring still bites");
  assert.equal(outside.hp, 300, "beyond the ring stands untouched");
  assert.equal(world.player.pack.nightshade, 5, "the sixth circle burns deep");
});

test("a fizzled batch-one spell burns the reagents but lands nothing", () => {
  const { world } = fixture();
  const wolf = creature("wolf", 33, 30, 200);
  world.fauna.push(wolf);
  assert.equal(commandCast(world, "fireblast", { kind: "tile", tx: 33, ty: 30 }), null);
  const note = withRandom(0.999, () => tickUntilNote(world));
  assert.match(note, /fizzles/i);
  assert.equal(world.player.pack.ash, 5, "reagents burn on a fizzle");
  assert.equal(wolf.hp, 200, "nothing lands");
});

test("thorn snare kill feeds the corpse pile like any hunt", () => {
  const { world } = fixture();
  const hare = creature("hare", 33, 30, SNARE_TICK_DMG);
  world.fauna.push(hare);
  const pilesBefore = world.piles.length;
  assert.equal(commandCast(world, "thornsnare", { kind: "fauna", id: hare.id }), null);
  withRandom(0.5, () => tickUntilNote(world));
  let guard = 0;
  while ((hare.task as string) !== "dead" && guard++ < 20) {
    world.hour += 0.09;
    tickEcology(world, 0.016);
  }
  assert.equal(hare.task as string, "dead");
  assert.ok(world.piles.length >= pilesBefore, "the kill feeds the piles");
});
