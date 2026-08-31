import assert from "node:assert/strict";
import test from "node:test";
import { BOW_FORM } from "./forms.ts";
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
  assert.deepEqual(recipe.output, { itemId: "bow", quantity: 1 });
  assert.equal(Object.isFrozen(EXACT_RECIPE_CATALOG), true);
  assert.equal(Object.isFrozen(recipe), true);
  assert.equal(Object.isFrozen(recipe.output), true);
  assert.equal(exactRecipeById("missing"), null);
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
