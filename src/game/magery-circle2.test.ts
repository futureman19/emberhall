import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { BLESS_HOURS, POISON_FAUNA_HOURS, POISON_TICK_HOURS } from "./catalog.ts";
import { tickEcology } from "./ecology.ts";
import { setWorld } from "./live.ts";
import {
  OFFENSIVE_SPELLS,
  SPELL_CIRCLES,
  SPELL_META,
  SPELL_ORDER,
  commandCast,
  spellSfx,
} from "./magery.ts";
import { spellFxProfile } from "./magery-animation.ts";
import { commandHunt, tickPlayer, you } from "./player.ts";
import type { SpellId, World } from "./types.ts";
import { createWorld } from "./world.ts";

/** Tick the real loop until the cast windup lands and a note comes back. */
function tickUntilNote(world: World): string {
  for (let i = 0; i < 40; i++) {
    const note = tickPlayer(world, 0.1);
    if (note !== null) return note;
    if (world.player.intent.kind === "none" && world.player.armedSpell === null) return "intent cleared without a note";
  }
  return "beat never landed";
}

function mageReady(world: World) {
  world.player.pack.spellbook = 1;
  world.player.skills.magery = 50;
  world.player.mana = 60;
}

test("circle two - every spell has meta, a circle, a profile, and a voice on disk", () => {
  const circles = new Set(SPELL_CIRCLES.flatMap((c) => c.ids));
  for (const id of SPELL_ORDER) {
    const meta = SPELL_META[id];
    assert.ok(meta.words.length > 2, `${id} has words of power`);
    assert.ok(circles.has(id) || id === "mark" || id === "recall", `${id} sits in a circle`);
    const profile = spellFxProfile(id);
    assert.ok(profile.duration > 0.2, `${id} has a release profile`);
    assert.equal(spellSfx(id), `spell_${id}`);
    const file = path.join(process.cwd(), "public", "audio", "sfx", `spell-${id.replace("magicarrow", "magicarrow")}.mp3`);
    assert.ok(existsSync(file), `${file} exists`);
  }
  assert.equal(SPELL_META.poison.reagents[0], "nightshade", "nightshade finally has a purpose");
  assert.equal(spellFxProfile("lightning").kind, "strike");
  for (const id of ["poison", "lightning"] as SpellId[]) {
    assert.ok(OFFENSIVE_SPELLS.has(id), `${id} rides the offensive path`);
  }
});

test("cure - refuses a clean body, draws venom from a poisoned one", () => {
  const world = createWorld();
  setWorld(world);
  mageReady(world);
  world.player.pack.garlic = 4;
  world.player.pack.ginseng = 4;
  assert.match(String(commandCast(world, "cure", { kind: "self" })), /no venom/);
  world.player.poisonUntil = world.hour + 1;
  world.player.poisonTickAt = world.hour + POISON_TICK_HOURS;
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    assert.equal(commandCast(world, "cure", { kind: "self" }), null);
    const note = tickUntilNote(world);
    assert.match(note, /An Nox/);
    assert.match(note, /venom leaves/i);
  } finally {
    Math.random = random;
  }
  assert.equal(world.player.poisonUntil, 0);
  assert.equal(world.player.pack.garlic, 3);
  assert.equal(world.player.pack.ginseng, 3);
});

test("poison - the bolt sickens and the venom finishes a hare", () => {
  const world = createWorld();
  setWorld(world);
  mageReady(world);
  world.player.skills.magery = 14; // a lighter hand — the bolt wounds, the venom kills
  world.player.pack.nightshade = 2;
  const player = you(world)!;
  const hare = world.fauna.find((c) => c.kind === "hare")!;
  hare.task = "idle";
  hare.taskUntil = world.hour + 99;
  hare.path = [];
  player.x = hare.x - 2;
  player.z = hare.z;
  player.path = [];
  const hpBefore = hare.hp;
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    assert.equal(commandCast(world, "poison", { kind: "fauna", id: hare.id }), null);
    const note = tickUntilNote(world);
    assert.match(note, /In Nox/);
    assert.match(note, /sickens/i);
  } finally {
    Math.random = random;
  }
  assert.equal(world.player.pack.nightshade, 1, "one nightshade burned");
  assert.ok(hare.hp < hpBefore, "the bolt bites on impact");
  assert.ok((hare.poisonUntil ?? 0) > world.hour, "venom is in the beast");
  assert.ok(Math.abs((hare.poisonUntil ?? 0) - (world.hour + POISON_FAUNA_HOURS)) < 0.2, "venom holds its full course");
  // Venom ticks: ride the ecology until the hare drops.
  let guard = 0;
  while ((hare.task as string) !== "dead" && guard++ < 40) {
    world.hour += POISON_TICK_HOURS;
    tickEcology(world, 0.016);
  }
  assert.equal(hare.task as string, "dead", "the venom finished what the bolt began");
  assert.ok(hare.hp <= 0);
  assert.ok(hare.corpseUntil > world.hour, "the corpse lies for the skinning");
});

test("lightning - the sky answers at once, no venom, bigger bite than an arrow", () => {
  const world = createWorld();
  setWorld(world);
  mageReady(world);
  world.player.pack.ash = 3;
  world.player.pack.pearl = 3;
  const player = you(world)!;
  const hart = world.fauna.find((c) => c.kind === "hart" && c.task !== "dead")!;
  hart.task = "idle";
  hart.taskUntil = world.hour + 99;
  hart.path = [];
  player.x = hart.x - 3;
  player.z = hart.z;
  player.path = [];
  const hpBefore = hart.hp;
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    assert.equal(commandCast(world, "lightning", { kind: "fauna", id: hart.id }), null);
    const note = tickUntilNote(world);
    assert.match(note, /Por Ort Grav/);
    assert.match(note, /blasted|falls/i);
  } finally {
    Math.random = random;
  }
  assert.ok(hpBefore - hart.hp >= 8, `the bolt lands hard (${hpBefore - hart.hp} dmg)`);
  assert.equal(hart.poisonUntil ?? 0, 0, "no venom rides the sky");
  assert.equal(world.player.pack.ash, 2);
  assert.equal(world.player.pack.pearl, 2);
});

test("bless - the boon holds, and the blade swings harder under it", () => {
  const world = createWorld();
  setWorld(world);
  mageReady(world);
  world.player.pack.garlic = 4;
  world.player.pack.mandrake = 4;
  world.player.skills.swords = 60;
  const random = Math.random;
  Math.random = () => 0.5;
  let unblessed = 0;
  let blessed = 0;
  try {
    const swing = () => {
      const player = you(world)!;
      const hare = world.fauna.find((c) => c.kind === "hare" && c.task !== "dead")!;
      hare.task = "idle";
      hare.taskUntil = world.hour + 99;
      hare.path = [];
      hare.hp = 40; // deep-blooded fixture — the delta must show raw damage, not the kill cap
      hare.maxHp = 40;
      player.x = hare.x - 1;
      player.z = hare.z;
      player.path = [];
      player.ghost = false;
      world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
      const hp = hare.hp;
      assert.equal(commandHunt(world, hare.id), null);
      tickUntilNote(world);
      return hp - hare.hp;
    };
    unblessed = swing();
    assert.equal(commandCast(world, "bless", { kind: "self" }), null);
    const note = tickUntilNote(world);
    assert.match(note, /Rel Sanct/);
    assert.ok(Math.abs(world.player.blessUntil - (world.hour + BLESS_HOURS)) < 0.2, "the boon holds an hour");
    blessed = swing();
  } finally {
    Math.random = random;
  }
  assert.ok(unblessed >= 4, `the plain swing lands (${unblessed})`);
  assert.ok(blessed > unblessed, `blessed blade bites deeper (${blessed} > ${unblessed})`);
  assert.equal(world.player.pack.garlic, 3);
  assert.equal(world.player.pack.mandrake, 3);
});

test("a fizzled circle-two spell burns the reagents but not the venom", () => {
  const world = createWorld();
  setWorld(world);
  mageReady(world);
  world.player.pack.nightshade = 1;
  const player = you(world)!;
  const hare = world.fauna.find((c) => c.kind === "hare")!;
  hare.task = "idle";
  hare.taskUntil = world.hour + 99;
  hare.path = [];
  player.x = hare.x - 2;
  player.z = hare.z;
  player.path = [];
  const random = Math.random;
  Math.random = () => 0.999; // the words stumble
  try {
    assert.equal(commandCast(world, "poison", { kind: "fauna", id: hare.id }), null);
    const note = tickUntilNote(world);
    assert.match(note, /fizzles/i);
  } finally {
    Math.random = random;
  }
  assert.equal(world.player.pack.nightshade, 0, "reagents burn on a fizzle");
  assert.equal(hare.poisonUntil ?? 0, 0, "no venom lands");
  assert.ok(hare.hp > 0);
});
