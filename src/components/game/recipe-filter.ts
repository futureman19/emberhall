import { RECIPES, canMake, craftBlocker } from "../../game/craft.ts";
import type { World } from "../../game/types.ts";

/** UI-only list: readiness means an attempt is allowed, not guaranteed success. */
export function visibleRecipes(world: World, readyOnly = false) {
  return RECIPES.filter((recipe) => !recipe.exactRecipeId &&
    (!readyOnly || (craftBlocker(world, recipe) === null && canMake(world, recipe))));
}
