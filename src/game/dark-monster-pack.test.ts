import assert from "node:assert/strict";
import test from "node:test";
import { BARROW, inGreybarrow } from "./atlas.ts";
import { FAUNA_META } from "./catalog.ts";
import { seedFauna, spawn, tickEcology } from "./ecology.ts";
import { spawnCorpsePile } from "./piles.ts";
import { you } from "./player.ts";
import { rollKillRare } from "./rare.ts";
import { mulberry32 } from "./rng.ts";
import type { FaunaKind } from "./types.ts";
import { createWorld } from "./world.ts";

const DARK_KINDS = [
  "blackbriar_hag",
  "rime_revenant",
  "fen_ghoul",
  "drowned_reaver",
  "deepmaw_basilisk",
  "ossuary_knight",
  "ash_demon",
  "grave_lich",
] as const satisfies readonly FaunaKind[];

test("dark monster pack adds eight dangerous untameable contracts", () => {
  assert.ok(Object.keys(FAUNA_META).length >= 43, "the dark pack extends rather than caps the roster");
  for (const kind of DARK_KINDS) {
    const meta = FAUNA_META[kind];
    assert.ok(meta.label.length > 5, `${kind} has a proper name`);
    assert.ok(meta.hp >= 38, `${kind} is sturdier than common wildlife`);
    assert.ok(meta.dmg >= 11, `${kind} is a credible threat`);
    assert.ok(meta.tameDiff >= 90, `${kind} cannot be bonded`);
    assert.ok(meta.eats.length > 0, `${kind} has a complete ecology contract`);
  }
  assert.notEqual(FAUNA_META.deepmaw_basilisk.hasCorpse, false, "the basilisk can be dressed");
  for (const kind of DARK_KINDS.filter((kind) => kind !== "deepmaw_basilisk")) {
    assert.equal(FAUNA_META[kind].hasCorpse, false, `${kind} leaves no skinnable body`);
    assert.ok((FAUNA_META[kind].loot?.length ?? 0) > 0, `${kind} still carries spoils`);
  }
});

test("every dark monster has a discoverable regional spawn", () => {
  const world = createWorld();
  world.fauna = [];
  seedFauna(world, mulberry32(1313));
  const seeded = new Set(world.fauna.map((creature) => creature.kind));
  for (const kind of DARK_KINDS) assert.ok(seeded.has(kind), `${kind} has a regional spawn`);
});

test("dark monsters hunt at night and grave wardens cannot leave Greybarrow", () => {
  const world = createWorld();
  const player = you(world)!;
  world.hour = 22;
  const ghoul = spawn(world, "fen_ghoul", player.x + 2, player.z);
  const lich = spawn(world, "grave_lich", player.x + 3, player.z);
  world.fauna = [ghoul, lich];
  tickEcology(world, 0.016);
  assert.equal(ghoul.task, "fight", "the fen ghoul hunts after dark");
  assert.ok(inGreybarrow(Math.round(lich.x), Math.round(lich.z)), "the grave lich returns to Greybarrow");
  assert.ok(Math.hypot(lich.x - BARROW.cx, lich.z - BARROW.cy) < 8);
});

test("a slain grave lich crumbles but leaves its hoard", () => {
  const world = createWorld();
  const lich = spawn(world, "grave_lich", BARROW.cx, BARROW.cy);
  lich.hp = 0;
  lich.task = "dead";
  const random = Math.random;
  Math.random = () => 0.01;
  try {
    spawnCorpsePile(world, lich);
  } finally {
    Math.random = random;
  }
  const pile = world.piles.find((candidate) => candidate.label === "grave_lich corpse");
  assert.ok(pile);
  assert.equal(pile.items.relic, 1);
  assert.equal(pile.items.staff, 1);
  assert.equal(pile.gold, 12);
  assert.ok(rollKillRare(world, "grave_lich", () => 0.01), "a lucky lich kill can reveal a rank-five rare");
});