import { RESOURCE_CATALOG } from "../resources/catalog.ts";
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

const MATERIAL_GRADES = new Set<MaterialGrade>(["rough", "sound", "choice", "pristine"]);
const GEM_CLARITIES = new Set<GemClarity>(["cracked", "flawed", "cut", "flawless", "perfect"]);

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
  if (!isPlainRecord(value.stacks)) throw new Error("resource stacks must be a plain object");

  const stacks: ResourceInventory["stacks"] = {};
  for (const [rawKey, rawCount] of Object.entries(value.stacks)) {
    const key = parseResourceStackKey(rawKey);
    assertPositiveStackCount(rawCount);
    stacks[key] = rawCount;
  }
  return { stacks };
}

export function createResourceInventory(
  stacks: Readonly<Partial<Record<ResourceStackKey, number>>> = {},
): ResourceInventory {
  return parseResourceInventory({ stacks });
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
  if (!Number.isSafeInteger(next)) throw new Error("resource stack count exceeds safe integer range");
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
    if (!Number.isSafeInteger(total)) throw new Error("resource debit total exceeds safe integer range");
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

export function countPlayerResource(
  player: LegacyResourcePlayer,
  key: ResourceStackKey,
): number {
  const parsed = parseResourceStackKey(key);
  const typed = storedCount(player.resources, parsed);
  const legacyItem = LEGACY_ITEM_BY_STACK[parsed];
  if (!legacyItem) return typed;
  const total = typed + legacyCount(player, legacyItem);
  if (!Number.isSafeInteger(total)) throw new Error("combined resource count exceeds safe integer range");
  return total;
}

export function debitPlayerResources(
  player: LegacyResourcePlayer,
  debits: readonly ResourceDebit[],
): boolean {
  const totals = aggregateDebits(debits);
  const plan: Array<{
    key: ResourceStackKey;
    typed: number;
    legacyItem?: "log" | "ore";
    legacy: number;
  }> = [];

  for (const [key, amount] of totals) {
    const typedAvailable = storedCount(player.resources, key);
    const typed = Math.min(typedAvailable, amount);
    const legacyItem = LEGACY_ITEM_BY_STACK[key];
    const legacy = amount - typed;
    if (legacy > 0 && (!legacyItem || legacyCount(player, legacyItem) < legacy)) return false;
    plan.push({ key, typed, legacyItem, legacy });
  }

  for (const debit of plan) {
    if (debit.typed > 0) takeResource(player.resources, debit.key, debit.typed);
    if (debit.legacy > 0 && debit.legacyItem) {
      player.pack[debit.legacyItem] = legacyCount(player, debit.legacyItem) - debit.legacy;
    }
  }
  return true;
}
