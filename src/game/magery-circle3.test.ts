import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { INVIS_HOURS, PARALYZE_HOURS, SUMMON_HOURS, FAUNA_META } from "./catalog.ts";
import { spawn, tickEcology } from "./ecology.ts";
import { setWorld } from "./live.ts";
import {
  OFFENSIVE_SPELLS,
  SPELL_CIRCLES,
  SPELL_META,
  commandCast,
} from "./magery.ts";
import { spellFxProfile } from "./magery-animation.ts";
import { nearestWalkable } from "./pathfinding.ts";
import { commandHunt, tickPlayer, you } from "./player.ts";
import { tickWorld } from "./sim.ts";
import type { Creature, FaunaKind, SpellId, World } from "./types.ts";
import { createWorld } from "./world.ts";

/** Tick the real loop — movement and beats — until a note comes back. */
function tickUntilNote(world: World): string {
  for (let i = 0; i < 60; i++) {
    tickWorld(world, 0.1);
    const note = tickPlayer(world, 0.1);
    if (note !== null) return note;
    if (world.player.intent.kind === "none" && world.player.armedSpell === null) return "intent cleared without a note";
  }
  return "beat never landed";
}

function mageReady(world: World) {
  world.player.pack.spellbook = 1;
  world.player.skills.magery = 50;
  world.player.mana = 80;
}

/** A planted fixture beast — wild spawns vary by seed, the suite does not. */
function beast(world: World, kind: FaunaKind, dx: number, dz = 0): Creature {
  const player = you(world)!;
  const dest = nearestWalkable(world, Math.round(player.x) + dx, Math.round(player.z) + dz);
  const c = spawn(world, kind, dest?.x ?? player.x + dx, dest?.y ?? player.z + dz);
  c.task = "idle";
  c.taskUntil = world.hour + 99;
  c.path = [];
  world.fauna.push(c);
  return c;
}

/** Stand the caster next to a fixture beast. */
function standBy(world: World, c: Creature, dx = -1) {
  const player = you(world)!;
  player.x = c.x + dx;
  player.z = c.z;
  player.path = [];
}

test("circle three - meta, circle, profile, voice, and the right targeting", () => {
  const circles = new Set(SPELL_CIRCLES.flatMap((c) => c.ids));
  const circle3: SpellId[] = ["summon", "paralyze", "invisibility", "curse"];
  for (const id of circle3) {
    assert.ok(circles.has(id), `${id} sits in a circle`);
    assert.ok(SPELL_META[id].words.length > 2, `${id} has words of power`);
    assert.ok(spellFxProfile(id).duration > 0.2, `${id} has a release profile`);
    const file = path.join(process.cwd(), "public", "audio", "sfx", `spell-${id}.mp3`);
    assert.ok(existsSync(file), `${file} exists`);
  }
  assert.ok(OFFENSIVE_SPELLS.has("paralyze") && OFFENSIVE_SPELLS.has("curse"), "the hexes ride the offensive path");
  assert.ok(!OFFENSIVE_SPELLS.has("summon") && !OFFENSIVE_SPELLS.has("invisibility"), "the self spells stay off it");
  assert.equal(SPELL_CIRCLES.find((c) => c.circle === 4)?.label, "Fourth");
  assert.deepEqual(
    circle3.map((id) => SPELL_META[id].reagents.includes("nightshade")),
    [false, true, true, true],
    "nightshade feeds the dark arts",
  );
});

test("summon - a beast pads to your side, bound, and the old binding loosens on recast", () => {
  const world = createWorld();
  setWorld(world);
  mageReady(world);
  world.player.pack.mandrake = 4;
  world.player.pack.moss = 4;
  world.player.pack.silk = 4;
  const random = Math.random;
  Math.random = () => 0.5; // magery 50 + 15 = 65 — a wolf answers
  try {
    assert.equal(commandCast(world, "summon", { kind: "self" }), null);
    const note = tickUntilNote(world);
    assert.match(note, /Kal Xen/);
    assert.match(note, /pads to your side/i);
  } finally {
    Math.random = random;
  }
  const bound = world.fauna.find((c) => c.ownerId === world.player.id && (c.boundUntil ?? 0) > world.hour);
  assert.ok(bound, "a bound beast walks the vale");
  assert.equal(bound.kind, "wolf");
  assert.ok(Math.abs((bound.boundUntil ?? 0) - (world.hour + SUMMON_HOURS)) < 0.2, "the binding holds its hours");
  assert.equal(world.player.pack.mandrake, 3);
  assert.equal(world.player.pack.silk, 3);
  // Recast — the first binding crumbles.
  const firstId = bound.id;
  Math.random = () => 0.5;
  try {
    assert.equal(commandCast(world, "summon", { kind: "self" }), null);
    const note = tickUntilNote(world);
    assert.match(note, /old binding loosens/i);
  } finally {
    Math.random = random;
  }
  assert.ok(!world.fauna.some((c) => c.id === firstId), "the first wolf is gone");
  assert.ok(world.fauna.some((c) => c.ownerId === world.player.id && (c.boundUntil ?? 0) > world.hour), "a new binding stands");
});

test("summon - the binding loosens on its own when the hours run out", () => {
  const world = createWorld();
  setWorld(world);
  const player = you(world)!;
  const summoned = spawn(world, "wolf", player.x + 1, player.z);
  summoned.ownerId = world.player.id;
  summoned.loyalty = 100;
  summoned.boundUntil = world.hour + 0.5;
  world.fauna.push(summoned);
  world.hour += 1;
  tickEcology(world, 0.016);
  assert.ok(!world.fauna.some((c) => c.id === summoned.id), "the beast crumbles back into the vale");
  assert.ok(JSON.stringify(world.log).includes("binding loosens"), "the vale notes the loosening");
});

test("summon - a bound wolf tears at whatever its caster hunts", () => {
  const world = createWorld();
  setWorld(world);
  world.player.skills.swords = 50;
  world.player.skills.anatomy = 0;
  const wolfDmg = FAUNA_META.wolf.dmg;
  const bound = beast(world, "wolf", 1);
  bound.ownerId = world.player.id;
  bound.loyalty = 100;
  bound.boundUntil = world.hour + SUMMON_HOURS;
  const swing = (boundNear: boolean): number => {
    const hare = beast(world, "hare", 1);
    hare.hp = 40;
    hare.maxHp = 40;
    standBy(world, hare);
    bound.x = boundNear ? hare.x + 1 : hare.x + 50;
    bound.z = hare.z;
    world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
    const hp = hare.hp;
    assert.equal(commandHunt(world, hare.id), null);
    tickUntilNote(world);
    const dealt = hp - hare.hp;
    world.fauna = world.fauna.filter((c) => c.id !== hare.id);
    return dealt;
  };
  const random = Math.random;
  Math.random = () => 0.5;
  let alone = 0;
  let aided = 0;
  try {
    alone = swing(false);
    aided = swing(true);
  } finally {
    Math.random = random;
  }
  assert.ok(alone >= 4, `the plain swing lands (${alone})`);
  assert.ok(Math.abs(aided - alone - wolfDmg) <= 1, `the wolf's rend adds its teeth (${aided} - ${alone} ≈ ${wolfDmg})`);
});

test("paralyze - the lock holds stride and teeth alike, then lets go", () => {
  const world = createWorld();
  setWorld(world);
  mageReady(world);
  world.player.pack.nightshade = 3;
  world.player.pack.silk = 3;
  world.player.skills.swords = 50;
  const player = you(world)!;
  const wolf = beast(world, "wolf", 1);
  wolf.hp = 40;
  wolf.maxHp = 40;
  standBy(world, wolf);
  // Control: an unlocked wolf counters the swing.
  const random = Math.random;
  Math.random = () => 0.5;
  let countered = 0;
  try {
    const hp0 = player.hp;
    assert.equal(commandHunt(world, wolf.id), null);
    tickUntilNote(world);
    countered = hp0 - player.hp;
  } finally {
    Math.random = random;
  }
  assert.ok(countered >= 1, `the free wolf answers (${countered})`);
  // Lock it.
  Math.random = () => 0.5;
  try {
    assert.equal(commandCast(world, "paralyze", { kind: "fauna", id: wolf.id }), null);
    const note = tickUntilNote(world);
    assert.match(note, /An Ex Por/);
    assert.match(note, /locks mid-stride/i);
  } finally {
    Math.random = random;
  }
  assert.ok((wolf.paralyzeUntil ?? 0) > world.hour, "the lock is on");
  assert.ok(Math.abs((wolf.paralyzeUntil ?? 0) - (world.hour + PARALYZE_HOURS)) < 0.2, "the lock holds its hours");
  assert.equal(world.player.pack.nightshade, 2);
  assert.equal(world.player.pack.silk, 2);
  // Held: no stride…
  const wx = wolf.x;
  const wz = wolf.z;
  for (let i = 0; i < 5; i++) tickEcology(world, 0.016);
  assert.equal(wolf.x, wx, "a held beast does not walk");
  assert.equal(wolf.z, wz);
  // …no teeth — even a spider's venom roll that would always land.
  const spider = beast(world, "stonecrawl_spider", 1);
  spider.hp = 40;
  spider.maxHp = 40;
  spider.paralyzeUntil = world.hour + PARALYZE_HOURS;
  standBy(world, spider);
  world.player.poisonUntil = 0;
  Math.random = () => 0.1; // a fang roll that never misses
  try {
    const hp1 = player.hp;
    assert.equal(commandHunt(world, spider.id), null);
    tickUntilNote(world);
    assert.equal(player.hp, hp1, "a held spider cannot bite");
    assert.equal(world.player.poisonUntil, 0, "and its venom stays behind its teeth");
  } finally {
    Math.random = random;
  }
  // …and the lock lets go.
  world.hour += PARALYZE_HOURS + 0.1;
  tickEcology(world, 0.016);
  assert.equal(wolf.paralyzeUntil ?? 0, 0, "the lock releases");
  assert.equal(wolf.task, "wander", "the beast walks its own hours again");
});

test("invisibility - the pack loses your scent until your hand betrays it", () => {
  const world = createWorld();
  setWorld(world);
  mageReady(world);
  world.player.pack.nightshade = 3;
  world.player.pack.moss = 3;
  world.hour = 21; // deep night — the hunters are out
  const wolf = beast(world, "wolf", -4);
  wolf.task = "fight";
  wolf.path = [];
  standBy(world, wolf, -4);
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    assert.equal(commandCast(world, "invisibility", { kind: "self" }), null);
    const note = tickUntilNote(world);
    assert.match(note, /An Lor Xen/);
    assert.match(note, /forgets your shape/i);
  } finally {
    Math.random = random;
  }
  assert.ok(Math.abs(world.player.invisUntil - (world.hour + INVIS_HOURS)) < 0.2, "the shimmer holds its hours");
  assert.equal(wolf.task, "idle", "the casting itself calms the pack");
  for (let i = 0; i < 3; i++) tickEcology(world, 0.016);
  assert.notEqual(wolf.task, "fight", "the hunters cannot smell the unseen");
  // Your hand betrays the shimmer — the swing reveals you.
  Math.random = () => 0.5;
  try {
    assert.equal(commandHunt(world, wolf.id), null);
    tickUntilNote(world);
  } finally {
    Math.random = random;
  }
  assert.equal(world.player.invisUntil, 0, "the swing tears the shimmer");
  for (let i = 0; i < 3; i++) tickEcology(world, 0.016);
  assert.equal(wolf.task, "fight", "the pack has your scent again");
  // So does a harmful word.
  world.player.invisUntil = world.hour + INVIS_HOURS;
  world.player.pack.pearl = 3;
  wolf.task = "idle";
  wolf.taskUntil = world.hour + 99;
  wolf.path = [];
  Math.random = () => 0.5;
  try {
    assert.equal(commandCast(world, "magicarrow", { kind: "fauna", id: wolf.id }), null);
    tickUntilNote(world);
  } finally {
    Math.random = random;
  }
  assert.equal(world.player.invisUntil, 0, "a harmful word tears it too");
});

test("curse - strength sours: a weaker bite and a slower stride", () => {
  const world = createWorld();
  setWorld(world);
  mageReady(world);
  world.player.pack.nightshade = 3;
  world.player.pack.garlic = 3;
  world.player.pack.silk = 3;
  world.player.skills.swords = 50;
  const wolf = beast(world, "wolf", -1);
  wolf.hp = 60;
  wolf.maxHp = 60;
  standBy(world, wolf);
  const player = you(world)!;
  const swing = (): number => {
    const hp0 = player.hp;
    assert.equal(commandHunt(world, wolf.id), null);
    tickUntilNote(world);
    return hp0 - player.hp;
  };
  const random = Math.random;
  Math.random = () => 0.5; // no venom on a wolf — the bite is the measure
  let whole = 0;
  let soured = 0;
  try {
    whole = swing();
    assert.equal(commandCast(world, "curse", { kind: "fauna", id: wolf.id }), null);
    const note = tickUntilNote(world);
    assert.match(note, /Des Sanct/);
    assert.match(note, /strength sours/i);
    soured = swing();
  } finally {
    Math.random = random;
  }
  assert.ok(whole >= 2, `the whole bite hurts (${whole})`);
  assert.ok(soured < whole, `the soured bite dulls (${soured} < ${whole})`);
  assert.ok(Math.abs((wolf.curseUntil ?? 0) - (world.hour + 1)) < 0.3, "the bane holds its hour");
  assert.equal(wolf.task, "fight", "the insult provokes the beast");
  // The stride slows too.
  wolf.task = "wander";
  wolf.taskUntil = world.hour + 99;
  wolf.path = [{ tx: Math.round(wolf.x) + 20, ty: Math.round(wolf.z) }];
  const x0 = wolf.x;
  tickEcology(world, 1);
  assert.ok(Math.abs(wolf.x - x0) < 2.2, `a cursed stride drags (${(wolf.x - x0).toFixed(2)} < 2.2)`);
  assert.equal(world.player.pack.nightshade, 2);
  assert.equal(world.player.pack.garlic, 2);
  assert.equal(world.player.pack.silk, 2);
});

test("a fizzled circle-three spell burns the reagents but not the lock", () => {
  const world = createWorld();
  setWorld(world);
  mageReady(world);
  world.player.pack.nightshade = 1;
  world.player.pack.silk = 1;
  const hare = beast(world, "hare", -2);
  standBy(world, hare, -2);
  const random = Math.random;
  Math.random = () => 0.999; // the words stumble
  try {
    assert.equal(commandCast(world, "paralyze", { kind: "fauna", id: hare.id }), null);
    const note = tickUntilNote(world);
    assert.match(note, /fizzles/i);
  } finally {
    Math.random = random;
  }
  assert.equal(world.player.pack.nightshade, 0, "reagents burn on a fizzle");
  assert.equal(world.player.pack.silk, 0);
  assert.equal(hare.paralyzeUntil ?? 0, 0, "no lock lands");
});
