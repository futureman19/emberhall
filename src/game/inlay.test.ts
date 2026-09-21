import assert from "node:assert/strict";
import test from "node:test";
import { appraiseRare, createCraftedItem, rareName } from "./rare.ts";
import { addResource, makeResourceStackKey, resourceCount } from "./inventory/resources.ts";
import { applyItemInlay, previewItemInlay } from "./inlay.ts";
import { createWorld } from "./world.ts";

const FLAWED_RUBY = makeResourceStackKey("ruby", "gem", "flawed");
const CUT_RUBY = makeResourceStackKey("ruby", "gem", "cut");
const FLAWLESS_SAPPHIRE = makeResourceStackKey("sapphire", "gem", "flawless");
const PERFECT_SAPPHIRE = makeResourceStackKey("sapphire", "gem", "perfect");
const CUT_EMERALD = makeResourceStackKey("emerald", "gem", "cut");

function craftedBow(resourceId: "oak" | "redwood" = "redwood") {
  const world = createWorld();
  const item = createCraftedItem(world, {
    formId: "bow",
    base: "bow",
    workmanship: "ordinary",
    components: [
      { role: "body", resourceId, form: "log", grade: "choice", amount: 5 },
      { role: "binding", resourceId: "common_cloth", form: "cloth", grade: "sound", amount: 1 },
    ],
    inlays: [],
    maker: "Testhand",
    recipeId: "bow",
    recipeVersion: 1,
  });
  world.player.rares.push(item);
  return { world, item };
}

test("inlay - flawed Ruby debits exactly one gem and adds deterministic Power II", () => {
  const { world, item } = craftedBow();
  addResource(world.player.resources, FLAWED_RUBY, 1);

  const preview = previewItemInlay(world.player, item.uid, FLAWED_RUBY);
  assert.equal(preview.status, "ready");
  if (preview.status !== "ready") return;
  assert.equal(preview.effect.label, "Power II");
  assert.equal(preview.stats.damage, 10);
  assert.equal(preview.stats.hitBonus, 2);
  assert.equal(preview.local.fortune, 0);

  const result = applyItemInlay(world.player, item.uid, FLAWED_RUBY);
  assert.equal(result.status, "inlaid");
  assert.equal(resourceCount(world.player.resources, FLAWED_RUBY), 0);
  const updated = world.player.rares[0]!;
  assert.deepEqual(updated.inlays, [{ resourceId: "ruby", clarity: "flawed" }]);
  assert.equal(updated.resolvedStats?.damage, 10);
  assert.deepEqual(updated.affixes, [], "deterministic gem identity does not use the random affix pool");
  assert.match(rareName(updated), /of Power II/);
  assert.ok(appraiseRare(updated).lines.some(({ label }) => label === "Power II"));
});

test("inlay - duplicate family and exhausted slot reject without mutation", () => {
  const { world, item } = craftedBow();
  addResource(world.player.resources, FLAWED_RUBY, 1);
  addResource(world.player.resources, CUT_RUBY, 1);
  addResource(world.player.resources, FLAWLESS_SAPPHIRE, 1);
  assert.equal(applyItemInlay(world.player, item.uid, FLAWED_RUBY).status, "inlaid");

  const before = structuredClone(world.player);
  assert.deepEqual(previewItemInlay(world.player, item.uid, CUT_RUBY), {
    status: "blocked",
    reason: "family",
    message: "Bow already carries power.",
  });
  assert.deepEqual(previewItemInlay(world.player, item.uid, FLAWLESS_SAPPHIRE), {
    status: "blocked",
    reason: "slot",
    message: "Bow has no open inlay slot.",
  });
  assert.deepEqual(world.player, before);
});

test("inlay - Sapphire Fortune remains local-only and capped at five", () => {
  const flawless = craftedBow("oak");
  addResource(flawless.world.player.resources, FLAWLESS_SAPPHIRE, 1);
  const preview = previewItemInlay(flawless.world.player, flawless.item.uid, FLAWLESS_SAPPHIRE);
  assert.equal(preview.status, "ready");
  if (preview.status !== "ready") return;
  assert.equal(preview.effect.label, "Fortune IV");
  assert.equal(preview.local.fortune, 4);
  assert.equal("fortune" in preview.stats, false);
  const canonicalBefore = structuredClone(flawless.item.resolvedStats);
  const applied = applyItemInlay(flawless.world.player, flawless.item.uid, FLAWLESS_SAPPHIRE);
  assert.equal(applied.status, "inlaid");
  assert.deepEqual(flawless.world.player.rares[0]!.resolvedStats, canonicalBefore);
  assert.equal(JSON.stringify(flawless.world.player.rares[0]!.resolvedStats).includes("fortune"), false);
  assert.equal(appraiseRare(flawless.world.player.rares[0]!).lines.some(({ label }) => label.includes("Fortune")), false);

  const perfect = craftedBow("oak");
  addResource(perfect.world.player.resources, PERFECT_SAPPHIRE, 1);
  const perfectPreview = previewItemInlay(perfect.world.player, perfect.item.uid, PERFECT_SAPPHIRE);
  assert.equal(perfectPreview.status, "ready");
  if (perfectPreview.status === "ready") assert.equal(perfectPreview.local.fortune, 5);
});

test("inlay - cut Emerald adds deterministic Precision III accuracy", () => {
  const { world, item } = craftedBow();
  addResource(world.player.resources, CUT_EMERALD, 1);
  const before = structuredClone(item.resolvedStats);

  const preview = previewItemInlay(world.player, item.uid, CUT_EMERALD);
  assert.equal(preview.status, "ready");
  if (preview.status !== "ready") return;
  assert.equal(preview.effect.label, "Precision III");
  assert.equal(preview.stats.hitBonus, (before?.hitBonus ?? 0) + 3);
  assert.equal(preview.stats.damage, before?.damage, "precision never adds damage");

  const result = applyItemInlay(world.player, item.uid, CUT_EMERALD);
  assert.equal(result.status, "inlaid");
  assert.equal(resourceCount(world.player.resources, CUT_EMERALD), 0);
  const updated = world.player.rares[0]!;
  assert.deepEqual(updated.inlays, [{ resourceId: "emerald", clarity: "cut" }]);
  assert.equal(updated.resolvedStats?.hitBonus, (before?.hitBonus ?? 0) + 3);
  assert.match(rareName(updated), /of Precision III/);
});

test("inlay - swords accept precision and reject a second precision family", () => {
  const world = createWorld();
  const sword = createCraftedItem(world, {
    formId: "sword",
    base: "sword",
    workmanship: "ordinary",
    components: [
      { role: "edge", resourceId: "iron_ore", form: "ingot", grade: "choice", amount: 5 },
      { role: "hilt", resourceId: "oak", form: "board", grade: "sound", amount: 1 },
      { role: "binding", resourceId: "common_cloth", form: "cloth", grade: "sound", amount: 1 },
    ],
    inlays: [],
    maker: "Testhand",
    recipeId: "sword",
    recipeVersion: 1,
  });
  world.player.rares.push(sword);
  addResource(world.player.resources, CUT_EMERALD, 2);

  assert.equal(applyItemInlay(world.player, sword.uid, CUT_EMERALD).status, "inlaid");
  assert.deepEqual(previewItemInlay(world.player, sword.uid, CUT_EMERALD), {
    status: "blocked",
    reason: "family",
    message: "Sword already carries precision.",
  });
});

test("inlay - shields accept protection, reject a second, and swords reject protection", () => {
  const world = createWorld();
  const shield = createCraftedItem(world, {
    formId: "shield",
    base: "shield",
    workmanship: "ordinary",
    components: [
      { role: "plate", resourceId: "iron_ore", form: "ingot", grade: "choice", amount: 3 },
      { role: "frame", resourceId: "oak", form: "board", grade: "sound", amount: 2 },
      { role: "binding", resourceId: "common_cloth", form: "cloth", grade: "sound", amount: 1 },
    ],
    inlays: [],
    maker: "Testhand",
    recipeId: "shield",
    recipeVersion: 1,
  });
  world.player.rares.push(shield);
  const FLAWLESS_DIAMOND = makeResourceStackKey("diamond", "gem", "flawless");
  addResource(world.player.resources, FLAWLESS_DIAMOND, 2);

  const before = structuredClone(shield.resolvedStats);
  const preview = previewItemInlay(world.player, shield.uid, FLAWLESS_DIAMOND);
  assert.equal(preview.status, "ready");
  if (preview.status !== "ready") return;
  assert.equal(preview.effect.label, "Protection IV");
  assert.equal(preview.stats.armor, (before?.armor ?? 0) + 1, "flawless diamond adds exactly the shield's cap headroom");

  assert.equal(applyItemInlay(world.player, shield.uid, FLAWLESS_DIAMOND).status, "inlaid");
  const updated = world.player.rares[0]!;
  assert.deepEqual(updated.inlays, [{ resourceId: "diamond", clarity: "flawless" }]);
  assert.equal(updated.resolvedStats?.armor, (before?.armor ?? 0) + 1);
  assert.match(rareName(updated), /of Protection IV/);
  assert.equal(previewItemInlay(world.player, shield.uid, FLAWLESS_DIAMOND).status, "blocked", "no second protection family");

  const sword = createCraftedItem(world, {
    formId: "sword",
    base: "sword",
    workmanship: "ordinary",
    components: [
      { role: "edge", resourceId: "iron_ore", form: "ingot", grade: "choice", amount: 5 },
      { role: "hilt", resourceId: "oak", form: "board", grade: "sound", amount: 1 },
      { role: "binding", resourceId: "common_cloth", form: "cloth", grade: "sound", amount: 1 },
    ],
    inlays: [],
    maker: "Testhand",
    recipeId: "sword",
    recipeVersion: 1,
  });
  world.player.rares.push(sword);
  assert.equal(previewItemInlay(world.player, sword.uid, FLAWLESS_DIAMOND).status, "blocked", "swords have no protection family slot");
});

test("inlay - insufficient gem and noncrafted targets reject before mutation", () => {
  const { world, item } = craftedBow();
  const before = structuredClone(world.player);
  assert.equal(previewItemInlay(world.player, item.uid, FLAWED_RUBY).status, "blocked");
  assert.deepEqual(world.player, before);

  const legacy = { uid: "legacy", base: "bow" as const, affixes: [], seed: 1, hour: 1 };
  world.player.rares.push(legacy);
  assert.deepEqual(previewItemInlay(world.player, legacy.uid, FLAWED_RUBY), {
    status: "blocked",
    reason: "item",
    message: "Only a material-specific crafted item can take an inlay.",
  });
});
