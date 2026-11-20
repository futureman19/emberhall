import assert from "node:assert/strict";
import test from "node:test";
import { ITEM_META, SHOP_STOCK, APOTHECARY_STOCK, emptyPack } from "./catalog.ts";
import { commandCraft, recipeById, craftBlocker } from "./craft.ts";
import { commandEat, you } from "./player.ts";
import { commandBuy } from "./npcs.ts";
import { createWorld } from "./world.ts";
import { writeSave, loadSave } from "./save.ts";
import { ITEM_ICON_KIND } from "../components/game/item-icon-catalog.ts";

const foods = [
  { id: "trail_rations", need: { bread: 1, cooked_meat: 1 }, station: null, fill: 60 },
  { id: "wheat_cakes", need: { wheat: 2 }, station: "fire", fill: 30 },
  { id: "herb_broth", need: { cabbage: 1, garlic: 1 }, station: "fire", fill: 42 },
] as const;

for (const food of foods) {
  test(`${food.id}: registered food crafts, consumes exact supplies, and restores capped hunger`, () => {
    const recipe = recipeById(food.id);
    assert.ok(recipe, "recipe is reachable by the generic craft dispatch");
    assert.deepEqual(recipe.need, food.need);
    assert.equal(recipe.station, food.station);
    assert.deepEqual(ITEM_META[food.id].tags, ["food"]);
    assert.equal(emptyPack()[food.id], 0);
    assert.ok(ITEM_ICON_KIND[food.id]);
    const world = createWorld(1);
    const p = you(world)!;
    p.x = 0; p.z = 0;
    world.player.skills.cooking = 100;
    Object.assign(world.player.pack, food.need);
    if (food.station) {
      assert.match(craftBlocker(world, recipe)!, /fire|hearth/);
      world.campfires.push({ id: "trail-food-test", tx: 0, ty: 0, until: world.hour + 1 });
    }
    const oldRandom = Math.random;
    Math.random = () => 0;
    try { commandCraft(world, food.id); } finally { Math.random = oldRandom; }
    assert.equal(world.player.pack[food.id], 1);
    for (const ingredient of Object.keys(food.need)) {
      assert.equal(world.player.pack[ingredient as keyof typeof world.player.pack], 0);
    }
    assert.ok(craftBlocker(world, recipe), "supplies cannot be reused");
    const depleted = structuredClone(world.player.pack);
    commandCraft(world, food.id);
    assert.deepEqual(world.player.pack, depleted, "shortage rejects without spending");
    Object.assign(world.player.pack, food.need);
    world.player.pack[food.id] = 0;
    world.player.skills.cooking = 0;
    Math.random = () => 0.999;
    try { commandCraft(world, food.id); } finally { Math.random = oldRandom; }
    assert.equal(world.player.pack[food.id], 0, "failed cooking cannot grant food");
    world.player.pack[food.id] = 2;
    p.hunger = 10;
    commandEat(world, food.id);
    assert.equal(p.hunger, 10 + food.fill);
    assert.equal(world.player.pack[food.id], 1);
    p.hunger = 99;
    commandEat(world, food.id);
    assert.equal(p.hunger, 100);
    assert.equal(world.player.pack[food.id], 0);
    commandEat(world, food.id);
    assert.equal(world.player.pack[food.id], 0, "missing food is not consumed");
    world.player.pack[food.id] = 1;
    world.player.ghost = true;
    assert.equal(commandEat(world, food.id), "A ghost cannot.");
    assert.equal(commandCraft(world, food.id), "A ghost cannot.");
    assert.equal(world.player.pack[food.id], 1);
  });
}

test("only trail rations are vendor-stocked and buy through the existing provisioner", () => {
  assert.deepEqual(foods.filter(({ id }) => SHOP_STOCK.includes(id)).map(({ id }) => id), ["trail_rations"]);
  assert.ok(foods.every(({ id }) => !APOTHECARY_STOCK.includes(id)));
  const world = createWorld(1);
  const shop = world.people.find((p) => p.role === "provisioner")!;
  assert.ok(shop);
  const p = you(world)!;
  p.x = shop.x; p.z = shop.z;
  world.gold = 100;
  assert.match(commandBuy(world, "trail_rations"), /Bought/i);
  assert.equal(world.player.pack.trail_rations, 1);
  assert.equal(world.gold, 100 - ITEM_META.trail_rations.buy);
  for (const id of ["wheat_cakes", "herb_broth"] as const) {
    assert.equal(commandBuy(world, id), "They do not keep that.");
  }
});

test("new foods survive save and reload as ordinary pack items", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } });
  try {
    const world = createWorld(1);
    for (const { id } of foods) world.player.pack[id] = 3;
    writeSave(world);
    const loaded = loadSave();
    assert.ok(loaded);
    for (const { id } of foods) assert.equal(loaded.player.pack[id], 3);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
