import assert from "node:assert/strict";
import test from "node:test";
import { addResource, makeResourceStackKey, resourceCount } from "./inventory/resources.ts";
import { createCraftedItem } from "./rare.ts";
import {
  applySalvage,
  previewSalvage,
  SALVAGE_GEM_SKILL_MIN,
} from "./salvage.ts";
import type { RareItem } from "./types.ts";
import { createWorld } from "./world.ts";

const CHOICE_IRON_INGOT = makeResourceStackKey("iron_ore", "ingot", "choice");
const SOUND_OAK_LOG = makeResourceStackKey("oak", "log", "sound");
const SOUND_CLOTH = makeResourceStackKey("common_cloth", "cloth", "sound");
const PRISTINE_EMBERITE_INGOT = makeResourceStackKey("emberite", "ingot", "pristine");
const CUT_RUBY = makeResourceStackKey("ruby", "gem", "cut");

/** Mirrors the canonical sword form bill: five ingots, one timber hilt, one cloth binding. */
function craftedSword(inlays: { resourceId: "ruby"; clarity: "cut" }[] = []) {
  const world = createWorld();
  const item = createCraftedItem(world, {
    formId: "sword",
    base: "sword",
    workmanship: "ordinary",
    components: [
      { role: "edge", resourceId: "iron_ore", form: "ingot", grade: "choice", amount: 5 },
      { role: "hilt", resourceId: "oak", form: "log", grade: "sound", amount: 1 },
      { role: "binding", resourceId: "common_cloth", form: "cloth", grade: "sound", amount: 1 },
    ],
    inlays,
    maker: "Testhand",
    recipeId: "sword",
    recipeVersion: 1,
  });
  world.player.rares.push(item);
  return { world, item };
}

test("salvage - sword returns half its edge ingots and destroys one-unit components", () => {
  const { world, item } = craftedSword();

  const preview = previewSalvage(world, item.uid);
  assert.equal(preview.status, "ready");
  if (preview.status !== "ready") return;
  assert.deepEqual(preview.recovered, [{ key: CHOICE_IRON_INGOT, amount: 2 }]);
  assert.equal(preview.gems.length, 0);

  const result = applySalvage(world, item.uid);
  assert.equal(result.status, "salvaged");
  assert.equal(world.player.rares.length, 0);
  assert.equal(resourceCount(world.player.resources, CHOICE_IRON_INGOT), 2);
  assert.equal(resourceCount(world.player.resources, SOUND_OAK_LOG), 0);
  assert.equal(resourceCount(world.player.resources, SOUND_CLOTH), 0);
});

test("salvage - recovery ladder rounds down: 4->2, 3->1, 2->1, 1->0", () => {
  const world = createWorld();
  const item = createCraftedItem(world, {
    formId: "mail",
    base: "mail",
    workmanship: "fine",
    components: [
      { role: "plate", resourceId: "iron_ore", form: "ingot", grade: "sound", amount: 4 },
      { role: "lining", resourceId: "fine_linen", form: "cloth", grade: "rough", amount: 2 },
    ],
    inlays: [],
    maker: "Testhand",
    recipeId: "mail",
    recipeVersion: 1,
  });
  world.player.rares.push(item);

  const result = applySalvage(world, item.uid);
  assert.equal(result.status, "salvaged");
  assert.equal(resourceCount(world.player.resources, makeResourceStackKey("iron_ore", "ingot", "sound")), 2);
  assert.equal(resourceCount(world.player.resources, makeResourceStackKey("fine_linen", "cloth", "rough")), 1);
});

test("salvage - preview never mutates rares or resources", () => {
  const { world, item } = craftedSword([{ resourceId: "ruby", clarity: "cut" }]);
  world.player.skills.smithing = SALVAGE_GEM_SKILL_MIN;

  const preview = previewSalvage(world, item.uid);
  assert.equal(preview.status, "ready");
  assert.equal(world.player.rares.length, 1);
  assert.equal(resourceCount(world.player.resources, CHOICE_IRON_INGOT), 0);
  assert.equal(resourceCount(world.player.resources, CUT_RUBY), 0);
});

test("salvage - inlaid gem is destroyed below the explicit high-skill rule", () => {
  const { world, item } = craftedSword([{ resourceId: "ruby", clarity: "cut" }]);
  world.player.skills.smithing = SALVAGE_GEM_SKILL_MIN - 1;

  const preview = previewSalvage(world, item.uid);
  assert.equal(preview.status, "ready");
  if (preview.status !== "ready") return;
  assert.equal(preview.gemsRecovered, false);
  assert.equal(preview.gems.length, 1);

  const result = applySalvage(world, item.uid);
  assert.equal(result.status, "salvaged");
  if (result.status !== "salvaged") return;
  assert.equal(result.gemsRecovered, false);
  assert.equal(resourceCount(world.player.resources, CUT_RUBY), 0);
});

test("salvage - inlaid gem returns at the high-skill threshold, same clarity", () => {
  const { world, item } = craftedSword([{ resourceId: "ruby", clarity: "cut" }]);
  world.player.skills.smithing = SALVAGE_GEM_SKILL_MIN;

  const result = applySalvage(world, item.uid);
  assert.equal(result.status, "salvaged");
  if (result.status !== "salvaged") return;
  assert.equal(result.gemsRecovered, true);
  assert.deepEqual(result.gems, [{ resourceId: "ruby", clarity: "cut" }]);
  assert.equal(resourceCount(world.player.resources, CUT_RUBY), 1);
});

test("salvage - never reproduces more rare material than the item contains", () => {
  const world = createWorld();
  const item = createCraftedItem(world, {
    formId: "sword",
    base: "sword",
    workmanship: "exceptional",
    components: [
      { role: "edge", resourceId: "emberite", form: "ingot", grade: "pristine", amount: 5 },
      { role: "hilt", resourceId: "oak", form: "log", grade: "sound", amount: 1 },
      { role: "binding", resourceId: "common_cloth", form: "cloth", grade: "sound", amount: 1 },
    ],
    inlays: [],
    maker: "Testhand",
    recipeId: "sword",
    recipeVersion: 1,
  });
  world.player.rares.push(item);
  addResource(world.player.resources, PRISTINE_EMBERITE_INGOT, 10);

  const result = applySalvage(world, item.uid);
  assert.equal(result.status, "salvaged");
  assert.equal(resourceCount(world.player.resources, PRISTINE_EMBERITE_INGOT), 12);
});

test("salvage - a salvaged uid cannot be salvaged twice (no duplicated rare inputs)", () => {
  const { world, item } = craftedSword();
  const first = applySalvage(world, item.uid);
  assert.equal(first.status, "salvaged");

  const second = applySalvage(world, item.uid);
  assert.equal(second.status, "blocked");
  assert.equal(resourceCount(world.player.resources, CHOICE_IRON_INGOT), 2);
});

test("salvage - loot and legacy rares without a material bill are blocked", () => {
  const world = createWorld();
  const loot: RareItem = { uid: "loot-1", base: "sword", affixes: ["power"], seed: 1, hour: 0, source: "loot" };
  world.player.rares.push(loot);

  const preview = previewSalvage(world, "loot-1");
  assert.equal(preview.status, "blocked");
  if (preview.status !== "blocked") return;
  assert.equal(preview.reason, "item");
  assert.equal(world.player.rares.length, 1);
});

test("salvage - equipped rares are blocked until unequipped", () => {
  const { world, item } = craftedSword();
  world.player.wearRare.main = item.uid;

  const preview = previewSalvage(world, item.uid);
  assert.equal(preview.status, "blocked");
  if (preview.status !== "blocked") return;
  assert.equal(preview.reason, "equipped");
  assert.equal(world.player.rares.length, 1);
});

test("salvage - unknown uid is blocked", () => {
  const { world } = craftedSword();
  const preview = previewSalvage(world, "missing-uid");
  assert.equal(preview.status, "blocked");
  if (preview.status !== "blocked") return;
  assert.equal(preview.reason, "item");
});
