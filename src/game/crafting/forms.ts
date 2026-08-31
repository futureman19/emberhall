import { FAUNA_META, ITEM_META, SKILL_META } from "../catalog.ts";
import { RESOURCE_CATALOG } from "../resources/catalog.ts";
import type {
  GemClarity,
  MaterialGrade,
  ResourceSelector,
} from "../resources/types.ts";
import type {
  GemFamily,
  ItemClass,
  ItemFormDefinition,
  ItemFormId,
  ItemFormIdentity,
  MaterialContribution,
  MaterialRole,
  RecipeRole,
  ResolvedItemStats,
} from "./types.ts";

export const MATERIAL_GRADES = Object.freeze([
  "rough",
  "sound",
  "choice",
  "pristine",
] as const satisfies readonly MaterialGrade[]);
export const GEM_CLARITIES = Object.freeze([
  "cracked",
  "flawed",
  "cut",
  "flawless",
  "perfect",
] as const satisfies readonly GemClarity[]);

const ITEM_FORM_IDS = ["bow"] as const satisfies readonly ItemFormId[];
const ITEM_CLASSES = ["weapon", "armor", "jewelry", "tool", "placeable"] as const satisfies readonly ItemClass[];
const MATERIAL_ROLES = [
  "body",
  "binding",
  "edge",
  "hilt",
  "plate",
  "lining",
  "frame",
  "finish",
] as const satisfies readonly MaterialRole[];
const MATERIAL_CONTRIBUTIONS = ["primary", "secondary", "cosmetic"] as const satisfies readonly MaterialContribution[];
const GEM_FAMILIES = ["power", "fortune"] as const satisfies readonly GemFamily[];
const GRADE_KINDS = ["timber", "ore", "fiber"] as const;
const GRADE_FORMS = ["log", "board", "ore", "ingot", "cloth"] as const;

export const ITEM_FORM_IDENTITY = Object.freeze({
  bow: Object.freeze({ baseItem: "bow", itemClass: "weapon" }),
} as const satisfies Record<ItemFormId, ItemFormIdentity>);

const FORM_FIELDS = [
  "id",
  "recipeVersion",
  "baseItem",
  "label",
  "itemClass",
  "roles",
  "baseStats",
  "caps",
  "allowedGemFamilies",
  "maxInlays",
] as const;
const ROLE_FIELDS = ["role", "amount", "accepts", "contribution"] as const;
const SELECTOR_FIELDS = ["qualityType", "resourceIds", "kinds", "forms", "qualities"] as const;
const BASE_STAT_FIELDS = ["damage", "hitBonus", "armor", "skillBonuses", "slayerMultipliers"] as const;
const CAP_FIELDS = ["damage", "hitBonus", "armor", "skillBonusPerSkill", "slayerMultiplier"] as const;

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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(record: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function includes<const Value extends string>(values: readonly Value[], value: unknown): value is Value {
  return typeof value === "string" && values.some((candidate) => candidate === value);
}

function validateFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  context: string,
): void {
  for (const field of Object.keys(value)) {
    if (!allowed.includes(field)) throw new Error(`${context} has unknown field: ${field}`);
  }
  for (const field of required) {
    if (!hasOwn(value, field)) throw new Error(`${context} is missing required field: ${field}`);
  }
}

function validateFiniteNonnegative(value: unknown, context: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${context} must be finite and nonnegative`);
  }
}

function validateSelector(value: unknown, formId: string, roleIndex: number): asserts value is ResourceSelector {
  const prefix = `item form ${formId} role ${roleIndex}`;
  if (!isPlainRecord(value)) {
    throw new Error(`${prefix} accepts must be an object with a plain prototype`);
  }
  validateFields(value, SELECTOR_FIELDS, ["qualityType"], `${prefix} selector`);
  if (value.qualityType !== "grade") {
    throw new Error(`${prefix} selector must use grade quality type`);
  }

  const checks: ReadonlyArray<readonly [string, string, (candidate: string) => boolean]> = [
    [
      "resourceIds",
      "resource id",
      (candidate) => hasOwn(RESOURCE_CATALOG, candidate) && RESOURCE_CATALOG[candidate as keyof typeof RESOURCE_CATALOG].qualityType === "grade",
    ],
    ["kinds", "kind", (candidate) => includes(GRADE_KINDS, candidate)],
    ["forms", "form", (candidate) => includes(GRADE_FORMS, candidate)],
    ["qualities", "quality", (candidate) => includes(MATERIAL_GRADES, candidate)],
  ];
  for (const [field, singular, isValid] of checks) {
    const candidate = value[field];
    if (candidate === undefined) continue;
    if (!Array.isArray(candidate)) throw new Error(`${prefix} selector ${field} must be an array`);
    if (candidate.length === 0) throw new Error(`${prefix} selector ${field} must not be empty`);
    const seen = new Set<string>();
    for (const entry of candidate as readonly unknown[]) {
      if (typeof entry !== "string" || !isValid(entry)) {
        throw new Error(`${prefix} selector has invalid ${singular}: ${String(entry)}`);
      }
      if (seen.has(entry)) throw new Error(`${prefix} selector has duplicate ${singular}: ${entry}`);
      seen.add(entry);
    }
  }

  const selector = value as unknown as Extract<ResourceSelector, { readonly qualityType: "grade" }>;
  const matchesGradeResource = Object.values(RESOURCE_CATALOG).some((definition) =>
    definition.qualityType === "grade" &&
    (selector.resourceIds === undefined || selector.resourceIds.includes(definition.id)) &&
    (selector.kinds === undefined || selector.kinds.includes(definition.kind)) &&
    (selector.forms === undefined || selector.forms.some((form) =>
      (definition.forms as readonly string[]).includes(form))) &&
    (selector.qualities === undefined || selector.qualities.some((quality) =>
      MATERIAL_GRADES.includes(quality))),
  );
  if (!matchesGradeResource) throw new Error(`${prefix} selector matches no grade resources`);
}

function validateRole(value: unknown, formId: string, index: number, seenRoles: Set<string>): asserts value is RecipeRole {
  if (!isPlainRecord(value)) {
    throw new Error(`item form ${formId} role ${index} must be an object with a plain prototype`);
  }
  validateFields(value, ROLE_FIELDS, ROLE_FIELDS, `item form ${formId} role ${index}`);
  if (!includes(MATERIAL_ROLES, value.role)) {
    throw new Error(`item form ${formId} role ${index} has invalid role: ${String(value.role)}`);
  }
  if (seenRoles.has(value.role)) throw new Error(`duplicate item form role: ${value.role}`);
  seenRoles.add(value.role);
  if (!Number.isInteger(value.amount) || (value.amount as number) <= 0) {
    throw new Error(`item form ${formId} role ${value.role} amount must be a positive integer`);
  }
  validateSelector(value.accepts, formId, index);
  if (!includes(MATERIAL_CONTRIBUTIONS, value.contribution)) {
    throw new Error(`item form ${formId} role ${value.role} has invalid contribution: ${String(value.contribution)}`);
  }
}

function validateStatMap(
  value: unknown,
  formId: string,
  mapLabel: "skill bonus" | "slayer multiplier",
  registry: object,
): void {
  if (!isPlainRecord(value)) {
    throw new Error(`item form ${formId} ${mapLabel} map must be an object with a plain prototype`);
  }
  for (const [key, amount] of Object.entries(value)) {
    if (!hasOwn(registry, key)) throw new Error(`item form ${formId} has unknown ${mapLabel} key: ${key}`);
    validateFiniteNonnegative(amount, `item form ${formId} ${mapLabel} ${key}`);
  }
}

function validateBaseStats(value: unknown, formId: string): asserts value is ResolvedItemStats {
  if (!isPlainRecord(value)) {
    throw new Error(`item form ${formId} baseStats must be an object with a plain prototype`);
  }
  validateFields(value, BASE_STAT_FIELDS, BASE_STAT_FIELDS, `item form ${formId} baseStats`);
  for (const stat of ["damage", "hitBonus", "armor"] as const) {
    validateFiniteNonnegative(value[stat], `item form ${formId} base stat ${stat}`);
  }
  validateStatMap(value.skillBonuses, formId, "skill bonus", SKILL_META);
  validateStatMap(value.slayerMultipliers, formId, "slayer multiplier", FAUNA_META);
}

function validateCaps(value: unknown, formId: string): void {
  if (!isPlainRecord(value)) {
    throw new Error(`item form ${formId} caps must be an object with a plain prototype`);
  }
  validateFields(value, CAP_FIELDS, CAP_FIELDS, `item form ${formId} caps`);
  for (const cap of CAP_FIELDS) validateFiniteNonnegative(value[cap], `item form ${formId} cap ${cap}`);
}

export function validateItemFormDefinition(value: unknown): asserts value is ItemFormDefinition {
  if (!isPlainRecord(value)) {
    throw new Error("item form definition must be an object with a plain prototype");
  }
  for (const field of FORM_FIELDS) {
    if (!hasOwn(value, field)) throw new Error(`item form definition is missing required field: ${field}`);
  }
  const rawId = value.id;
  if (!includes(ITEM_FORM_IDS, rawId)) throw new Error(`unknown item form id: ${String(rawId)}`);
  const formId = rawId;
  validateFields(value, FORM_FIELDS, FORM_FIELDS, `item form ${formId}`);
  if (!Number.isSafeInteger(value.recipeVersion) || (value.recipeVersion as number) <= 0) {
    throw new Error(`item form ${formId} recipeVersion must be a positive safe integer`);
  }
  if (typeof value.baseItem !== "string" || !hasOwn(ITEM_META, value.baseItem)) {
    throw new Error(`item form ${formId} has invalid base item: ${String(value.baseItem)}`);
  }
  if (typeof value.label !== "string" || value.label.trim().length === 0) {
    throw new Error(`item form ${formId} must have a label`);
  }
  if (!includes(ITEM_CLASSES, value.itemClass)) {
    throw new Error(`item form ${formId} has invalid item class: ${String(value.itemClass)}`);
  }
  const identity = ITEM_FORM_IDENTITY[formId];
  if (value.baseItem !== identity.baseItem) {
    throw new Error(`item form ${formId} must use base item ${identity.baseItem}`);
  }
  if (value.itemClass !== identity.itemClass) {
    throw new Error(`item form ${formId} must use item class ${identity.itemClass}`);
  }
  if (!Array.isArray(value.roles)) throw new Error(`item form ${formId} roles must be an array`);
  const seenRoles = new Set<string>();
  for (const [index, role] of (value.roles as readonly unknown[]).entries()) {
    validateRole(role, formId, index, seenRoles);
  }
  validateBaseStats(value.baseStats, formId);
  validateCaps(value.caps, formId);
  if (!Array.isArray(value.allowedGemFamilies)) {
    throw new Error(`item form ${formId} allowedGemFamilies must be an array`);
  }
  const families = value.allowedGemFamilies as readonly unknown[];
  const familySeen = new Set<string>();
  for (const family of families) {
    if (!includes(GEM_FAMILIES, family)) throw new Error(`item form ${formId} has invalid gem family: ${String(family)}`);
    if (familySeen.has(family)) throw new Error(`duplicate gem family on item form ${formId}: ${family}`);
    familySeen.add(family);
  }
  if (!Number.isInteger(value.maxInlays) || (value.maxInlays as number) < 0) {
    throw new Error(`item form ${formId} maxInlays must be a nonnegative integer`);
  }
}

export function buildItemFormCatalog(
  definitions: readonly ItemFormDefinition[],
): Readonly<Record<ItemFormId, ItemFormDefinition>> {
  if (!Array.isArray(definitions)) throw new Error("item form definitions must be an array");
  const catalog: Partial<Record<ItemFormId, ItemFormDefinition>> = {};
  for (const candidate of definitions as readonly unknown[]) {
    validateItemFormDefinition(candidate);
    const clone: unknown = structuredClone(candidate);
    validateItemFormDefinition(clone);
    if (catalog[clone.id]) throw new Error(`duplicate item form id: ${clone.id}`);
    catalog[clone.id] = deepFreeze(clone) as ItemFormDefinition;
  }
  for (const id of ITEM_FORM_IDS) {
    if (!catalog[id]) throw new Error(`missing item form id: ${id}`);
  }
  return deepFreeze(catalog) as Readonly<Record<ItemFormId, ItemFormDefinition>>;
}

const BOW_FORM_DEFINITION = {
  id: "bow",
  recipeVersion: 1,
  baseItem: "bow",
  label: "Bow",
  itemClass: "weapon",
  roles: [
    {
      role: "body",
      amount: 5,
      accepts: { qualityType: "grade", kinds: ["timber"], forms: ["log", "board"] },
      contribution: "primary",
    },
    {
      role: "binding",
      amount: 1,
      accepts: { qualityType: "grade", kinds: ["fiber"], forms: ["cloth"] },
      contribution: "secondary",
    },
  ],
  baseStats: { damage: 8, hitBonus: 0, armor: 0, skillBonuses: {}, slayerMultipliers: {} },
  caps: { damage: 15, hitBonus: 10, armor: 0, skillBonusPerSkill: 5, slayerMultiplier: 1.5 },
  allowedGemFamilies: ["power", "fortune"],
  maxInlays: 1,
} as const satisfies ItemFormDefinition;

export const ITEM_FORM_CATALOG = buildItemFormCatalog([BOW_FORM_DEFINITION]);
export const BOW_FORM: ItemFormDefinition = ITEM_FORM_CATALOG.bow;
