import { ITEM_FORM_CATALOG } from "./forms.ts";
import type { CraftedComponent, ItemFormId, MaterialRole, RecipeRole } from "./types.ts";
import { RESOURCE_CATALOG } from "../resources/catalog.ts";
import type {
  GradeResourceForm,
  GradeResourceId,
  MaterialGrade,
  ResourceId,
  ResourceSelector,
} from "../resources/types.ts";
import {
  parseResourceStackKey,
  type ResourceDebit,
} from "../inventory/resources.ts";
import type { ItemId, ResourceStackKey } from "../types.ts";

export type ExactRecipeId = "bow";

export interface ExactRecipeOutput {
  readonly itemId: ItemId;
  readonly quantity: number;
}

export interface ExactRecipeDefinition {
  readonly id: ExactRecipeId;
  readonly formId: ItemFormId;
  readonly output: ExactRecipeOutput;
}

export interface ExactMaterialSelection {
  readonly role: MaterialRole;
  readonly key: ResourceStackKey;
}

export interface ResolvedExactRecipeSelection {
  readonly recipe: ExactRecipeDefinition;
  readonly components: readonly CraftedComponent[];
  readonly debits: readonly ResourceDebit[];
}

const EXACT_RECIPE_IDS = ["bow"] as const satisfies readonly ExactRecipeId[];
const SELECTION_FIELDS = ["role", "key"] as const;

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

function snapshotSelection(input: unknown): ExactMaterialSelection {
  const fail = (): never => {
    throw new Error("material selection must contain exactly own data fields: role, key");
  };
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return fail();
  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== SELECTION_FIELDS.length
    || keys.some((key) => typeof key !== "string" || !(SELECTION_FIELDS as readonly string[]).includes(key))
  ) {
    return fail();
  }

  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const field of SELECTION_FIELDS) {
    const descriptor = Reflect.getOwnPropertyDescriptor(input, field);
    if (!descriptor || !("value" in descriptor)) return fail();
    snapshot[field] = descriptor.value;
  }
  if (typeof snapshot.role !== "string") throw new Error("material selection role must be a string");
  const key = parseResourceStackKey(snapshot.key);
  return Object.freeze({ role: snapshot.role, key }) as ExactMaterialSelection;
}

const EXACT_RECIPE_DEFINITIONS = [
  {
    id: "bow",
    formId: "bow",
    output: { itemId: "bow", quantity: 1 },
  },
] as const satisfies readonly ExactRecipeDefinition[];

function buildExactRecipeCatalog(
  definitions: readonly ExactRecipeDefinition[],
): Readonly<Record<ExactRecipeId, ExactRecipeDefinition>> {
  const catalog: Partial<Record<ExactRecipeId, ExactRecipeDefinition>> = {};
  for (const definition of definitions) {
    if (!EXACT_RECIPE_IDS.includes(definition.id)) throw new Error(`unknown exact recipe id: ${definition.id}`);
    if (catalog[definition.id]) throw new Error(`duplicate exact recipe id: ${definition.id}`);
    const form = ITEM_FORM_CATALOG[definition.formId];
    if (!form) throw new Error(`unknown item form for exact recipe ${definition.id}: ${definition.formId}`);
    if (definition.output.itemId !== form.baseItem) {
      throw new Error(`exact recipe ${definition.id} output must match form base item ${form.baseItem}`);
    }
    if (!Number.isSafeInteger(definition.output.quantity) || definition.output.quantity <= 0) {
      throw new Error(`exact recipe ${definition.id} output quantity must be a positive safe integer`);
    }
    catalog[definition.id] = deepFreeze(structuredClone(definition)) as ExactRecipeDefinition;
  }
  for (const id of EXACT_RECIPE_IDS) {
    if (!catalog[id]) throw new Error(`missing exact recipe id: ${id}`);
  }
  return deepFreeze(catalog) as Readonly<Record<ExactRecipeId, ExactRecipeDefinition>>;
}

export const EXACT_RECIPE_CATALOG = buildExactRecipeCatalog(EXACT_RECIPE_DEFINITIONS);

export function exactRecipeById(id: string): ExactRecipeDefinition | null {
  return Object.hasOwn(EXACT_RECIPE_CATALOG, id)
    ? EXACT_RECIPE_CATALOG[id as ExactRecipeId]
    : null;
}

function selectorIncludes(selector: readonly string[] | undefined, candidate: string): boolean {
  return selector === undefined || selector.includes(candidate);
}

/** Exact stack compatibility is derived from the canonical item-form role selector. */
export function resourceStackMatchesRole(role: RecipeRole, rawKey: ResourceStackKey): boolean {
  const key = parseResourceStackKey(rawKey);
  const [resourceId, form, quality] = key.split(":") as [ResourceId, string, string];
  const definition = RESOURCE_CATALOG[resourceId];
  const selector: ResourceSelector = role.accepts;
  if (definition.qualityType !== "grade" || selector.qualityType !== "grade") return false;
  return selectorIncludes(selector.resourceIds as readonly string[] | undefined, resourceId)
    && selectorIncludes(selector.kinds as readonly string[] | undefined, definition.kind)
    && selectorIncludes(selector.forms as readonly string[] | undefined, form)
    && selectorIncludes(selector.qualities as readonly string[] | undefined, quality);
}

function stackParts(key: ResourceStackKey): {
  resourceId: GradeResourceId;
  form: GradeResourceForm;
  grade: MaterialGrade;
} {
  const [resourceId, form, grade] = key.split(":") as [GradeResourceId, GradeResourceForm, MaterialGrade];
  return { resourceId, form, grade };
}

export function resourceStackLabel(rawKey: ResourceStackKey): string {
  const key = parseResourceStackKey(rawKey);
  const [resourceId, form, quality] = key.split(":") as [ResourceId, string, string];
  const titleQuality = `${quality[0]!.toUpperCase()}${quality.slice(1)}`;
  return `${RESOURCE_CATALOG[resourceId].label} · ${titleQuality} ${form}`;
}

/**
 * Resolve one and only one exact stack for every semantic form role. Selection
 * order is irrelevant; output order always follows the canonical form.
 */
export function resolveExactRecipeSelection(
  recipeId: string,
  selections: readonly ExactMaterialSelection[],
): ResolvedExactRecipeSelection {
  const recipe = exactRecipeById(recipeId);
  if (!recipe) throw new Error(`unknown exact recipe id: ${recipeId}`);
  if (!Array.isArray(selections)) throw new Error("material selections must be an array");
  const form = ITEM_FORM_CATALOG[recipe.formId];
  const roleById = new Map(form.roles.map((role) => [role.role, role]));
  const selected = new Map<MaterialRole, ExactMaterialSelection>();

  for (const candidate of selections as readonly unknown[]) {
    const selection = snapshotSelection(candidate);
    const role = roleById.get(selection.role);
    if (!role) throw new Error(`unknown role ${selection.role} for exact recipe ${recipe.id}`);
    if (selected.has(selection.role)) throw new Error(`multiple material stacks for role ${selection.role}`);
    if (!resourceStackMatchesRole(role, selection.key)) {
      throw new Error(`${selection.key} is incompatible with role ${selection.role}`);
    }
    selected.set(selection.role, selection);
  }

  const components: CraftedComponent[] = [];
  const debits: ResourceDebit[] = [];
  for (const role of form.roles) {
    const selection = selected.get(role.role);
    if (!selection) throw new Error(`missing selection for role ${role.role}`);
    const { resourceId, form: resourceForm, grade } = stackParts(selection.key);
    components.push({ role: role.role, resourceId, form: resourceForm, grade, amount: role.amount });
    debits.push({ key: selection.key, amount: role.amount });
  }

  return deepFreeze({ recipe, components, debits }) as ResolvedExactRecipeSelection;
}
