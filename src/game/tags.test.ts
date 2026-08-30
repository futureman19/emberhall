import assert from "node:assert/strict";
import test from "node:test";
import { FAUNA_META, ITEM_META, countTag, hasTag, tagConsumeOrder } from "./catalog.ts";
import { commandCraft, commandCraftBatch, maxCraftable, recipeById } from "./craft.ts";
import { seedFauna } from "./ecology.ts";
import { commandChop, commandFeed, commandSkin, you } from "./player.ts";
import { mulberry32 } from "./rng.ts";
import { createWorld } from "./world.ts";
import type { ItemId, World } from "./types.ts";

const ITEMS = Object.keys(ITEM_META) as ItemId[];

/** Tests set sparse packs; the sim only ever reads present keys. */
function givePack(w: World, items: Partial<Record<ItemId, number>>) {
  w.player.pack = { ...items } as World["player"]["pack"];
}

function standAt(w: World, kind: string) {
  const p = you(w)!;
  const b = w.buildings.find((x) => x.kind === kind)!;
  assert.ok(b, `world has a ${kind}`);
  p.x = b.tx;
  p.z = b.ty;
  p.path = [];
}

/** Land every success roll — consumption, not luck, is under test. Skill at
 *  GM + a mid roll also keeps the exceptional-craft roll from converting
 *  the product into a rare (covered separately in rare.test.ts). */
function craftOk(w: World, id: string) {
  const rec = recipeById(id);
  if (rec) w.player.skills[rec.skill] = 100;
  const old = Math.random;
  Math.random = () => 0.5;
  try {
    return commandCraft(w, id);
  } finally {
    Math.random = old;
  }
}

test("tags - every item declares at least one resource tag", () => {
  for (const id of ITEMS) {
    assert.ok(ITEM_META[id].tags.length > 0, `${id} has tags`);
  }
});

test("tags - taxonomy spot checks: materials, properties, the blade set", () => {
  assert.deepEqual(ITEM_META.log.tags, ["wood", "fuel"]);
  assert.ok(hasTag("sword", "metal") && hasTag("sword", "blade") && hasTag("sword", "weapon"));
  assert.ok(hasTag("silk", "cloth"), "spider silk cuts like cloth");
  assert.ok(hasTag("cabbage", "plant") && hasTag("cabbage", "food"));
  assert.ok(hasTag("ingot", "metal") && hasTag("ore", "metal"));
  assert.ok(!hasTag("mace", "blade"), "a mace is not sharp");
  assert.ok(!hasTag("club", "blade"), "a club is not sharp");
  assert.ok(hasTag("hatchet", "blade") && hasTag("knife", "blade"));
});

test("tags - countTag sums across item ids; consume order is cheapest-first", () => {
  assert.equal(countTag({ log: 2, board: 3, ore: 1 }, "wood"), 5);
  assert.equal(countTag({ silk: 1, tunic: 1, ore: 4 }, "cloth"), 2);
  assert.equal(countTag(undefined, "wood"), 0);
  assert.equal(tagConsumeOrder("wood")[0], "log", "raw logs burn before boards");
  assert.equal(tagConsumeOrder("metal")[0], "ore", "raw ore before ingots");
});

test("craft - the club takes any wood: logs alone suffice, no boards needed", () => {
  const w = createWorld();
  standAt(w, "yard");
  givePack(w, { log: 2 });
  const note = craftOk(w, "club");
  assert.ok(note?.includes("club"), `crafted: ${note}`);
  assert.equal(w.player.pack.club, 1);
  assert.equal(w.player.pack.log, 0);
});

test("craft - tag ingredients burn the cheapest material first", () => {
  const w = createWorld();
  standAt(w, "yard");
  givePack(w, { log: 1, board: 2 });
  craftOk(w, "club"); // wants 2 wood: eats the log (sell 2) before a board (sell 3)
  assert.equal(w.player.pack.log, 0);
  assert.equal(w.player.pack.board, 1);
  assert.equal(w.player.pack.club, 1);
});

test("craft - smelt stays exact: metal tags do not fake raw ore", () => {
  const w = createWorld();
  standAt(w, "forge");
  givePack(w, { ingot: 5 });
  assert.equal(commandCraft(w, "smelt"), "Need iron ore.");
  // ...but the ring welcomes any metal — even unsmelted ore (UO's loose logic).
  givePack(w, { ore: 2 });
  const note = craftOk(w, "ring");
  assert.ok(note?.includes("ring"), `crafted: ${note}`);
  assert.equal(w.player.pack.ring, 1);
  assert.equal(w.player.pack.ore, 0);
});

test("craft - field work: cut bandages anywhere, any cloth, but only with a blade", () => {
  const w = createWorld();
  givePack(w, { silk: 1 });
  w.player.wear.main = "mace"; // blunt — the edge check must refuse
  assert.equal(commandCraft(w, "cut_bandage"), "The work wants an edge. Hold a blade — hatchet, knife, or sword.");
  w.player.wear.main = "sword";
  const note = craftOk(w, "cut_bandage");
  assert.ok(note?.includes("bandage"), `crafted: ${note}`);
  assert.equal(w.player.pack.bandage, 2);
  assert.equal(w.player.pack.silk, 0);
});

test("craft - the leather tunic finally has a source: two hides and a blade", () => {
  const w = createWorld();
  givePack(w, { hide: 2 });
  w.player.wear.main = "knife";
  const note = craftOk(w, "cut_leather");
  assert.ok(note?.includes("leather"), `crafted: ${note}`);
  assert.equal(w.player.pack.leather, 1);
  assert.equal(w.player.pack.hide, 0);
  assert.equal(recipeById("cut_leather")?.station, null, "field recipe needs no station");
});

test("bladed script - chopping takes any sharp edge, not only the hatchet", () => {
  const w = createWorld();
  w.player.wear.main = "sword";
  assert.equal(commandChop(w, 10, 10), null, "a sword fells a tree, UO-style");
  w.player.wear.main = "mace";
  assert.equal(commandChop(w, 10, 10), "Hold a blade — hatchet, knife, or sword.");
  w.player.wear.main = undefined;
  assert.equal(commandChop(w, 10, 10), "Hold a blade — hatchet, knife, or sword.");
});

test("bladed script - dressing a carcass takes any blade", () => {
  const w = createWorld();
  seedFauna(w, mulberry32(7));
  const c = w.fauna[0]!;
  w.player.wear.main = "staff"; // wood, but no edge
  assert.equal(commandSkin(w, c.id), "Hold a blade — hatchet, knife, or sword.");
  w.player.wear.main = "hatchet";
  assert.equal(commandSkin(w, c.id), null);
});

test("diets - beasts eat by tag: hares want greens, wolves want meat", () => {
  const w = createWorld();
  seedFauna(w, mulberry32(3));
  const hare = w.fauna.find((c) => c.kind === "hare")!;
  const wolf = w.fauna.find((c) => c.kind === "wolf")!;
  assert.ok(hare && wolf, "the vale seeds both kinds");
  hare.ownerId = w.player.id;
  wolf.ownerId = w.player.id;
  givePack(w, { meat: 1 });
  assert.equal(commandFeed(w, hare.id), "It wants greens.");
  givePack(w, { cabbage: 2 });
  assert.equal(commandFeed(w, hare.id), "It eats.");
  assert.equal(w.player.pack.cabbage, 1);
  assert.ok(hare.loyalty > 0);
  givePack(w, { meat: 1 });
  assert.equal(commandFeed(w, wolf.id), "It eats.");
  assert.equal(w.player.pack.meat, 0);
  assert.deepEqual(FAUNA_META.hare.eats, ["plant"]);
  assert.deepEqual(FAUNA_META.wolf.eats, ["meat"]);
});

/** Mid-roll stub: success passes, the exceptional gate fails — plain batch math. */
function batchOk(w: World, id: string, times: number) {
  const rec = recipeById(id);
  if (rec) w.player.skills[rec.skill] = 100;
  const old = Math.random;
  Math.random = () => 0.5;
  try {
    return commandCraftBatch(w, id, times);
  } finally {
    Math.random = old;
  }
}

test("craft batch - ×N produces N× the give and burns N× the material", () => {
  const w = createWorld();
  standAt(w, "yard");
  givePack(w, { log: 5 });
  const note = batchOk(w, "board", 5);
  assert.ok(note?.includes("10 boards"), `made: ${note}`);
  assert.equal(w.player.pack.board, 10);
  assert.equal(w.player.pack.log, 0);
});

test("craft batch - the stint ends when the pile runs short", () => {
  const w = createWorld();
  standAt(w, "yard");
  givePack(w, { log: 3 });
  const note = batchOk(w, "board", 10);
  assert.ok(note?.includes("6 boards"), `made: ${note}`);
  assert.equal(w.player.pack.board, 6);
  assert.equal(w.player.pack.log, 0);
});

test("craft batch - every attempt rolls its own success; splits are counted", () => {
  const w = createWorld();
  standAt(w, "yard");
  givePack(w, { log: 3 });
  const old = Math.random;
  Math.random = () => 0.99; // everything splits
  let note: string | null = null;
  try {
    note = commandCraftBatch(w, "board", 3);
  } finally {
    Math.random = old;
  }
  assert.ok(note?.includes("3 split"), `split: ${note}`);
  assert.equal(w.player.pack.board ?? 0, 0);
  assert.equal(w.player.pack.log, 0, "split work still burns the wood");
});

test("craft batch - maxCraftable reads exact and tag needs", () => {
  const w = createWorld();
  givePack(w, { log: 3, board: 1 });
  assert.equal(maxCraftable(w, recipeById("board")!), 3, "3 logs, 3 splits");
  assert.equal(maxCraftable(w, recipeById("club")!), 2, "4 wood total, 2 per club");
  givePack(w, {});
  assert.equal(maxCraftable(w, recipeById("board")!), 0);
});

test("craft batch - field work batches too: six bandages from three silks", () => {
  const w = createWorld();
  givePack(w, { silk: 3 });
  w.player.wear.main = "sword";
  const note = batchOk(w, "cut_bandage", 3);
  assert.ok(note?.includes("6 bandage"), `made: ${note}`);
  assert.equal(w.player.pack.bandage, 6);
  assert.equal(w.player.pack.silk, 0);
});

test("craft batch - the maker's mark can sing more than once in a stint", () => {
  const w = createWorld();
  standAt(w, "yard");
  givePack(w, { log: 6 });
  w.player.skills.carpentry = 100;
  const old = Math.random;
  Math.random = () => 0.01; // success AND the exceptional gate, every time
  let note: string | null = null;
  try {
    note = commandCraftBatch(w, "club", 3);
  } finally {
    Math.random = old;
  }
  assert.equal(w.player.rares.length, 3, "three wonders from three stints");
  assert.equal(w.player.pack.club ?? 0, 0, "each stack piece yielded to its wonder");
  assert.ok((note?.match(/The work sings/g) ?? []).length === 3, `sang thrice: ${note}`);
});

test("craft batch - a recipe never eats its own product (cloth/wood regression)", () => {
  const w = createWorld();
  w.player.wear.main = "sword";
  // Bandages are cloth — but a stack of bandages alone must NOT feed cut_bandage.
  givePack(w, { bandage: 5 });
  assert.equal(maxCraftable(w, recipeById("cut_bandage")!), 0);
  assert.ok(commandCraft(w, "cut_bandage")?.includes("cloth"));
  // A club is wood — crafting clubs must not consume clubs already held.
  standAt(w, "yard");
  w.player.skills.carpentry = 100;
  givePack(w, { log: 2, club: 3 });
  assert.equal(maxCraftable(w, recipeById("club")!), 1);
  const old = Math.random;
  Math.random = () => 0.5;
  const note = commandCraftBatch(w, "club", 5);
  Math.random = old;
  assert.equal(w.player.pack.club, 4, "3 kept + 1 made");
  assert.ok(note?.includes("1 club"), `note: ${note}`);
});
