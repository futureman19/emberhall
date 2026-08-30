import assert from "node:assert/strict";
import test from "node:test";
import { spawnCorpsePile, takeGoldFromPile } from "./piles.ts";
import { verbsFor } from "./context.ts";
import { FAUNA_META, LIVE_SKILLS, SKILL_META } from "./catalog.ts";
import { weaponDmg } from "./rare.ts";
import { setWorld } from "./live.ts";
import { tickPlayer, you, commandLoot } from "./player.ts";
import { createWorld } from "./world.ts";
import type { Creature, FaunaKind, SkillId } from "./types.ts";

function withRoll(v: number, fn: () => void) {
  const old = Math.random;
  Math.random = () => v;
  try {
    fn();
  } finally {
    Math.random = old;
  }
}

function corpse(kind: FaunaKind): Creature {
  return {
    id: `c-${kind}`,
    kind,
    x: 10,
    z: 10,
    hp: 0,
    maxHp: 10,
    path: [],
    task: "dead",
    taskUntil: 0,
    corpseUntil: 0,
    home: { tx: 10, ty: 10 },
    ownerId: null,
    loyalty: 0,
    stay: false,
  };
}

test("loot - a lucky hare leaves its foot", () => {
  const w = createWorld();
  withRoll(0.01, () => spawnCorpsePile(w, corpse("hare")));
  const pile = w.piles.find((p) => p.label === "hare corpse")!;
  assert.equal(pile.items.rabbit_foot, 1);
  // The butcher's share is NOT spilled — that belongs to skinning.
  assert.equal(pile.items.meat ?? 0, 0);
  assert.equal(pile.items.hide ?? 0, 0);
});

test("loot - an unlucky hare spills nothing (the carcass is for the knife)", () => {
  const w = createWorld();
  withRoll(0.99, () => spawnCorpsePile(w, corpse("hare")));
  assert.equal(w.piles.length, 0);
});

test("loot - an orc's whole kit spills at once", () => {
  const w = createWorld();
  withRoll(0.01, () => spawnCorpsePile(w, corpse("orc_marauder")));
  const pile = w.piles.find((p) => p.label === "orc_marauder corpse")!;
  for (const id of ["club", "knife", "hatchet", "mace", "hood", "gloves", "boots", "orc_tusk", "nightshade"] as const) {
    assert.ok((pile.items[id] ?? 0) >= 1, `expected ${id} in the spill`);
  }
  assert.equal(pile.gold, 3); // min of 3–9 at a 0.01 roll
});

test("loot - a wight with empty pockets leaves no litter", () => {
  const w = createWorld();
  withRoll(0.99, () => spawnCorpsePile(w, corpse("wight")));
  assert.equal(w.piles.length, 0);
});

test("loot - a rich wight leaves its hoard — and no meat", () => {
  const w = createWorld();
  withRoll(0.01, () => spawnCorpsePile(w, corpse("wight")));
  const pile = w.piles.find((p) => p.label === "wight corpse")!;
  assert.equal(pile.items.relic, 1);
  assert.ok((pile.items.nightshade ?? 0) >= 1);
  assert.equal(pile.gold, 4);
  assert.equal(pile.items.meat ?? 0, 0);
  assert.equal(pile.items.hide ?? 0, 0);
});

test("loot - the coin lifts clean, the pile keeps the rest", () => {
  const w = createWorld();
  withRoll(0.01, () => spawnCorpsePile(w, corpse("orc_marauder")));
  const pile = w.piles[0];
  const before = w.gold;
  assert.equal(takeGoldFromPile(w, pile.id), 3);
  assert.equal(w.gold, before + 3);
  assert.equal(pile.gold, 0);
  assert.ok(w.piles.includes(pile), "items remain, so the pile remains");
  assert.equal(takeGoldFromPile(w, pile.id), 0);
});

test("loot - taking the last coin buries the empty pile", () => {
  const w = createWorld();
  withRoll(0.01, () => spawnCorpsePile(w, corpse("wight")));
  const pile = w.piles[0];
  pile.items = {}; // imagine the reagents already taken
  takeGoldFromPile(w, pile.id);
  assert.equal(w.piles.length, 0);
});

test("loot - the sword's kill spills too (melee, not just spells)", () => {
  const w = createWorld();
  const p = you(w)!;
  const orc = corpse("orc_marauder");
  orc.task = "idle";
  orc.hp = 1;
  orc.x = p.x + 1;
  orc.z = p.z;
  w.fauna.push(orc);
  w.player.skills.swords = 100; // a sure arm for a sure test
  w.player.intent = { kind: "hunt", tx: Math.round(orc.x), ty: Math.round(orc.z), targetId: orc.id, spell: null };
  withRoll(0.5, () => {
    for (let i = 0; i < 12 && orc.task !== "dead"; i++) tickPlayer(w, 0.6);
  });
  assert.equal(orc.task, "dead");
  const pile = w.piles.find((x) => x.label === "orc_marauder corpse");
  assert.ok(pile, "the fallen orc spilled its carried loot");
});


test("loot - targeting a dead creature id uses its corpse pile", () => {
  const w = createWorld();
  const orc = corpse("orc_marauder");
  orc.x = 11;
  orc.z = 10;
  w.fauna.push(orc);
  withRoll(0.01, () => spawnCorpsePile(w, orc));
  const before = {
    club: w.player.pack.club,
    knife: w.player.pack.knife,
    hatchet: w.player.pack.hatchet,
    mace: w.player.pack.mace,
    hood: w.player.pack.hood,
    gloves: w.player.pack.gloves,
    boots: w.player.pack.boots,
    orc_tusk: w.player.pack.orc_tusk,
    nightshade: w.player.pack.nightshade,
  };
  const got = commandLoot(w, orc.id);
  assert.equal(got, null);
  const gained =
    before.club < w.player.pack.club ||
    before.knife < w.player.pack.knife ||
    before.hatchet < w.player.pack.hatchet ||
    before.mace < w.player.pack.mace ||
    before.hood < w.player.pack.hood ||
    before.gloves < w.player.pack.gloves ||
    before.boots < w.player.pack.boots ||
    before.orc_tusk < w.player.pack.orc_tusk ||
    before.nightshade < w.player.pack.nightshade;
  assert.ok(gained, "expected corpse loot by creature id");
});

test("roster - the hall keeps the roll of the hold", () => {
  const verbs = verbsFor({ kind: "building", id: "b1", tx: 0, ty: 0, label: "hall" });
  assert.equal(verbs[0].verb, "roster");
  assert.equal(verbs[0].label, "Read the roster");
  // A forge is a fire to work, not a roll to read.
  const forge = verbsFor({ kind: "building", id: "b2", tx: 0, ty: 0, label: "forge" });
  assert.ok(!forge.some((v) => v.verb === "roster"));
});

test("care - your own beast offers the Companions page, a wild one does not", () => {
  const w = createWorld();
  setWorld(w);
  const p = you(w)!;
  const pet = {
    id: "pet1",
    kind: "wolf" as const,
    x: p.x + 1,
    z: p.z,
    hp: 10,
    maxHp: 10,
    task: "follow" as const,
    targetId: null,
    path: [],
    taskUntil: 0,
    corpseUntil: 0,
    home: { tx: Math.round(p.x), ty: Math.round(p.z) },
    ownerId: w.player.id,
    loyalty: 40,
    stay: false,
    name: "Soot",
    warnedLoyal: false,
  };
  w.fauna.push(pet);
  const verbs = verbsFor({ kind: "fauna", id: pet.id, tx: 0, ty: 0, label: "wolf" });
  assert.equal(verbs[0].verb, "care");
  const wild = { ...pet, id: "wild1", ownerId: null, name: null };
  w.fauna.push(wild);
  const wildVerbs = verbsFor({ kind: "fauna", id: wild.id, tx: 0, ty: 0, label: "wolf" });
  assert.ok(!wildVerbs.some((v) => v.verb === "care"));
});

test("skills - the books hold every surviving skill, placeholders at zero", () => {
  const w = createWorld();
  const ids = Object.keys(SKILL_META) as SkillId[];
  assert.equal(ids.length, 23, "12 live + 11 placeholders");
  assert.equal(LIVE_SKILLS.length, 12);
  for (const id of ids) {
    assert.equal(typeof w.player.skills[id], "number", `${id} on the books`);
    if (!LIVE_SKILLS.includes(id)) assert.equal(w.player.skills[id], 0, `${id} starts untaught`);
  }
  // Anatomy and Cooking stay — quiet Emberhall originals, still live.
  assert.ok(LIVE_SKILLS.includes("anatomy"));
  assert.ok(LIVE_SKILLS.includes("cooking"));
});

test("archery - a bow strikes from afar, the skill wakes, swords stays asleep", () => {
  const w = createWorld();
  const p = you(w)!;
  w.player.wear.main = "bow";
  w.player.skills.archery = 60; // a practiced arm — sure shots for a sure test
  const hare = corpse("hare");
  hare.task = "idle";
  hare.hp = FAUNA_META.hare.hp;
  hare.x = p.x + 6;
  hare.z = p.z;
  w.fauna.push(hare);
  const hpBefore = p.hp;
  w.player.intent = { kind: "hunt", tx: Math.round(hare.x), ty: Math.round(hare.z), targetId: hare.id, spell: null };
  withRoll(0.5, () => {
    for (let i = 0; i < 12 && hare.task !== "dead"; i++) tickPlayer(w, 0.6);
  });
  assert.ok(hare.hp < FAUNA_META.hare.hp, "arrows landed from six tiles out");
  assert.ok(Math.hypot(p.x - hare.x, p.z - hare.z) > 2, "the hunter never closed to arm's reach");
  assert.ok(w.player.skills.archery > 60, "archery woke with the shots");
  assert.equal(w.player.skills.swords, 12, "swords stayed asleep");
  assert.equal(p.hp, hpBefore, "no teeth answered an arrow from afar");
  assert.equal(weaponDmg("bow"), 8, "a bow bites harder than a fist");
});
