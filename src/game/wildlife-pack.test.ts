import assert from "node:assert/strict";
import test from "node:test";
import { FAUNA_META } from "./catalog.ts";
import { seedFauna, spawn } from "./ecology.ts";
import { spawnCorpsePile } from "./piles.ts";
import { commandTame, you } from "./player.ts";
import { mulberry32 } from "./rng.ts";
import type { FaunaKind } from "./types.ts";
import { createWorld } from "./world.ts";

const WILDLIFE_KINDS = [
  "redtail_squirrel",
  "whiteback_elk",
  "highland_aurochs",
  "reed_heron",
  "river_otter",
  "brine_seal",
  "cave_mole",
  "dusk_owl",
] as const satisfies readonly FaunaKind[];

test("wildlife pack adds eight complete tameable animal contracts", () => {
  assert.ok(Object.keys(FAUNA_META).length >= 51, "the wildlife pack extends the roster");
  for (const kind of WILDLIFE_KINDS) {
    const meta = FAUNA_META[kind];
    assert.ok(meta.label.length > 5, `${kind} has a proper name`);
    assert.ok(meta.hp > 0 && meta.dmg > 0, `${kind} has bounded combat stats`);
    assert.ok(meta.tameDiff < 90, `${kind} can be bonded`);
    assert.ok(meta.eats.length > 0, `${kind} has a diet`);
    assert.ok((meta.meat ?? 0) > 0, `${kind} supports ordinary hunting utility`);
  }
});

test("every new animal has a discoverable regional spawn", () => {
  const world = createWorld();
  world.fauna = [];
  seedFauna(world, mulberry32(2121));
  const seeded = new Set(world.fauna.map((creature) => creature.kind));
  for (const kind of WILDLIFE_KINDS) assert.ok(seeded.has(kind), `${kind} has a regional spawn`);
});

test("a master tamer may approach every animal in the wildlife pack", () => {
  const world = createWorld();
  const player = you(world)!;
  world.player.skills.taming = 100;
  world.fauna = WILDLIFE_KINDS.map((kind, index) => spawn(world, kind, player.x + index + 1, player.z));
  for (const creature of world.fauna) {
    assert.equal(commandTame(world, creature.id), null, `${creature.kind} accepts a taming attempt`);
  }
});

test("coastal and burrowing wildlife carry useful ordinary finds", () => {
  const world = createWorld();
  const player = you(world)!;
  const seal = spawn(world, "brine_seal", player.x + 1, player.z);
  seal.hp = 0;
  seal.task = "dead";
  const mole = spawn(world, "cave_mole", player.x + 2, player.z);
  mole.hp = 0;
  mole.task = "dead";
  const random = Math.random;
  Math.random = () => 0.01;
  try {
    spawnCorpsePile(world, seal);
    spawnCorpsePile(world, mole);
  } finally {
    Math.random = random;
  }
  assert.equal(world.piles.find((pile) => pile.label === "brine_seal corpse")?.items.raw_fish, 1);
  assert.equal(world.piles.find((pile) => pile.label === "cave_mole corpse")?.items.ore, 1);
});