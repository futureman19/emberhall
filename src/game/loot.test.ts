import assert from "node:assert/strict";
import test from "node:test";
import { spawnCorpsePile, takeGoldFromPile } from "./piles.ts";
import { tickPlayer, you } from "./player.ts";
import { createWorld } from "./world.ts";
import type { Creature, FaunaKind } from "./types.ts";

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
