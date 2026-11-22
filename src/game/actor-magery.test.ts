import assert from "node:assert/strict";
import test from "node:test";
import { castNow, commandCast, forgetMark, hasBook, maxMana, SPELL_META, tickMana } from "./magery.ts";
import { createPerson, createStubWorld } from "./world.ts";
import { SECONDS_PER_HOUR } from "./catalog.ts";
import type { Creature } from "./types.ts";

function beast(id: string, ownerId: string | null = null): Creature {
  return { id, kind: "wolf", x: 31, z: 30, hp: 1, maxHp: 20, path: [], task: "idle", taskUntil: 0, corpseUntil: 0, home: { tx: 31, ty: 30 }, ownerId, loyalty: 100, stay: false };
}

function fixture() {
  const world = createStubWorld();
  const solo = createPerson(world, () => 0.5, { x: 10, z: 10, isPlayer: true });
  const actor = createPerson(world, () => 0.5, { x: 30, z: 30 });
  world.people = [solo, actor];
  world.player.id = solo.id;
  const sheet = structuredClone(world.player);
  sheet.id = actor.id;
  sheet.pack.spellbook = 1;
  for (const meta of Object.values(SPELL_META)) for (const reagent of meta.reagents) sheet.pack[reagent] = 20;
  sheet.pack.rune = 2;
  sheet.skills.magery = 50;
  sheet.lastGain.magery = 0;
  sheet.mana = 100;
  world.playerStates = { [actor.id]: sheet };
  world.hour = 100;
  return { world, solo, actor, sheet };
}

test("selected caster heals its non-player body and debits and trains only its sheet", (t) => {
  const { world, solo, actor, sheet } = fixture();
  t.mock.method(Math, "random", () => 0);
  actor.hp = 1;
  actor.maxHp = 100;
  const before = structuredClone(world.player);
  const body = structuredClone(solo);
  assert.equal(hasBook(world, actor.id), true);
  assert.equal(commandCast(world, "heal", undefined, actor.id), null);
  assert.equal(sheet.intent.targetId, actor.id);
  assert.match(castNow(world, actor.id)!, /wound closes/);
  assert.equal(actor.hp, 1 + 5 + 5 + Math.floor(actor.int / 5));
  assert.equal(sheet.mana, 94);
  assert.equal(sheet.pack.garlic, 19);
  assert.equal(sheet.skills.magery, 50.1);
  assert.deepEqual(world.player, before);
  assert.deepEqual(solo, body);
});

test("mana regeneration and mark deletion select the actor", () => {
  const { world, solo, actor, sheet } = fixture();
  sheet.mana = 0;
  sheet.marks = [{ id: "own", name: "Own", tx: 30, ty: 30 }];
  const before = structuredClone(world.player);
  const body = structuredClone(solo);
  tickMana(world, SECONDS_PER_HOUR, actor.id);
  assert.equal(sheet.mana, 5);
  tickMana(world, SECONDS_PER_HOUR * 100, actor.id);
  assert.equal(sheet.mana, maxMana(actor.int, 50));
  assert.equal(forgetMark(world, "own", actor.id), "The rune fades.");
  assert.deepEqual(sheet.marks, []);
  assert.deepEqual(world.player, before);
  assert.deepEqual(solo, body);
});

for (const spell of ["nightsight", "bless", "ironwood", "invisibility", "fly", "cure"] as const) {
  test(`${spell} applies only to the selected sheet`, (t) => {
    const { world, actor, sheet } = fixture();
    t.mock.method(Math, "random", () => 0);
    sheet.poisonUntil = world.hour + 10;
    const before = structuredClone(world.player);
    assert.equal(commandCast(world, spell, undefined, actor.id), null);
    assert.ok(castNow(world, actor.id));
    const field = { nightsight: "nightSightUntil", bless: "blessUntil", ironwood: "ironwoodUntil", invisibility: "invisUntil", fly: "flyUntil", cure: "poisonUntil" }[spell] as "nightSightUntil";
    assert.equal(spell === "cure" ? sheet[field] === 0 : sheet[field] > world.hour, true);
    assert.deepEqual(world.player, before);
  });
}

test("ghost checks and resurrection belong to the selected actor", (t) => {
  const { world, solo, actor, sheet } = fixture();
  t.mock.method(Math, "random", () => 0);
  sheet.ghost = true;
  actor.ghost = true;
  sheet.corpseAt = { tx: 35, ty: 36 };
  const before = structuredClone(world.player);
  const body = structuredClone(solo);
  assert.equal(commandCast(world, "heal", undefined, actor.id), "The dead have no words.");
  assert.equal(commandCast(world, "resurrect", undefined, actor.id), null);
  assert.match(castNow(world, actor.id)!, /Blood remembers/);
  assert.equal(sheet.ghost, false);
  assert.equal(actor.ghost, false);
  assert.deepEqual([actor.x, actor.z], [35, 36]);
  assert.deepEqual(world.player, before);
  assert.deepEqual(solo, body);
});

test("all actor entry points reject unknown IDs without touching solo", () => {
  const { world } = fixture();
  const before = structuredClone(world);
  for (const action of [() => hasBook(world, "missing"), () => tickMana(world, 1, "missing"), () => forgetMark(world, "x", "missing"), () => commandCast(world, "heal", undefined, "missing"), () => castNow(world, "missing")]) assert.throws(action, /Unknown actor: missing/);
  assert.deepEqual(structuredClone(world), before);
});

for (const spell of ["magicarrow", "leech", "chainlightning", "fireblast"] as const) {
  test(`${spell} respects caster ownership and awards its kill rare`, (t) => {
    const { world, actor, sheet } = fixture();
    t.mock.method(Math, "random", () => 0);
    const owned = beast("owned", actor.id);
    const enemy = beast("enemy");
    world.fauna = [owned, enemy];
    const before = structuredClone(world.player);
    if (spell !== "fireblast") assert.equal(commandCast(world, spell, { kind: "fauna", id: owned.id }, actor.id), "It is yours.");
    assert.equal(commandCast(world, spell, spell === "fireblast" ? { kind: "tile", tx: 31, ty: 30 } : { kind: "fauna", id: enemy.id }, actor.id), null);
    assert.ok(castNow(world, actor.id));
    assert.equal(enemy.task, "dead");
    assert.equal(owned.hp, 1);
    assert.equal(sheet.rares.length, 1);
    assert.deepEqual(world.player, before);
  });
}

for (const spell of ["summon", "summonelemental", "necromancy"] as const) {
  test(`${spell} binds only to the selected caster`, (t) => {
    const { world, actor, sheet } = fixture();
    t.mock.method(Math, "random", () => 0);
    const soloPet = beast("solo-pet", world.player.id);
    soloPet.boundUntil = world.hour + 10;
    const corpse = beast("corpse");
    corpse.task = "dead";
    corpse.hp = 0;
    world.fauna = [soloPet, corpse];
    const before = structuredClone(world.player);
    const petBefore = structuredClone(soloPet);
    assert.equal(commandCast(world, spell, undefined, actor.id), null);
    assert.ok(castNow(world, actor.id));
    assert.ok(world.fauna.some(c => c.ownerId === sheet.id && c.task !== "dead"));
    assert.ok(world.fauna.includes(soloPet));
    assert.deepEqual(soloPet, petBefore);
    assert.deepEqual(world.player, before);
  });
}

test("mark and gate move only the caster and its followers", (t) => {
  const { world, solo, actor, sheet } = fixture();
  t.mock.method(Math, "random", () => 0.01);
  const ownPet = beast("own", actor.id);
  const soloPet = beast("solo", solo.id);
  world.fauna = [ownPet, soloPet];
  const before = structuredClone(world.player);
  const body = structuredClone(solo);
  const pet = structuredClone(soloPet);
  assert.equal(commandCast(world, "mark", undefined, actor.id), null);
  assert.ok(castNow(world, actor.id));
  assert.equal(sheet.marks.length, 1);
  assert.deepEqual([sheet.marks[0].tx, sheet.marks[0].ty], [30, 30]);
  actor.x = 40;
  assert.equal(commandCast(world, "gate", { kind: "mark", id: sheet.marks[0].id }, actor.id), null);
  assert.ok(castNow(world, actor.id));
  assert.deepEqual([actor.x, actor.z], [30, 30]);
  assert.ok(Math.hypot(ownPet.x - actor.x, ownPet.z - actor.z) < 2);
  assert.deepEqual(soloPet, pet);
  assert.deepEqual(solo, body);
  assert.deepEqual(world.player, before);
});

test("a selected actor that becomes a ghost cannot release a pending living spell", () => {
  const { world, actor, sheet } = fixture();
  assert.equal(commandCast(world, "heal", undefined, actor.id), null);
  sheet.ghost = true;
  const mana = sheet.mana;
  const reagents = structuredClone(sheet.pack);
  assert.equal(castNow(world, actor.id), "The dead have no words.");
  assert.equal(sheet.mana, mana);
  assert.deepEqual(sheet.pack, reagents);
  assert.equal(sheet.intent.kind, "none");
});

test("omitted actor keeps legacy isPlayer-first body and solo sheet", (t) => {
  const { world, solo, actor, sheet } = fixture();
  t.mock.method(Math, "random", () => 0);
  world.player.pack = structuredClone(sheet.pack);
  world.player.mana = 100;
  solo.hp = 1;
  const before = structuredClone(sheet);
  const body = structuredClone(actor);
  assert.equal(commandCast(world, "heal"), null);
  assert.match(castNow(world)!, /wound closes/);
  assert.ok(solo.hp > 1);
  assert.deepEqual(sheet, before);
  assert.deepEqual(actor, body);
});
