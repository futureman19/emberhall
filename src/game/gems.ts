import { RESOURCE_CATALOG } from "./resources/catalog.ts";
import { GEM_CLARITIES } from "./crafting/forms.ts";
import { TRAIT_REGISTRY } from "./resources/traits.ts";
import type { GemClarity, GemResourceId } from "./resources/types.ts";
import type { GemFamily } from "./crafting/types.ts";

export interface GemEffect {
  readonly resourceId: GemResourceId;
  readonly family: GemFamily;
  readonly clarity: GemClarity;
  readonly rank: 1 | 2 | 3 | 4 | 5;
  readonly label: string;
  readonly scope: "canonical" | "local";
  readonly stat: "damage" | "fortune";
  readonly amount: number;
}

const ROMAN = ["I", "II", "III", "IV", "V"] as const;

/** One deterministic effect per current gem family and clarity. */
export function gemEffect(resourceId: GemResourceId, clarity: GemClarity): GemEffect {
  const definition = RESOURCE_CATALOG[resourceId];
  if (definition.qualityType !== "clarity") throw new Error(`${resourceId} is not a gem`);
  const clarityIndex = GEM_CLARITIES.indexOf(clarity);
  if (clarityIndex < 0) throw new Error(`unknown gem clarity: ${clarity}`);
  const family = definition.traitIds[0];
  if (family !== "power" && family !== "fortune") throw new Error(`${resourceId} has no deterministic gem family`);
  const trait = TRAIT_REGISTRY[family];
  const effect = {
    resourceId,
    family,
    clarity,
    rank: (clarityIndex + 1) as GemEffect["rank"],
    label: `${family[0]!.toUpperCase()}${family.slice(1)} ${ROMAN[clarityIndex]}`,
    scope: trait.scope,
    stat: trait.stat,
    amount: trait.values[clarity],
  } as const;
  return Object.freeze(effect);
}
