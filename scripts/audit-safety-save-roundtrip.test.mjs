import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { createWorld } from "../src/game/world.ts";
import { SAVE_KEY, loadSave, writeSave } from "../src/game/save.ts";
import { commandEquip, commandEquipRare, commandUnequip, you } from "../src/game/player.ts";
import { commandSellRare } from "../src/game/npcs.ts";
import { applyMintRare } from "../src/game/vault.ts";
import { LOOK_SCHEMA } from "../src/game/look/types.ts";
import { commandCraft, RECIPES } from "../src/game/craft.ts";
import { ITEM_META } from "../src/game/catalog.ts";
import { createCraftedItem, rareClassOf, rollRare } from "../src/game/rare.ts";

const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
beforeEach(() => {
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  } });
});
afterEach(() => {
  if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
  else delete globalThis.localStorage;
});

function roundtrip(world) {
  // A sentinel proves writeSave replaced storage, rather than loading an older save.
  localStorage.setItem(SAVE_KEY, "previous-save");
  const before = structuredClone(world);
  writeSave(world);
  assert.notEqual(localStorage.getItem(SAVE_KEY), "previous-save", "current state must persist");
  assert.deepEqual(structuredClone(world), before, "save projection must not mutate live state");
  const loaded = loadSave();
  assert.ok(loaded, "written state must load");
  assert.deepEqual(loaded.player, JSON.parse(JSON.stringify(world.player)));
  assert.deepEqual(loaded.people, JSON.parse(JSON.stringify(world.people)));
  assert.deepEqual(loaded.resourceNodes, world.resourceNodes);
  assert.equal(loaded.gold, world.gold);
  return loaded;
}

function equipmentWorld() {
  const world = createWorld();
  world.player.pack.club = 1;
  world.player.rares.push(rollRare("club", () => 0, { maxRank: 1 }));
  world.player.poisonUntil = 123;
  world.people[0].look = { schema: LOOK_SCHEMA, cls: "mage", skin: "#96795d", hairStyle: "long", hairColor: "#a85a42", garb: "#6a5a78", parts: ["retained-part"] };
  return world;
}

for (const transition of ["ordinary unequip", "rare unequip", "ordinary to rare", "rare to ordinary", "rare to rare", "sell worn rare", "confirmed mint removal"]) {
  test(`SE01 action/save/load: ${transition}`, () => {
    const world = equipmentWorld();
    const uid = world.player.rares[0].uid;
    if (transition === "ordinary unequip") {
      const hood = world.player.wear.head;
      const count = world.player.pack[hood] ?? 0;
      assert.equal(commandUnequip(world, "head"), "Off.");
      assert.equal(world.player.wear.head, undefined);
      assert.equal(world.player.pack[hood], count + 1);
    } else if (transition === "ordinary to rare") {
      commandEquip(world, "club");
      commandEquipRare(world, uid);
      assert.equal(world.player.wear.main, undefined);
      assert.equal(world.player.wearRare.main, uid);
      assert.equal(world.player.pack.club, 1);
    } else {
      commandEquipRare(world, uid);
      if (transition === "rare unequip") {
        commandUnequip(world, "main");
        assert.equal(world.player.wearRare.main, undefined);
        assert.equal(world.player.rares.length, 1);
      } else if (transition === "rare to ordinary") {
        commandEquip(world, "club");
        assert.equal(world.player.wearRare.main, undefined);
        assert.equal(world.player.wear.main, "club");
      } else if (transition === "rare to rare") {
        const second = rollRare("club", () => 0, { maxRank: 1 });
        world.player.rares.push(second);
        commandEquipRare(world, second.uid);
        assert.equal(world.player.wearRare.main, second.uid);
        assert.equal(world.player.rares.length, 2);
      } else if (transition === "confirmed mint removal") {
        // Local post-confirmation reducer only: no wallet, network, signing or broadcast.
        applyMintRare(world, uid);
        assert.equal(world.player.rares.length, 0);
        assert.equal(world.player.wearRare.main, undefined);
      } else {
        const gold = world.gold;
        commandSellRare(world, uid);
        assert.equal(world.player.rares.length, 0);
        assert.equal(world.player.wearRare.main, undefined);
        assert.ok(world.gold > gold);
      }
    }
    roundtrip(world);
  });
}

const utilityRecipes = RECIPES.filter((recipe) => !recipe.exactRecipeId && Object.keys(recipe.give).some((base) => rareClassOf(base)));
function craftUtility(recipe, quality) {
  const world = createWorld();
  for (const id of Object.keys(ITEM_META)) world.player.pack[id] = 100;
  world.player.skills[recipe.skill] = 100;
  world.player.wear.main = "knife";
  if (recipe.station) {
    const building = world.buildings.find(({ kind }) => kind === (recipe.station === "forge" ? "forge" : "yard"));
    assert.ok(building);
    you(world).x = building.tx;
    you(world).z = building.ty;
  }
  const original = Math.random;
  Math.random = () => quality === "fine" ? 0.23 : 0;
  try {
    assert.match(commandCraft(world, recipe.id), /maker's mark/);
  } finally {
    Math.random = original;
  }
  assert.equal(world.player.rares.length, 1);
  const item = world.player.rares[0];
  assert.equal(item.workmanship, quality);
  assert.equal(item.source, "crafted");
  assert.equal(item.formId, undefined);
  assert.equal(item.recipeId, recipe.id);
  assert.equal(world.player.pack[item.base], 100, "one output became singular, not duplicated in the stack");
  return world;
}
for (const recipe of utilityRecipes) {
  for (const quality of ["fine", "exceptional"]) {
    test(`SE02 utility action/save/load: ${recipe.id} ${quality}`, () => {
      const world = craftUtility(recipe, quality);
      const loaded = roundtrip(world);
      assert.deepEqual(loaded.player.rares[0], world.player.rares[0], "singular identity and stats survive exactly");
    });
  }
}

test("SE01 all known undefined slots project away without changing the runtime maps", () => {
  const world = createWorld();
  const slots = ["head", "chest", "cloak", "hands", "legs", "feet", "neck", "finger", "main", "off"];
  world.player.wear = Object.fromEntries(slots.map((slot) => [slot, undefined]));
  world.player.wearRare = { ...world.player.wear };
  const loaded = roundtrip(world);
  assert.deepEqual(loaded.player.wear, {});
  assert.deepEqual(loaded.player.wearRare, {});
  assert.deepEqual(Object.keys(world.player.wear), slots);
  assert.deepEqual(Object.keys(world.player.wearRare), slots);
});

test("SE01 invalid wear values and unknown slots still reject without overwriting", () => {
  for (const field of ["wear", "wearRare"]) {
    for (const bad of [{ unknown: undefined }, { unknown: "club" }, { main: null }, { main: 7 }, ...(field === "wear" ? [{ main: "unknown" }] : [])]) {
      const world = createWorld();
      world.player[field] = bad;
      localStorage.setItem(SAVE_KEY, "previous-save");
      writeSave(world);
      assert.equal(localStorage.getItem(SAVE_KEY), "previous-save");
    }
  }
});

function rejectMutation(original, mutate) {
  const world = structuredClone(original);
  mutate(world.player.rares[0]);
  localStorage.setItem(SAVE_KEY, "previous-save");
  writeSave(world);
  assert.equal(localStorage.getItem(SAVE_KEY), "previous-save", "invalid runtime rare must not overwrite");
  const payload = { ...world, tiles: null, saveVersion: 4 };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  assert.equal(loadSave(), null, "invalid persisted rare must not load");
}

test("SE02 utility branch rejects malformed identity and forged stats", () => {
  const world = craftUtility(utilityRecipes.find(({ id }) => id === "club"), "exceptional");
  // Include canonical components to test both old and new constructors independently.
  world.player.rares[0].components = [];
  for (const mutate of [
    (item) => { item.formId = "not-a-form"; },
    (item) => { item.formId = null; },
    (item) => { item.recipeId = "bow"; },
    (item) => { item.recipeId = "board"; },
    (item) => { item.recipeId = "unknown"; },
    (item) => { item.base = "mace"; },
    (item) => { item.recipeVersion = 2; },
    (item) => { item.workmanship = "ordinary"; },
    (item) => { item.maker = " "; },
    (item) => { delete item.maker; },
    (item) => { item.components = [{ role: "body" }]; },
    (item) => { item.components = null; },
    (item) => { delete item.components; },
    (item) => { item.inlays = [{ resourceId: "ruby", clarity: "flawed" }]; },
    (item) => { item.inlays = null; },
    (item) => { delete item.inlays; },
    (item) => { item.affixes = ["of power"]; },
    (item) => { item.resolvedStats.damage += 1; },
    (item) => { item.resolvedStats.hitBonus = Infinity; },
    (item) => { item.resolvedStats.armor += 1; },
    (item) => { item.resolvedStats.skillBonuses = { smithing: 5 }; },
    (item) => { item.resolvedStats.slayerMultipliers = { wolf: 2 }; },
    (item) => { item.resolvedStats.extra = 1; },
    (item) => { delete item.resolvedStats; },
  ]) rejectMutation(world, mutate);
});

test("SE02 exact crafted records cannot fall through the utility branch", () => {
  const world = createWorld();
  world.player.rares.push(createCraftedItem(world, {
    formId: "bow", base: "bow", workmanship: "fine", maker: "Ada", recipeId: "bow", recipeVersion: 1,
    components: [
      { role: "body", resourceId: "redwood", form: "log", grade: "choice", amount: 5 },
      { role: "binding", resourceId: "common_cloth", form: "cloth", grade: "sound", amount: 1 },
    ],
    inlays: [{ resourceId: "ruby", clarity: "flawed" }],
  }));
  roundtrip(world);
  for (const mutate of [
    (item) => { delete item.formId; },
    (item) => { item.components = []; },
    (item) => { item.recipeId = "club"; },
    (item) => { item.resolvedStats.damage += 1; },
    (item) => { item.maker = " "; },
  ]) rejectMutation(world, mutate);
});
