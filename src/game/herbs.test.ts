import assert from "node:assert/strict";
import test from "node:test";
import { CROP_META, harvestNow, plantNow, tickCrops } from "./farm.ts";
import {
  HERB_META,
  HERB_ORDER,
  HERB_REGROW_HOURS,
  commandPick,
  ensureHerbs,
  herbReady,
  herbSuits,
} from "./herbs.ts";
import { setWorld } from "./live.ts";
import { tickPlayer, you } from "./player.ts";
import type { World } from "./types.ts";
import { createWorld } from "./world.ts";

/** The game loop ticks in small frames; the work beat lands when a tick
 *  crosses the impact phase (single big dt jumps skip over it). */
function tickUntilNote(world: World): string {
  for (let i = 0; i < 30; i++) {
    const note = tickPlayer(world, 0.1);
    if (note !== null) return note;
    if (world.player.intent.kind === "none") return "intent cleared without a note";
  }
  return "beat never landed";
}

test("wild herbs - the vale scatters every kind onto suitable dirt", () => {
  const world = createWorld();
  assert.ok(world.herbs.length >= 45, `expected a living scatter, got ${world.herbs.length}`);
  for (const kind of HERB_ORDER) {
    const patches = world.herbs.filter((h) => h.kind === kind);
    assert.ok(patches.length >= 6, `${kind} has patches (${patches.length})`);
    for (const patch of patches) {
      assert.ok(herbSuits(world, kind, patch.tx, patch.ty), `${kind} at ${patch.tx},${patch.ty} suits the land`);
      assert.equal(patch.until, 0, "starts ready");
    }
  }
});

test("wild herbs - ensureHerbs is idempotent", () => {
  const world = createWorld();
  const before = world.herbs.map((h) => `${h.kind}:${h.tx},${h.ty}`).join("|");
  ensureHerbs(world);
  const after = world.herbs.map((h) => `${h.kind}:${h.tx},${h.ty}`).join("|");
  assert.equal(after, before);
});

test("wild herbs - old saves grow their scatter on load", () => {
  const world = createWorld();
  (world as { herbs?: unknown }).herbs = undefined;
  setWorld(world);
  assert.ok(Array.isArray(world.herbs));
  assert.ok(world.herbs.length >= 40, "migration replants the vale");
});

test("pick a herb - walk-up pluck yields reagents and puts the patch to sleep", () => {
  const world = createWorld();
  const player = you(world)!;
  const patch = world.herbs.find((h) => h.kind === "ginseng")!;
  player.x = patch.tx;
  player.z = patch.ty;
  player.path = [];
  const before = world.player.pack.ginseng ?? 0;
  const random = Math.random;
  Math.random = () => 0.5; // single pinch, no seed
  try {
    assert.equal(commandPick(world, patch.id), null);
    const note = tickUntilNote(world);
    assert.match(note, /ginseng/i);
  } finally {
    Math.random = random;
  }
  assert.equal(world.player.pack.ginseng, before + 1);
  assert.ok(!herbReady(world, patch), "patch goes dormant");
  assert.equal(patch.until, world.hour + HERB_REGROW_HOURS);
  // second attempt refuses while it regrows
  assert.match(String(commandPick(world, patch.id)), /picked clean/);
});

test("pick a herb - a lucky pluck doubles and brings a seed", () => {
  const world = createWorld();
  const player = you(world)!;
  const patch = world.herbs.find((h) => h.kind === "mandrake")!;
  player.x = patch.tx;
  player.z = patch.ty;
  player.path = [];
  const beforeRoot = world.player.pack.mandrake ?? 0;
  const beforeSeed = world.player.pack.mandrake_seed ?? 0;
  const random = Math.random;
  Math.random = () => 0.1; // double pinch + seed
  try {
    assert.equal(commandPick(world, patch.id), null);
    const note = tickUntilNote(world);
    assert.match(note, /2 mandrake/i);
    assert.match(note, /seed/i);
  } finally {
    Math.random = random;
  }
  assert.equal(world.player.pack.mandrake, beforeRoot + 2);
  assert.equal(world.player.pack.mandrake_seed, beforeSeed + 1);
});

test("pick a herb - pearls and ash give no seeds", () => {
  assert.equal(HERB_META.pearl.seed, null);
  assert.equal(HERB_META.ash.seed, null);
  const world = createWorld();
  const player = you(world)!;
  const patch = world.herbs.find((h) => h.kind === "pearl")!;
  player.x = patch.tx;
  player.z = patch.ty;
  player.path = [];
  const random = Math.random;
  Math.random = () => 0.1;
  try {
    assert.equal(commandPick(world, patch.id), null);
    tickUntilNote(world);
  } finally {
    Math.random = random;
  }
  assert.ok((world.player.pack.pearl ?? 0) >= 1);
});

test("reagent crops - ginseng seed plants, ripens, and harvests", () => {
  const world = createWorld();
  const player = you(world)!;
  const tx = Math.round(player.x);
  const ty = Math.round(player.z);
  world.plots.push({ id: "bed_test", tx, ty, crop: null, plantedHour: 0, stage: 0 });
  world.player.pack.ginseng_seed = 2;
  world.player.intent = { kind: "plant", tx, ty, targetId: "ginseng", spell: null };
  const plantNote = plantNow(world);
  assert.match(String(plantNote), /seed takes/i);
  const bed = world.plots.find((p) => p.id === "bed_test")!;
  assert.equal(bed.crop, "ginseng");
  assert.equal(world.player.pack.ginseng_seed, 1);
  bed.plantedHour = world.hour - CROP_META.ginseng.hours - 1;
  tickCrops(world);
  assert.equal(bed.stage, 3, "ripe");
  const before = world.player.pack.ginseng ?? 0;
  const random = Math.random;
  Math.random = () => 0.1; // harvest succeeds, extra seed
  try {
    world.player.intent = { kind: "harvest", tx, ty, targetId: bed.id, spell: null };
    const note = String(harvestNow(world));
    assert.match(note, /ginseng/i);
  } finally {
    Math.random = random;
  }
  assert.equal(world.player.pack.ginseng, before + 1);
  assert.ok((world.player.pack.ginseng_seed ?? 0) >= 2, "seeds come back with the harvest");
  assert.equal(bed.crop, null);
});

test("reagent crops - all three herbs ride the crop table", () => {
  assert.equal(CROP_META.ginseng.crop, "ginseng");
  assert.equal(CROP_META.mandrake.crop, "mandrake");
  assert.equal(CROP_META.moss.crop, "moss");
  for (const id of ["ginseng", "mandrake", "moss"] as const) {
    assert.ok(CROP_META[id].hours > 1, `${id} grows slower than food`);
    assert.ok(CROP_META[id].diff > 18, `${id} is harder than garlic`);
  }
});
