import assert from "node:assert/strict";
import test from "node:test";
import { BOOTS_FORM, BOW_FORM, GAUNTLETS_FORM, GREAVES_FORM, HELM_FORM, MAIL_FORM, SHIELD_FORM } from "./forms.ts";
import {
  EXACT_RECIPE_CATALOG,
  exactRecipeById,
  resolveExactRecipeSelection,
  resourceStackMatchesRole,
} from "./recipes.ts";
import { makeResourceStackKey } from "../inventory/resources.ts";

const ROUGH_OAK = makeResourceStackKey("oak", "log", "rough");
const CHOICE_REDWOOD = makeResourceStackKey("redwood", "log", "choice");
const SOUND_CLOTH = makeResourceStackKey("common_cloth", "cloth", "sound");
const PRISTINE_LINEN = makeResourceStackKey("fine_linen", "cloth", "pristine");
const ROUGH_IRON = makeResourceStackKey("iron_ore", "ore", "rough");
const FLAWED_RUBY = makeResourceStackKey("ruby", "gem", "flawed");

test("exact recipes - bow references the canonical form and immutable output contract", () => {
  const recipe = exactRecipeById("bow");
  assert.equal(recipe, EXACT_RECIPE_CATALOG.bow);
  assert.equal(recipe.formId, BOW_FORM.id);
  assert.equal(recipe.recipeVersion, BOW_FORM.recipeVersion);
  assert.deepEqual(recipe.output, { itemId: "bow", quantity: 1 });
  assert.equal(Object.isFrozen(EXACT_RECIPE_CATALOG), true);
  assert.equal(Object.isFrozen(recipe), true);
  assert.equal(Object.isFrozen(recipe.output), true);
  assert.equal(exactRecipeById("missing"), null);
  assert.deepEqual(exactRecipeById("sword")?.output, { itemId: "sword", quantity: 1 });
});

test("exact recipes - shield form is the first armor craft", () => {
  const recipe = exactRecipeById("shield");
  assert.equal(recipe?.formId, SHIELD_FORM.id);
  assert.deepEqual(recipe?.output, { itemId: "shield", quantity: 1 });
  assert.equal(SHIELD_FORM.baseItem, "shield");
  assert.equal(SHIELD_FORM.itemClass, "armor");
  assert.deepEqual(SHIELD_FORM.roles.map((r) => `${r.role}:${r.amount}:${r.contribution}`), ["plate:3:primary", "frame:2:secondary", "binding:1:secondary"]);
  assert.deepEqual(SHIELD_FORM.roles[0]?.accepts, { qualityType: "grade", kinds: ["ore"], forms: ["ingot"] });
  assert.deepEqual(SHIELD_FORM.baseStats, { damage: 0, hitBonus: 0, armor: 2, skillBonuses: {}, slayerMultipliers: {} });
  assert.deepEqual(SHIELD_FORM.caps, { damage: 0, hitBonus: 0, armor: 5, skillBonusPerSkill: 5, slayerMultiplier: 1.5 });
  assert.deepEqual(SHIELD_FORM.allowedGemFamilies, ["fortune", "protection"]);
  assert.equal(SHIELD_FORM.maxInlays, 1);
});

test("exact recipes - helm form is the head-slot armor craft beside the legacy tag recipe", () => {
  const recipe = exactRecipeById("helm");
  assert.equal(recipe?.formId, HELM_FORM.id);
  assert.deepEqual(recipe?.output, { itemId: "helm", quantity: 1 });
  assert.equal(HELM_FORM.baseItem, "helm");
  assert.equal(HELM_FORM.itemClass, "armor");
  assert.deepEqual(HELM_FORM.roles.map((r) => `${r.role}:${r.amount}:${r.contribution}`), ["plate:2:primary", "lining:1:secondary"]);
  assert.deepEqual(HELM_FORM.roles[0]?.accepts, { qualityType: "grade", kinds: ["ore"], forms: ["ingot"] });
  assert.deepEqual(HELM_FORM.roles[1]?.accepts, { qualityType: "grade", kinds: ["fiber"], forms: ["cloth"] });
  assert.deepEqual(HELM_FORM.baseStats, { damage: 0, hitBonus: 0, armor: 2, skillBonuses: {}, slayerMultipliers: {} });
  assert.deepEqual(HELM_FORM.caps, { damage: 0, hitBonus: 0, armor: 5, skillBonusPerSkill: 5, slayerMultiplier: 1.5 });
  assert.deepEqual(HELM_FORM.allowedGemFamilies, ["fortune", "protection"]);
  assert.equal(HELM_FORM.maxInlays, 1);
});

test("exact recipes - mail form is the chest armor craft beside the legacy tag recipe", () => {
  const recipe = exactRecipeById("mail");
  assert.equal(recipe?.formId, MAIL_FORM.id);
  assert.deepEqual(recipe?.output, { itemId: "mail", quantity: 1 });
  assert.equal(MAIL_FORM.baseItem, "mail");
  assert.equal(MAIL_FORM.itemClass, "armor");
  assert.deepEqual(MAIL_FORM.roles.map((r) => `${r.role}:${r.amount}:${r.contribution}`), ["plate:4:primary", "lining:2:secondary"]);
  assert.deepEqual(MAIL_FORM.roles[0]?.accepts, { qualityType: "grade", kinds: ["ore"], forms: ["ingot"] });
  assert.deepEqual(MAIL_FORM.roles[1]?.accepts, { qualityType: "grade", kinds: ["fiber"], forms: ["cloth"] });
  assert.deepEqual(MAIL_FORM.baseStats, { damage: 0, hitBonus: 0, armor: 4, skillBonuses: {}, slayerMultipliers: {} });
  assert.deepEqual(MAIL_FORM.caps, { damage: 0, hitBonus: 0, armor: 7, skillBonusPerSkill: 5, slayerMultiplier: 1.5 });
  assert.deepEqual(MAIL_FORM.allowedGemFamilies, ["fortune", "protection"]);
  assert.equal(MAIL_FORM.maxInlays, 1);
});

test("exact recipes - the boots, gauntlets, and greaves forms complete the metal armor set", () => {
  for (const [form, roles, baseArmor, capArmor] of [
    [BOOTS_FORM, ["plate:2:primary", "lining:1:secondary"], 2, 5],
    [GAUNTLETS_FORM, ["plate:2:primary", "lining:1:secondary"], 2, 5],
    [GREAVES_FORM, ["plate:3:primary", "lining:2:secondary"], 3, 6],
  ] as const) {
    const recipe = exactRecipeById(form.id);
    assert.equal(recipe?.formId, form.id);
    assert.deepEqual(recipe?.output, { itemId: form.id, quantity: 1 });
    assert.equal(form.baseItem, form.id);
    assert.equal(form.itemClass, "armor");
    assert.deepEqual(form.roles.map((r) => `${r.role}:${r.amount}:${r.contribution}`), roles, `${form.id} roles`);
    assert.deepEqual(form.roles[0]?.accepts, { qualityType: "grade", kinds: ["ore"], forms: ["ingot"] });
    assert.deepEqual(form.roles[1]?.accepts, { qualityType: "grade", kinds: ["fiber"], forms: ["cloth"] });
    assert.equal(form.baseStats.armor, baseArmor, `${form.id} base armor`);
    assert.equal(form.caps.armor, capArmor, `${form.id} armor cap`);
    assert.deepEqual(form.allowedGemFamilies, ["fortune", "protection"]);
    assert.equal(form.maxInlays, 1);
  }
});

test("exact recipes - role compatibility follows the canonical form selectors", () => {
  const [body, binding] = BOW_FORM.roles;
  assert.ok(body);
  assert.ok(binding);
  assert.equal(resourceStackMatchesRole(body, ROUGH_OAK), true);
  assert.equal(resourceStackMatchesRole(body, CHOICE_REDWOOD), true);
  assert.equal(resourceStackMatchesRole(body, SOUND_CLOTH), false);
  assert.equal(resourceStackMatchesRole(body, ROUGH_IRON), false);
  assert.equal(resourceStackMatchesRole(body, FLAWED_RUBY), false);
  assert.equal(resourceStackMatchesRole(binding, SOUND_CLOTH), true);
  assert.equal(resourceStackMatchesRole(binding, PRISTINE_LINEN), true);
  assert.equal(resourceStackMatchesRole(binding, ROUGH_OAK), false);
});

test("exact recipes - exact selections resolve one correlated component per semantic role", () => {
  const resolved = resolveExactRecipeSelection("bow", [
    { role: "binding", key: PRISTINE_LINEN },
    { role: "body", key: CHOICE_REDWOOD },
  ]);

  assert.deepEqual(resolved.components, [
    { role: "body", resourceId: "redwood", form: "log", grade: "choice", amount: 5 },
    { role: "binding", resourceId: "fine_linen", form: "cloth", grade: "pristine", amount: 1 },
  ]);
  assert.deepEqual(resolved.debits, [
    { key: CHOICE_REDWOOD, amount: 5 },
    { key: PRISTINE_LINEN, amount: 1 },
  ]);
  assert.equal(Object.isFrozen(resolved), true);
  assert.equal(Object.isFrozen(resolved.components), true);
  assert.equal(Object.isFrozen(resolved.debits), true);
});

test("exact recipes - missing, duplicate, mixed, unknown, and incompatible selections reject", () => {
  assert.throws(
    () => resolveExactRecipeSelection("bow", [{ role: "body", key: ROUGH_OAK }]),
    /missing selection for role binding/,
  );
  assert.throws(
    () => resolveExactRecipeSelection("bow", [
      { role: "body", key: ROUGH_OAK },
      { role: "body", key: CHOICE_REDWOOD },
      { role: "binding", key: SOUND_CLOTH },
    ]),
    /multiple material stacks for role body/,
  );
  assert.throws(
    () => resolveExactRecipeSelection("bow", [
      { role: "body", key: ROUGH_OAK },
      { role: "binding", key: SOUND_CLOTH },
      { role: "finish", key: SOUND_CLOTH },
    ]),
    /unknown role finish/,
  );
  assert.throws(
    () => resolveExactRecipeSelection("bow", [
      { role: "body", key: ROUGH_IRON },
      { role: "binding", key: SOUND_CLOTH },
    ]),
    /iron_ore:ore:rough is incompatible with role body/,
  );
  assert.throws(
    () => resolveExactRecipeSelection("bow", [
      { role: "body", key: ROUGH_OAK },
      { role: "binding", key: FLAWED_RUBY },
    ]),
    /ruby:gem:flawed is incompatible with role binding/,
  );
});

test("exact recipes - selection boundaries reject inherited fields and accessors without invoking them", () => {
  let getterCalls = 0;
  const accessor = { role: "body" } as Record<string, unknown>;
  Object.defineProperty(accessor, "key", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return ROUGH_OAK;
    },
  });
  assert.throws(
    () => resolveExactRecipeSelection("bow", [accessor as never, { role: "binding", key: SOUND_CLOTH }]),
    /selection must contain exactly own data fields: role, key/,
  );
  assert.equal(getterCalls, 0);

  const inherited = Object.assign(Object.create({ role: "body" }), { key: ROUGH_OAK });
  assert.throws(
    () => resolveExactRecipeSelection("bow", [inherited, { role: "binding", key: SOUND_CLOTH }]),
    /selection must contain exactly own data fields: role, key/,
  );
});
