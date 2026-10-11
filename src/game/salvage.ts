import { addResource, makeResourceStackKey, parseResourceStackKey } from "./inventory/resources.ts";
import { effSkill } from "./player.ts";
import { RECIPES } from "./craft.ts";
import type { GemInlay } from "./crafting/types.ts";
import type { RareItem, ResourceStackKey, SkillId, World } from "./types.ts";

/**
 * Salvage contract (creator-sandbox roadmap): breaking down a crafted item
 * returns bounded fractions of its recorded material bill, and an inlay is
 * recovered only through an explicit high-skill rule. Salvage never
 * reproduces more rare material than the item contains and never duplicates
 * rare inputs — the item is destroyed in the same commit that credits the
 * recovered stacks. Loot/legacy rares carry no material bill and are not
 * salvageable. Salvage grants no skill, so craft↔salvage loops cannot farm.
 */

/** Bounded recovery fraction: half of each component stack, rounded down. */
export const SALVAGE_RETURN_DIVISOR = 2;
/** Explicit high-skill rule: inlay gems return only at this effective skill in the form's governing craft. */
export const SALVAGE_GEM_SKILL_MIN = 80;

export interface SalvageRecovery {
  readonly key: ResourceStackKey;
  readonly amount: number;
}

export type SalvageBlocked = Readonly<{
  status: "blocked";
  reason: "item" | "equipped";
  message: string;
}>;

export type SalvagePreview =
  | SalvageBlocked
  | Readonly<{
      status: "ready";
      itemUid: string;
      recovered: readonly SalvageRecovery[];
      gems: readonly GemInlay[];
      gemsRecovered: boolean;
    }>;

export type SalvageResult =
  | SalvageBlocked
  | Readonly<{
      status: "salvaged";
      item: RareItem;
      recovered: readonly SalvageRecovery[];
      gems: readonly GemInlay[];
      gemsRecovered: boolean;
    }>;

type SalvagePlan =
  | SalvageBlocked
  | {
      status: "ready";
      index: number;
      item: RareItem;
      recovered: readonly SalvageRecovery[];
      gems: readonly GemInlay[];
      gemsRecovered: boolean;
    };

function blocked(reason: "item" | "equipped", message: string): SalvageBlocked {
  return Object.freeze({ status: "blocked", reason, message });
}

/** The form's governing craft skill comes from its canonical exact recipe. */
function governingSkill(item: RareItem): SkillId | null {
  const recipe = RECIPES.find((candidate) => candidate.exactRecipeId === item.formId);
  return recipe?.skill ?? null;
}

function planSalvage(world: World, uid: string): SalvagePlan {
  const index = world.player.rares.findIndex((candidate) => candidate.uid === uid);
  const item = index >= 0 ? world.player.rares[index]! : undefined;
  if (!item) return blocked("item", "There is no such crafted item to break down.");
  if (!item.formId || !item.components || item.components.length === 0) {
    return blocked("item", "Only a material-specific crafted item breaks down into known materials.");
  }
  if (Object.values(world.player.wearRare).includes(uid)) {
    return blocked("equipped", "Unequip it first.");
  }

  const recovered: SalvageRecovery[] = [];
  for (const component of item.components) {
    const amount = Math.floor(component.amount / SALVAGE_RETURN_DIVISOR);
    if (amount > 0) {
      recovered.push({
        // Template + validator: the generic makeResourceStackKey collapses on a wide GradeResourceId union.
        key: parseResourceStackKey(`${component.resourceId}:${component.form}:${component.grade}`),
        amount,
      });
    }
  }

  const gems = structuredClone([...(item.inlays ?? [])]);
  const skill = governingSkill(item);
  const gemsRecovered = gems.length > 0 && skill !== null && effSkill(world, skill) >= SALVAGE_GEM_SKILL_MIN;

  return { status: "ready", index, item, recovered, gems, gemsRecovered };
}

/** Exact deterministic salvage preview; no inventory or item mutation. */
export function previewSalvage(world: World, uid: string): SalvagePreview {
  const plan = planSalvage(world, uid);
  if (plan.status === "blocked") return plan;
  return Object.freeze({
    status: "ready",
    itemUid: uid,
    recovered: Object.freeze(plan.recovered.map((row) => Object.freeze({ ...row }))),
    gems: Object.freeze([...plan.gems]),
    gemsRecovered: plan.gemsRecovered,
  });
}

/** Destroy one crafted item and credit its bounded recovery as a single commit. */
export function applySalvage(world: World, uid: string): SalvageResult {
  const plan = planSalvage(world, uid);
  if (plan.status === "blocked") return plan;

  world.player.rares.splice(plan.index, 1);
  for (const row of plan.recovered) {
    addResource(world.player.resources, row.key, row.amount);
  }
  if (plan.gemsRecovered) {
    for (const gem of plan.gems) {
      addResource(world.player.resources, makeResourceStackKey(gem.resourceId, "gem", gem.clarity), 1);
    }
  }
  return Object.freeze({
    status: "salvaged",
    item: plan.item,
    recovered: Object.freeze(plan.recovered),
    gems: Object.freeze(plan.gems),
    gemsRecovered: plan.gemsRecovered,
  });
}
