import {
  countPlayerResource,
  debitPlayerResources,
  parseResourceInventory,
} from "../inventory/resources.ts";
import type { PlayerState } from "../types.ts";
import {
  resolveExactRecipeSelection,
  resourceStackLabel,
  type ExactMaterialSelection,
  type ExactRecipeId,
  type ExactRecipeOutput,
} from "./recipes.ts";
import type { CraftedComponent } from "./types.ts";

export type ExactCraftPlayer = Pick<PlayerState, "pack" | "resources">;

export type ExactCraftTransactionResult =
  | Readonly<{
      status: "blocked";
      reason: "materials";
      message: string;
    }>
  | Readonly<{
      status: "crafted";
      recipeId: ExactRecipeId;
      output: ExactRecipeOutput;
      components: readonly CraftedComponent[];
    }>;

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function outputCount(player: ExactCraftPlayer, itemId: ExactRecipeOutput["itemId"]): number {
  const count = player.pack[itemId] ?? 0;
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("craft output count must be a nonnegative safe integer");
  }
  return count;
}

/**
 * Validate selection, complete inventory, aggregate availability, and output
 * capacity before committing either side of the craft. This transaction does
 * not roll skill/workmanship; Task 10 will place it behind the bow work roll.
 */
export function executeExactCraftTransaction(
  player: ExactCraftPlayer,
  recipeId: string,
  selections: readonly ExactMaterialSelection[],
): ExactCraftTransactionResult {
  const resolved = resolveExactRecipeSelection(recipeId, selections);
  const currentOutput = outputCount(player, resolved.recipe.output.itemId);
  const nextOutput = currentOutput + resolved.recipe.output.quantity;
  if (!Number.isSafeInteger(nextOutput)) throw new Error("craft output count exceeds safe integer range");

  const planned: ExactCraftPlayer = {
    pack: structuredClone(player.pack),
    resources: parseResourceInventory(player.resources),
  };
  const aggregate = new Map<string, number>();
  for (let index = 0; index < resolved.debits.length; index += 1) {
    const debit = resolved.debits[index]!;
    const component = resolved.components[index]!;
    const required = (aggregate.get(debit.key) ?? 0) + debit.amount;
    aggregate.set(debit.key, required);
    if (countPlayerResource(planned, debit.key) < required) {
      return frozen({
        status: "blocked",
        reason: "materials",
        message: `Not enough ${resourceStackLabel(debit.key)} for ${component.role}.`,
      });
    }
  }

  if (!debitPlayerResources(planned, resolved.debits)) {
    throw new Error("exact craft materials changed during atomic debit");
  }
  planned.pack[resolved.recipe.output.itemId] = nextOutput;

  player.pack = planned.pack;
  player.resources = planned.resources;
  return frozen({
    status: "crafted",
    recipeId: resolved.recipe.id,
    output: resolved.recipe.output,
    components: resolved.components,
  });
}
