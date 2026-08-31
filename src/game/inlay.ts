import { ITEM_FORM_CATALOG } from "./crafting/forms.ts";
import { resolveItemStats } from "./crafting/resolve.ts";
import type { GemInlay, LocalDerivedItemStats, ResolvedItemStats } from "./crafting/types.ts";
import { gemEffect, type GemEffect } from "./gems.ts";
import {
  debitResources,
  parseResourceInventory,
  parseResourceStackKey,
  resourceCount,
} from "./inventory/resources.ts";
import { RESOURCE_CATALOG } from "./resources/catalog.ts";
import type { GemClarity, GemResourceId } from "./resources/types.ts";
import type { PlayerState, RareItem, ResourceStackKey } from "./types.ts";

export type InlayPlayer = Pick<PlayerState, "resources" | "rares">;

export type InlayPreview =
  | Readonly<{ status: "blocked"; reason: "item" | "slot" | "family" | "materials"; message: string }>
  | Readonly<{
      status: "ready";
      itemUid: string;
      key: ResourceStackKey;
      effect: GemEffect;
      inlays: readonly GemInlay[];
      stats: ResolvedItemStats;
      local: LocalDerivedItemStats;
    }>;

export type InlayResult =
  | Exclude<InlayPreview, { status: "ready" }>
  | Readonly<{ status: "inlaid"; item: RareItem; effect: GemEffect; local: LocalDerivedItemStats }>;

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value as DeepReadonly<T>;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value) as DeepReadonly<T>;
}

function blocked(reason: "item" | "slot" | "family" | "materials", message: string): InlayPreview {
  return Object.freeze({ status: "blocked", reason, message });
}

function gemFromKey(rawKey: ResourceStackKey): {
  key: ResourceStackKey;
  resourceId: GemResourceId;
  clarity: GemClarity;
} {
  const key = parseResourceStackKey(rawKey);
  const [resourceId, form, clarity] = key.split(":");
  const definition = RESOURCE_CATALOG[resourceId as keyof typeof RESOURCE_CATALOG];
  if (!definition || definition.qualityType !== "clarity" || form !== "gem") {
    throw new Error(`${key} is not an inlay gem stack`);
  }
  return { key, resourceId: resourceId as GemResourceId, clarity: clarity as GemClarity };
}

/** Exact deterministic inlay preview; no inventory or item mutation. */
export function previewItemInlay(player: InlayPlayer, itemUid: string, rawKey: ResourceStackKey): InlayPreview {
  const { key, resourceId, clarity } = gemFromKey(rawKey);
  const item = player.rares.find(({ uid }) => uid === itemUid);
  if (!item || !item.formId || !item.workmanship || !item.components || !item.inlays) {
    return blocked("item", "Only a material-specific crafted item can take an inlay.");
  }
  const form = ITEM_FORM_CATALOG[item.formId];
  if (!form) return blocked("item", "This crafted form is unknown.");

  const effect = gemEffect(resourceId, clarity);
  if (!form.allowedGemFamilies.includes(effect.family)) {
    return blocked("family", `${effect.label} is incompatible with ${form.label}.`);
  }
  for (const existing of item.inlays) {
    if (gemEffect(existing.resourceId, existing.clarity).family === effect.family) {
      return blocked("family", `${form.label} already carries ${effect.family}.`);
    }
  }
  if (item.inlays.length >= form.maxInlays) {
    return blocked("slot", `${form.label} has no open inlay slot.`);
  }
  if (resourceCount(player.resources, key) < 1) {
    return blocked("materials", `You do not carry ${RESOURCE_CATALOG[resourceId].label} of ${clarity} clarity.`);
  }

  const inlays = [...item.inlays, { resourceId, clarity } satisfies GemInlay];
  const resolution = resolveItemStats(form, {
    workmanship: item.workmanship,
    components: item.components,
    inlays,
  });
  return deepFreeze({
    status: "ready",
    itemUid,
    key,
    effect,
    inlays,
    stats: resolution.stats,
    local: resolution.local,
  }) as InlayPreview;
}

/** Consume one selected gem and replace one crafted item as a single commit. */
export function applyItemInlay(player: InlayPlayer, itemUid: string, rawKey: ResourceStackKey): InlayResult {
  const preview = previewItemInlay(player, itemUid, rawKey);
  if (preview.status === "blocked") return preview;
  const index = player.rares.findIndex(({ uid }) => uid === itemUid);
  if (index < 0) throw new Error("inlay target changed after preview");

  const resources = parseResourceInventory(player.resources);
  if (!debitResources(resources, [{ key: preview.key, amount: 1 }])) {
    throw new Error("inlay gem changed after preview");
  }
  const item = structuredClone(player.rares[index]!);
  item.inlays = structuredClone([...preview.inlays]);
  item.resolvedStats = structuredClone(preview.stats);
  const rares = [...player.rares];
  rares[index] = item;

  player.resources = resources;
  player.rares = rares;
  return deepFreeze({ status: "inlaid", item, effect: preview.effect, local: preview.local }) as InlayResult;
}
