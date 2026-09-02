import { RESOURCE_CATALOG, RESOURCE_IDS, timberGradeLabel } from "../resources/catalog.ts";
import type {
  GemClarity,
  MaterialGrade,
  QualityForResource,
  ResourceFormFor,
  ResourceId,
} from "../resources/types.ts";
import type { ResourceInventory, ResourceStackKey } from "../types.ts";

export interface ResourceDebit {
  readonly key: ResourceStackKey;
  readonly amount: number;
}

export interface LegacyResourcePlayer {
  resources: ResourceInventory;
  pack: Partial<Record<"log" | "ore", number>>;
}

export type GenericCraftResourceItem = "log" | "ore";

export interface ResourceInventoryRow {
  readonly key: ResourceStackKey;
  readonly label: string;
  readonly count: number;
}

const MATERIAL_GRADES = new Set<MaterialGrade>(["rough", "sound", "choice", "pristine"]);
const GEM_CLARITIES = new Set<GemClarity>(["cracked", "flawed", "cut", "flawless", "perfect"]);
const MATERIAL_GRADE_ORDER = Object.freeze(["rough", "sound", "choice", "pristine"] as const);
const GEM_CLARITY_ORDER = Object.freeze([
  "cracked",
  "flawed",
  "cut",
  "flawless",
  "perfect",
] as const);

const GENERIC_CRAFT_STACKS = Object.freeze({
  log: Object.freeze(
    MATERIAL_GRADE_ORDER.map((quality) => `oak:log:${quality}` as ResourceStackKey),
  ),
  ore: Object.freeze(
    MATERIAL_GRADE_ORDER.map((quality) => `iron_ore:ore:${quality}` as ResourceStackKey),
  ),
} as const satisfies Readonly<Record<GenericCraftResourceItem, readonly ResourceStackKey[]>>);

const LEGACY_ITEM_BY_STACK: Readonly<Partial<Record<ResourceStackKey, "log" | "ore">>> =
  Object.freeze({
    "oak:log:sound": "log",
    "iron_ore:ore:sound": "ore",
  });

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  // Canonical schema records may use the normal or null prototype only.
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPositiveSafeInteger(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("amount must be a positive safe integer");
  }
}

function assertPositiveStackCount(count: unknown): asserts count is number {
  if (!Number.isSafeInteger(count) || (count as number) <= 0) {
    throw new Error("resource stack count must be a positive safe integer");
  }
}

function validateKeyParts(resourceId: string, form: string, quality: string): ResourceStackKey {
  if (!Object.hasOwn(RESOURCE_CATALOG, resourceId)) {
    throw new Error(`unknown resource id: ${resourceId}`);
  }
  const definition = RESOURCE_CATALOG[resourceId as ResourceId];
  if (!(definition.forms as readonly string[]).includes(form)) {
    throw new Error(`form ${form} is incompatible with resource ${resourceId}`);
  }
  const qualities = definition.qualityType === "clarity" ? GEM_CLARITIES : MATERIAL_GRADES;
  if (!qualities.has(quality as never)) {
    throw new Error(`quality ${quality} is incompatible with resource ${resourceId}`);
  }
  return `${resourceId}:${form}:${quality}` as ResourceStackKey;
}

export function makeResourceStackKey<const I extends ResourceId>(
  resourceId: I,
  form: ResourceFormFor<NoInfer<I>>,
  quality: QualityForResource<NoInfer<I>>,
): Extract<ResourceStackKey, `${I}:${string}:${string}`> {
  return validateKeyParts(resourceId, form, quality) as Extract<
    ResourceStackKey,
    `${I}:${string}:${string}`
  >;
}

export function parseResourceStackKey(value: unknown): ResourceStackKey {
  if (typeof value !== "string") throw new Error("resource stack key must be a string");
  const parts = value.split(":");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new Error(`invalid resource stack key: ${value}`);
  }
  return validateKeyParts(parts[0]!, parts[1]!, parts[2]!);
}

export function parseResourceInventory(value: unknown): ResourceInventory {
  if (!isPlainRecord(value)) throw new Error("resource inventory must be a plain object");
  if (!Object.hasOwn(value, "stacks")) throw new Error("resource inventory must have own stacks");
  if (Reflect.ownKeys(value).some((key) => key !== "stacks")) {
    throw new Error("resource inventory must contain only own stacks");
  }
  const stacksDescriptor = Reflect.getOwnPropertyDescriptor(value, "stacks");
  if (!stacksDescriptor || !("value" in stacksDescriptor)) {
    throw new Error("resource inventory stacks must be an own data property");
  }
  const rawStacks = stacksDescriptor.value;
  if (!isPlainRecord(rawStacks)) throw new Error("resource stacks must be a plain object");

  const stacks: ResourceInventory["stacks"] = {};
  for (const rawKey of Reflect.ownKeys(rawStacks)) {
    if (typeof rawKey !== "string") throw new Error("resource stack keys must be strings");
    const descriptor = Reflect.getOwnPropertyDescriptor(rawStacks, rawKey);
    if (!descriptor || !("value" in descriptor)) {
      throw new Error("resource stacks must use own data properties");
    }
    const key = parseResourceStackKey(rawKey);
    assertPositiveStackCount(descriptor.value);
    stacks[key] = descriptor.value;
  }
  return { stacks };
}

export function createResourceInventory(
  stacks: Readonly<Partial<Record<ResourceStackKey, number>>> = {},
): ResourceInventory {
  return parseResourceInventory({ stacks });
}

function titleCase(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

/** Canonical, read-only Pack presentation ordered by catalog, form, then quality ladder. */
export function listResourceInventory(value: unknown): ResourceInventoryRow[] {
  const inventory = parseResourceInventory(value);
  const resourceOrder = new Map(RESOURCE_IDS.map((id, index) => [id, index]));
  return Object.entries(inventory.stacks)
    .map(([rawKey, count]) => {
      const key = parseResourceStackKey(rawKey);
      const [resourceId, form, quality] = key.split(":") as [ResourceId, string, string];
      const definition = RESOURCE_CATALOG[resourceId];
      return {
        key,
        label: `${definition.label} · ${titleCase(definition.kind === "timber" ? timberGradeLabel(quality) : quality)} ${form}`,
        count: count!,
        resourceId,
        form,
        quality,
      };
    })
    .sort((left, right) => {
      const resource = resourceOrder.get(left.resourceId)! - resourceOrder.get(right.resourceId)!;
      if (resource !== 0) return resource;
      const definition = RESOURCE_CATALOG[left.resourceId];
      const forms = definition.forms as readonly string[];
      const form = forms.indexOf(left.form) - forms.indexOf(right.form);
      if (form !== 0) return form;
      const qualities: readonly string[] =
        definition.qualityType === "clarity" ? GEM_CLARITY_ORDER : MATERIAL_GRADE_ORDER;
      return qualities.indexOf(left.quality) - qualities.indexOf(right.quality);
    })
    .map(({ key, label, count }) => ({ key, label, count }));
}

function storedCount(inventory: ResourceInventory, key: ResourceStackKey): number {
  if (!Object.hasOwn(inventory.stacks, key)) return 0;
  const count = inventory.stacks[key];
  assertPositiveStackCount(count);
  return count;
}

export function resourceCount(inventory: ResourceInventory, key: ResourceStackKey): number {
  const parsed = parseResourceStackKey(key);
  return storedCount(inventory, parsed);
}

export function addResource(
  inventory: ResourceInventory,
  key: ResourceStackKey,
  amount: number,
): number {
  const parsed = parseResourceStackKey(key);
  assertPositiveSafeInteger(amount);
  const next = storedCount(inventory, parsed) + amount;
  if (!Number.isSafeInteger(next))
    throw new Error("resource stack count exceeds safe integer range");
  inventory.stacks[parsed] = next;
  return next;
}

export function takeResource(
  inventory: ResourceInventory,
  key: ResourceStackKey,
  amount: number,
): boolean {
  const parsed = parseResourceStackKey(key);
  assertPositiveSafeInteger(amount);
  const current = storedCount(inventory, parsed);
  if (current < amount) return false;
  const next = current - amount;
  if (next === 0) delete inventory.stacks[parsed];
  else inventory.stacks[parsed] = next;
  return true;
}

function aggregateDebits(debits: readonly ResourceDebit[]): Map<ResourceStackKey, number> {
  if (!Array.isArray(debits)) throw new Error("resource debits must be an array");
  const totals = new Map<ResourceStackKey, number>();
  for (const debit of debits as readonly unknown[]) {
    if (!isPlainRecord(debit) || !Object.hasOwn(debit, "key") || !Object.hasOwn(debit, "amount")) {
      throw new Error("resource debit must have own key and amount");
    }
    if (Reflect.ownKeys(debit).some((key) => key !== "key" && key !== "amount")) {
      throw new Error("resource debit must contain only own key and amount");
    }
    const key = parseResourceStackKey(debit.key);
    const amount = debit.amount;
    if (typeof amount !== "number") throw new Error("amount must be a positive safe integer");
    assertPositiveSafeInteger(amount);
    const total = (totals.get(key) ?? 0) + amount;
    if (!Number.isSafeInteger(total))
      throw new Error("resource debit total exceeds safe integer range");
    totals.set(key, total);
  }
  return new Map([...totals].sort(([left], [right]) => left.localeCompare(right)));
}

export function debitResources(
  inventory: ResourceInventory,
  debits: readonly ResourceDebit[],
): boolean {
  const totals = aggregateDebits(debits);
  for (const [key, amount] of totals) {
    if (storedCount(inventory, key) < amount) return false;
  }
  for (const [key, amount] of totals) takeResource(inventory, key, amount);
  return true;
}

function legacyCount(player: LegacyResourcePlayer, item: "log" | "ore"): number {
  if (!Object.hasOwn(player.pack, item)) return 0;
  const count = player.pack[item];
  if (count === undefined) return 0;
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`legacy ${item} count must be a nonnegative safe integer`);
  }
  return count;
}

/**
 * Utility-recipe compatibility only: generic log means Oak log and generic ore
 * means Iron Ore ore. Legacy entries go first, then typed grades low-to-high.
 */
export function countGenericCraftResource(
  player: LegacyResourcePlayer,
  item: GenericCraftResourceItem,
): number {
  const inventory = parseResourceInventory(player.resources);
  let total = legacyCount(player, item);
  for (const key of GENERIC_CRAFT_STACKS[item]) {
    total += storedCount(inventory, key);
    if (!Number.isSafeInteger(total))
      throw new Error("combined resource count exceeds safe integer range");
  }
  return total;
}

/** Atomic generic debit using the same compatibility and priority as counting. */
export function debitGenericCraftResource(
  player: LegacyResourcePlayer,
  item: GenericCraftResourceItem,
  amount: number,
): boolean {
  assertPositiveSafeInteger(amount);
  const resources = parseResourceInventory(player.resources);
  const legacyAvailable = legacyCount(player, item);
  const legacy = Math.min(legacyAvailable, amount);
  let left = amount - legacy;
  for (const key of GENERIC_CRAFT_STACKS[item]) {
    if (left <= 0) break;
    const take = Math.min(storedCount(resources, key), left);
    if (take > 0) takeResource(resources, key, take);
    left -= take;
  }
  if (left > 0) return false;
  player.pack[item] = legacyAvailable - legacy;
  player.resources = resources;
  return true;
}

export function countPlayerResource(player: LegacyResourcePlayer, key: ResourceStackKey): number {
  const parsed = parseResourceStackKey(key);
  const resources = parseResourceInventory(player.resources);
  const typed = storedCount(resources, parsed);
  const legacyItem = LEGACY_ITEM_BY_STACK[parsed];
  if (!legacyItem) return typed;
  const total = typed + legacyCount(player, legacyItem);
  if (!Number.isSafeInteger(total))
    throw new Error("combined resource count exceeds safe integer range");
  return total;
}

export function debitPlayerResources(
  player: LegacyResourcePlayer,
  debits: readonly ResourceDebit[],
): boolean {
  const totals = aggregateDebits(debits);
  const resources = parseResourceInventory(player.resources);
  const plan: Array<{
    key: ResourceStackKey;
    typed: number;
    legacyItem?: "log" | "ore";
    legacy: number;
  }> = [];

  for (const [key, amount] of totals) {
    const legacyItem = LEGACY_ITEM_BY_STACK[key];
    const legacyAvailable = legacyItem ? legacyCount(player, legacyItem) : 0;
    const legacy = Math.min(legacyAvailable, amount);
    const typed = amount - legacy;
    if (storedCount(resources, key) < typed) return false;
    plan.push({ key, typed, legacyItem, legacy });
  }

  for (const debit of plan) {
    if (debit.typed > 0) takeResource(resources, debit.key, debit.typed);
    if (debit.legacy > 0 && debit.legacyItem) {
      player.pack[debit.legacyItem] = legacyCount(player, debit.legacyItem) - debit.legacy;
    }
  }
  player.resources = resources;
  return true;
}
