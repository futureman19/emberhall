import assert from "node:assert/strict";
import test from "node:test";
import { FAUNA_META } from "./catalog.ts";
import { seedFauna, spawn, tickEcology } from "./ecology.ts";
import { spawnCorpsePile } from "./piles.ts";
import { you } from "./player.ts";
import { mulberry32 } from "./rng.ts";
import type { FaunaKind } from "./types.ts";
import { createWorld } from "./world.ts";

const EXPANSION_KINDS = [
  "oak_bear",
  "frosthorn_ram",
  "fen_leech",
  "tideclaw_crab",
  "cavern_bat",
  "tomb_sentinel",
  "cinder_drake",
  "willow_wisp",
] as const satisfies readonly FaunaKind[];

test("balanced fauna pack adds eight complete creature contracts", () => {
  assert.equal(Object.keys(FAUNA_META).length, 35);
  for (const kind of EXPANSION_KINDS) {
    const meta = FAUNA_META[kind];
    assert.ok(meta.label.length > 3, `${kind} has a proper name`);
    assert.ok(meta.hp > 0, `${kind} has health`);
    assert.ok(meta.dmg > 0, `${kind} can defend itself`);
    assert.ok(meta.eats.length > 0, `${kind} has a diet`);
  }
});

test("balanced fauna pack mixes bondable beasts with untameable monsters", () => {
  for (const kind of ["oak_bear", "frosthorn_ram", "tideclaw_crab", "cavern_bat", "cinder_drake"] as const) {
    assert.ok(FAUNA_META[kind].tameDiff < 90, `${kind} can be bonded by a master tamer`);
  }
  for (const kind of ["fen_leech", "tomb_sentinel", "willow_wisp"] as const) {
    assert.ok(FAUNA_META[kind].tameDiff >= 90, `${kind} remains a monster`);
  }
  assert.equal(FAUNA_META.tomb_sentinel.hasCorpse, false);
  assert.equal(FAUNA_META.willow_wisp.hasCorpse, false);
  assert.ok((FAUNA_META.tomb_sentinel.loot?.length ?? 0) > 0);
  assert.ok((FAUNA_META.willow_wisp.loot?.length ?? 0) > 0);
});

test("every new kind is discoverable in the seeded vale", () => {
  const world = createWorld();
  world.fauna = [];
  seedFauna(world, mulberry32(808));
  const seeded = new Set(world.fauna.map((creature) => creature.kind));
  for (const kind of EXPANSION_KINDS) assert.ok(seeded.has(kind), `${kind} has a regional spawn`);
});

test("new nocturnal threats hunt while the unseen dead still spill treasure", () => {
  const world = createWorld();
  const player = you(world)!;
  world.hour = 21;
  world.fauna = [spawn(world, "cavern_bat", player.x + 2, player.z)];
  tickEcology(world, 0.016);
  assert.equal(world.fauna[0]!.task, "fight", "the cavern bat joins the night hunters");

  const sentinel = spawn(world, "tomb_sentinel", player.x + 1, player.z);
  sentinel.hp = 0;
  sentinel.task = "dead";
  const random = Math.random;
  Math.random = () => 0.01;
  try {
    spawnCorpsePile(world, sentinel);
  } finally {
    Math.random = random;
  }
  const pile = world.piles.find((candidate) => candidate.label === "tomb_sentinel corpse");
  assert.ok(pile, "the sentinel's carried relics survive its crumbling body");
  assert.equal(pile.items.relic, 1);
  assert.equal(pile.gold, 5);
});