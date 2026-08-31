import { RESOURCE_CATALOG } from "../resources/catalog.ts";
import { MAX_LOCAL_FORTUNE, TRAIT_REGISTRY } from "../resources/traits.ts";
import type {
  GemResourceDefinition,
  ResourceDefinition,
  ResourceSelector,
} from "../resources/types.ts";
import type { FaunaKind, SkillId } from "../types.ts";
import {
  GEM_CLARITIES,
  MATERIAL_GRADES,
  validateItemFormDefinition,
} from "./forms.ts";
import type {
  CraftedComponent,
  GemFamily,
  GemInlay,
  ItemBuild,
  ItemFormDefinition,
  MaterialContribution,
  MaterialRole,
  RecipeRole,
  ResolvedItemResolution,
  ResolvedItemStats,
  StatContribution,
  Workmanship,
} from "./types.ts";

const CONTRIBUTION_SCALE: Readonly<Record<MaterialContribution, number>> = {
  primary: 1,
  secondary: 0.25,
  cosmetic: 0,
};

const WORKMANSHIP_STATS: Readonly<
  Record<Workmanship, Readonly<Partial<Pick<ResolvedItemStats, "damage" | "hitBonus" | "armor">>>>
> = {
  ordinary: {},
  fine: { hitBonus: 1 },
  exceptional: { damage: 1, hitBonus: 2 },
};

const CANONICAL_STATS = ["damage", "hitBonus", "armor"] as const;
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
const GRADE_FORMS = ["log", "board", "ore", "ingot", "cloth"] as const;
const BUILD_FIELDS = ["workmanship", "components", "inlays"] as const;
const COMPONENT_FIELDS = ["role", "resourceId", "form", "grade", "amount"] as const;
const INLAY_FIELDS = ["resourceId", "clarity"] as const;
type CanonicalStat = (typeof CANONICAL_STATS)[number];
type MutableCanonicalStats = Record<CanonicalStat, number>;

function hasOwn(record: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function includes<const Value extends string>(values: readonly Value[], value: unknown): value is Value {
  return typeof value === "string" && values.some((candidate) => candidate === value);
}

function validateFields(value: Record<string, unknown>, allowed: readonly string[], context: string): void {
  for (const field of Object.keys(value)) {
    if (!allowed.includes(field)) throw new Error(`${context} has unknown field: ${field}`);
  }
  for (const field of allowed) {
    if (!hasOwn(value, field)) throw new Error(`${context} is missing required field: ${field}`);
  }
}

function resourceDefinition(resourceId: unknown): ResourceDefinition {
  if (typeof resourceId !== "string" || !hasOwn(RESOURCE_CATALOG, resourceId)) {
    throw new Error(`unknown resource id: ${String(resourceId)}`);
  }
  return RESOURCE_CATALOG[resourceId as keyof typeof RESOURCE_CATALOG];
}

function isMaterialGrade(value: unknown): value is (typeof MATERIAL_GRADES)[number] {
  return typeof value === "string" && MATERIAL_GRADES.some((grade) => grade === value);
}

function isGemClarity(value: unknown): value is (typeof GEM_CLARITIES)[number] {
  return typeof value === "string" && GEM_CLARITIES.some((clarity) => clarity === value);
}

function validateBuild(value: unknown): asserts value is ItemBuild {
  if (!isPlainRecord(value)) throw new Error("item build must be a plain object");
  validateFields(value, BUILD_FIELDS, "item build");
  if (typeof value.workmanship !== "string" || !hasOwn(WORKMANSHIP_STATS, value.workmanship)) {
    throw new Error(`unknown workmanship: ${String(value.workmanship)}`);
  }
  if (!Array.isArray(value.components)) throw new Error("item build components must be an array");
  if (!Array.isArray(value.inlays)) throw new Error("item build inlays must be an array");
}

function validateComponent(value: unknown, index: number): asserts value is CraftedComponent {
  const prefix = `item build component ${index}`;
  if (!isPlainRecord(value)) throw new Error(`${prefix} must be a plain object`);
  validateFields(value, COMPONENT_FIELDS, prefix);
  if (!includes(MATERIAL_ROLES, value.role)) {
    throw new Error(`${prefix} has invalid role: ${String(value.role)}`);
  }
  if (typeof value.resourceId !== "string") throw new Error(`${prefix} resourceId must be a string`);
  if (!includes(GRADE_FORMS, value.form)) {
    throw new Error(`${prefix} has invalid form: ${String(value.form)}`);
  }
  if (!isMaterialGrade(value.grade)) {
    throw new Error(`${prefix} has invalid grade: ${String(value.grade)}`);
  }
  if (!Number.isInteger(value.amount) || (value.amount as number) <= 0) {
    throw new Error(`${prefix} amount must be a positive integer`);
  }

  const definition = resourceDefinition(value.resourceId);
  if (definition.qualityType !== "grade") {
    throw new Error(`resource ${value.resourceId} is not a grade-bearing material`);
  }
  if (!(definition.forms as readonly string[]).includes(value.form)) {
    throw new Error(`resource ${value.resourceId} form ${value.form} is invalid`);
  }
}

function validateInlay(value: unknown, index: number): asserts value is GemInlay {
  const prefix = `item build inlay ${index}`;
  if (!isPlainRecord(value)) throw new Error(`${prefix} must be a plain object`);
  validateFields(value, INLAY_FIELDS, prefix);
  if (typeof value.resourceId !== "string") throw new Error(`${prefix} resourceId must be a string`);
  if (!isGemClarity(value.clarity)) {
    throw new Error(`${prefix} has invalid clarity: ${String(value.clarity)}`);
  }
  const definition = resourceDefinition(value.resourceId);
  if (definition.qualityType !== "clarity") {
    throw new Error(`resource ${value.resourceId} is not a gem`);
  }
}

function selectorIncludes(values: readonly string[] | undefined, value: string): boolean {
  return values === undefined || values.includes(value);
}

function validateSelector(
  role: RecipeRole,
  component: CraftedComponent,
  definition: Extract<ResourceDefinition, { readonly qualityType: "grade" }>,
): void {
  const selector: ResourceSelector = role.accepts;
  if (selector.qualityType !== "grade") {
    throw new Error(`role ${role.role} does not accept grade resources`);
  }
  if (!selectorIncludes(selector.resourceIds, component.resourceId)) {
    throw new Error(`resource ${component.resourceId} is not accepted by role ${role.role}`);
  }
  if (!selectorIncludes(selector.kinds, definition.kind)) {
    throw new Error(
      `resource ${component.resourceId} kind ${definition.kind} is not accepted by role ${role.role}`,
    );
  }
  if (!selectorIncludes(selector.forms, component.form)) {
    throw new Error(
      `resource ${component.resourceId} form ${component.form} is not accepted by role ${role.role}`,
    );
  }
  if (!selectorIncludes(selector.qualities, component.grade)) {
    throw new Error(
      `resource ${component.resourceId} grade ${component.grade} is not accepted by role ${role.role}`,
    );
  }
}

function validateComponents(
  form: ItemFormDefinition,
  build: ItemBuild,
): ReadonlyMap<string, CraftedComponent> {
  const roles = new Map(form.roles.map((role) => [role.role, role]));
  const components = new Map<string, CraftedComponent>();

  for (const [index, candidate] of (build.components as readonly unknown[]).entries()) {
    validateComponent(candidate, index);
    const component = candidate;
    const role = roles.get(component.role);
    if (!role) throw new Error(`unexpected component role: ${String(component.role)}`);
    if (components.has(component.role)) throw new Error(`duplicate component role: ${component.role}`);
    components.set(component.role, component);
  }

  for (const role of form.roles) {
    const component = components.get(role.role);
    if (!component) throw new Error(`missing required role: ${role.role}`);
    if (component.amount !== role.amount) throw new Error(`role ${role.role} requires amount ${role.amount}`);

    const definition = RESOURCE_CATALOG[component.resourceId];
    validateSelector(role, component, definition);
  }
  return components;
}

interface ValidatedInlay {
  readonly inlay: GemInlay;
  readonly definition: GemResourceDefinition;
  readonly familyOrder: number;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateInlays(form: ItemFormDefinition, build: ItemBuild): readonly ValidatedInlay[] {
  if (build.inlays.length > form.maxInlays) {
    throw new Error(
      `form ${form.id} allows at most ${form.maxInlays} inlay${form.maxInlays === 1 ? "" : "s"}`,
    );
  }

  const seenFamilies = new Set<GemFamily>();
  const validated: ValidatedInlay[] = [];
  for (const [index, candidate] of (build.inlays as readonly unknown[]).entries()) {
    validateInlay(candidate, index);
    const inlay = candidate;
    const definition = RESOURCE_CATALOG[inlay.resourceId];
    const families = definition.traitIds as readonly GemFamily[];
    if (families.length === 0) throw new Error(`gem ${inlay.resourceId} has no gem family`);
    let familyOrder = Number.POSITIVE_INFINITY;
    for (const family of families) {
      const index = form.allowedGemFamilies.indexOf(family);
      if (index < 0) throw new Error(`gem family ${family} is not allowed by form ${form.id}`);
      if (seenFamilies.has(family)) throw new Error(`duplicate gem family: ${family}`);
      seenFamilies.add(family);
      familyOrder = Math.min(familyOrder, index);
    }
    validated.push({ inlay, definition, familyOrder });
  }
  return validated.sort(
    (left, right) =>
      left.familyOrder - right.familyOrder ||
      compareStrings(left.inlay.resourceId, right.inlay.resourceId) ||
      GEM_CLARITIES.indexOf(left.inlay.clarity) - GEM_CLARITIES.indexOf(right.inlay.clarity),
  );
}

function capped(value: number, maximum: number): number {
  return Math.min(maximum, Math.max(0, value));
}

function capMap<Key extends string>(
  values: Readonly<Partial<Record<Key, number>>>,
  maximum: number,
): Partial<Record<Key, number>> {
  const cappedValues: Partial<Record<Key, number>> = {};
  for (const key of Object.keys(values).sort() as Key[]) {
    const value = values[key];
    if (value !== undefined) cappedValues[key] = capped(value, maximum);
  }
  return cappedValues;
}

function applyCanonical(
  stats: MutableCanonicalStats,
  rawDelta: Readonly<Partial<Record<CanonicalStat, number>>>,
  form: ItemFormDefinition,
): Partial<Record<CanonicalStat, number>> {
  const applied: Partial<Record<CanonicalStat, number>> = {};
  for (const stat of CANONICAL_STATS) {
    const raw = rawDelta[stat];
    if (raw === undefined || raw === 0) continue;
    const before = stats[stat];
    const after = capped(before + raw, form.caps[stat]);
    const delta = after - before;
    stats[stat] = after;
    if (delta !== 0) applied[stat] = delta;
  }
  return applied;
}

function hasAppliedStats(stats: Readonly<Partial<Record<CanonicalStat, number>>>): boolean {
  return CANONICAL_STATS.some((stat) => stats[stat] !== undefined && stats[stat] !== 0);
}

export function resolveItemStats(
  form: ItemFormDefinition,
  build: ItemBuild,
): ResolvedItemResolution {
  validateItemFormDefinition(form);
  validateBuild(build);
  const components = validateComponents(form, build);
  const inlays = validateInlays(form, build);

  const stats: MutableCanonicalStats & {
    skillBonuses: Partial<Record<SkillId, number>>;
    slayerMultipliers: Partial<Record<FaunaKind, number>>;
  } = {
    damage: capped(form.baseStats.damage, form.caps.damage),
    hitBonus: capped(form.baseStats.hitBonus, form.caps.hitBonus),
    armor: capped(form.baseStats.armor, form.caps.armor),
    skillBonuses: capMap(form.baseStats.skillBonuses, form.caps.skillBonusPerSkill),
    slayerMultipliers: capMap(form.baseStats.slayerMultipliers, form.caps.slayerMultiplier),
  };
  let fortune = 0;
  const contributions: StatContribution[] = [];

  const workmanshipStats = applyCanonical(stats, WORKMANSHIP_STATS[build.workmanship], form);
  if (hasAppliedStats(workmanshipStats)) {
    contributions.push({
      source: "workmanship",
      sourceId: build.workmanship,
      stats: workmanshipStats,
      local: {},
    });
  }

  for (const role of form.roles) {
    const component = components.get(role.role)!;
    const definition = RESOURCE_CATALOG[component.resourceId];
    const scale = CONTRIBUTION_SCALE[role.contribution];
    for (const traitId of definition.traitIds) {
      const trait = TRAIT_REGISTRY[traitId];
      const applied = applyCanonical(stats, { [trait.stat]: trait.values[component.grade] * scale }, form);
      if (!hasAppliedStats(applied)) continue;
      contributions.push({
        source: "material",
        sourceId: component.resourceId,
        role: component.role,
        traitId,
        stats: applied,
        local: {},
      });
    }
  }

  for (const { inlay, definition } of inlays) {
    for (const traitId of definition.traitIds) {
      const trait = TRAIT_REGISTRY[traitId];
      if (trait.scope === "canonical") {
        const applied = applyCanonical(stats, { [trait.stat]: trait.values[inlay.clarity] }, form);
        if (!hasAppliedStats(applied)) continue;
        contributions.push({
          source: "gem",
          sourceId: inlay.resourceId,
          traitId,
          family: traitId,
          stats: applied,
          local: {},
        });
      } else {
        const before = fortune;
        fortune = capped(fortune + trait.values[inlay.clarity], MAX_LOCAL_FORTUNE);
        const applied = fortune - before;
        if (applied === 0) continue;
        contributions.push({
          source: "gem",
          sourceId: inlay.resourceId,
          traitId,
          family: traitId,
          stats: {},
          local: { fortune: applied },
        });
      }
    }
  }

  return {
    stats: {
      damage: stats.damage,
      hitBonus: stats.hitBonus,
      armor: stats.armor,
      skillBonuses: stats.skillBonuses,
      slayerMultipliers: stats.slayerMultipliers,
    },
    local: { fortune },
    contributions,
  };
}
