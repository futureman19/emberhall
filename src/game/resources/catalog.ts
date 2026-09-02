import { TRAIT_REGISTRY } from "./traits.ts";
import type {
  MaterialTraitId,
  ProcessingRoute,
  ResourceCatalog,
  ResourceDefinition,
  ResourceForm,
  ResourceId,
  ResourceKind,
  ResourceSpawn,
  SkillRequirement,
} from "./types.ts";
import type { BiomeId, SkillId } from "../types.ts";
import { PLACES } from "../atlas.ts";

export const RESOURCE_IDS = Object.freeze([
  "oak",
  "pine",
  "willow",
  "birch",
  "ash",
  "redwood",
  "yew",
  "ghostwood",
  "iron_ore",
  "highland_ore",
  "common_cloth",
  "fine_linen",
  "ruby",
  "sapphire",
] as const satisfies readonly ResourceId[]);

export const GHOSTWOOD_LUMBERJACK = 80;

export function timberGradeLabel(quality: string) {
  return quality === "pristine" ? "hardened" : quality;
}

const RESOURCE_DEFINITIONS = [
  {
    id: "oak",
    label: "Oak",
    kind: "timber",
    forms: ["log", "board"],
    qualityType: "grade",
    traitIds: [],
    spawn: {
      nodeKind: "tree",
      weight: 160,
      regions: { vale: 1, tundra: 0.2, taiga: 0.35, fen: 0.4, jungle: 0.3, desert: 0.06 },
      identifySkill: { id: "lumberjack", minimum: 0 },
      extractSkill: { id: "lumberjack", minimum: 0 },
      toolTier: 1,
    },
    processing: [
      {
        id: "saw_oak",
        operation: "saw",
        station: "bench",
        skill: { id: "carpentry", minimum: 0 },
        input: { form: "log", quantity: 1 },
        output: { form: "board", quantity: 2 },
      },
    ],
    visual: { family: "broadleaf", primary: "#756044", secondary: "#8b733f" },
  },
  {
    id: "pine",
    label: "Pine",
    kind: "timber",
    forms: ["log", "board"],
    qualityType: "grade",
    traitIds: [],
    spawn: {
      nodeKind: "tree",
      weight: 90,
      regions: { taiga: 1 },
      places: { wolfhollow: 1.4 },
      identifySkill: { id: "lumberjack", minimum: 0 },
      extractSkill: { id: "lumberjack", minimum: 0 },
      toolTier: 1,
    },
    processing: [
      {
        id: "saw_pine",
        operation: "saw",
        station: "bench",
        skill: { id: "carpentry", minimum: 0 },
        input: { form: "log", quantity: 1 },
        output: { form: "board", quantity: 2 },
      },
    ],
    visual: { family: "conifer", primary: "#5a4a32", secondary: "#3f5a38" },
  },
  {
    id: "willow",
    label: "Willow",
    kind: "timber",
    forms: ["log", "board"],
    qualityType: "grade",
    traitIds: [],
    spawn: {
      nodeKind: "tree",
      weight: 70,
      regions: { fen: 1 },
      places: { hearthfen: 1.4 },
      identifySkill: { id: "lumberjack", minimum: 0 },
      extractSkill: { id: "lumberjack", minimum: 0 },
      toolTier: 1,
    },
    processing: [
      {
        id: "saw_willow",
        operation: "saw",
        station: "bench",
        skill: { id: "carpentry", minimum: 5 },
        input: { form: "log", quantity: 1 },
        output: { form: "board", quantity: 2 },
      },
    ],
    visual: { family: "broadleaf", primary: "#6a5a3a", secondary: "#7a8a48" },
  },
  {
    id: "birch",
    label: "Birch",
    kind: "timber",
    forms: ["log", "board"],
    qualityType: "grade",
    traitIds: [],
    spawn: {
      nodeKind: "tree",
      weight: 28,
      regions: { tundra: 1 },
      places: { ridgewatch: 1.3 },
      identifySkill: { id: "lumberjack", minimum: 15 },
      extractSkill: { id: "lumberjack", minimum: 20 },
      toolTier: 1,
    },
    processing: [
      {
        id: "saw_birch",
        operation: "saw",
        station: "bench",
        skill: { id: "carpentry", minimum: 10 },
        input: { form: "log", quantity: 1 },
        output: { form: "board", quantity: 2 },
      },
    ],
    visual: { family: "broadleaf", primary: "#c9c3b6", secondary: "#8aaa58" },
  },
  {
    id: "ash",
    label: "Ash",
    kind: "timber",
    forms: ["log", "board"],
    qualityType: "grade",
    traitIds: [],
    spawn: {
      nodeKind: "tree",
      weight: 22,
      regions: { tundra: 0.12 },
      places: { cairnash: 1.6 },
      identifySkill: { id: "lumberjack", minimum: 25 },
      extractSkill: { id: "lumberjack", minimum: 30 },
      toolTier: 1,
    },
    processing: [
      {
        id: "saw_ash",
        operation: "saw",
        station: "bench",
        skill: { id: "carpentry", minimum: 15 },
        input: { form: "log", quantity: 1 },
        output: { form: "board", quantity: 2 },
      },
    ],
    visual: { family: "broadleaf", primary: "#8a7048", secondary: "#5a7040" },
  },
  {
    id: "redwood",
    label: "Redwood",
    kind: "timber",
    forms: ["log", "board"],
    qualityType: "grade",
    traitIds: ["accuracy"],
    spawn: {
      nodeKind: "tree",
      weight: 10,
      regions: { jungle: 1 },
      places: { southmere: 1.2 },
      identifySkill: { id: "lumberjack", minimum: 35 },
      extractSkill: { id: "lumberjack", minimum: 50 },
      toolTier: 2,
    },
    processing: [
      {
        id: "saw_redwood",
        operation: "saw",
        station: "bench",
        skill: { id: "carpentry", minimum: 25 },
        input: { form: "log", quantity: 1 },
        output: { form: "board", quantity: 2 },
      },
    ],
    visual: { family: "conifer", primary: "#6a3f32", secondary: "#984f3b" },
  },
  {
    id: "yew",
    label: "Yew",
    kind: "timber",
    forms: ["log", "board"],
    qualityType: "grade",
    traitIds: ["accuracy"],
    spawn: {
      nodeKind: "tree",
      weight: 6,
      regions: { jungle: 0.45 },
      places: { greybarrow: 1.5, cairnash: 0.8 },
      identifySkill: { id: "lumberjack", minimum: 55 },
      extractSkill: { id: "lumberjack", minimum: 65 },
      toolTier: 2,
    },
    processing: [
      {
        id: "saw_yew",
        operation: "saw",
        station: "bench",
        skill: { id: "carpentry", minimum: 40 },
        input: { form: "log", quantity: 1 },
        output: { form: "board", quantity: 2 },
      },
    ],
    visual: { family: "conifer", primary: "#3a322c", secondary: "#2a4a32" },
  },
  {
    id: "ghostwood",
    label: "Ghostwood",
    kind: "timber",
    forms: ["log", "board"],
    qualityType: "grade",
    traitIds: [],
    spawn: {
      nodeKind: "tree",
      weight: 5,
      regions: { fen: 0.15 },
      places: { greybarrow: 1.8, cairnash: 1.1 },
      identifySkill: { id: "lumberjack", minimum: 80 },
      extractSkill: { id: "lumberjack", minimum: 80 },
      toolTier: 1,
    },
    processing: [
      {
        id: "saw_ghostwood",
        operation: "saw",
        station: "bench",
        skill: { id: "carpentry", minimum: 50 },
        input: { form: "log", quantity: 1 },
        output: { form: "board", quantity: 2 },
      },
    ],
    visual: { family: "broadleaf", primary: "#b8c4c8", secondary: "#e8eef2" },
  },
  {
    id: "iron_ore",
    label: "Iron Ore",
    kind: "ore",
    forms: ["ore", "ingot"],
    qualityType: "grade",
    traitIds: [],
    spawn: {
      nodeKind: "rock",
      weight: 100,
      regions: { vale: 1, tundra: 1, taiga: 1, fen: 1, jungle: 1, desert: 1 },
      identifySkill: { id: "mining", minimum: 0 },
      extractSkill: { id: "mining", minimum: 0 },
      toolTier: 1,
    },
    processing: [
      {
        id: "smelt_iron_ore",
        operation: "smelt",
        station: "forge",
        skill: { id: "smithing", minimum: 0 },
        input: { form: "ore", quantity: 1 },
        output: { form: "ingot", quantity: 1 },
      },
    ],
    visual: { family: "stone", primary: "#64666b", secondary: "#8b8e94" },
  },
  {
    id: "highland_ore",
    label: "Highland Ore",
    kind: "ore",
    forms: ["ore", "ingot"],
    qualityType: "grade",
    traitIds: ["damage"],
    spawn: {
      nodeKind: "rock",
      weight: 10,
      regions: { tundra: 1, taiga: 0.75 },
      identifySkill: { id: "mining", minimum: 40 },
      extractSkill: { id: "mining", minimum: 55 },
      toolTier: 2,
    },
    processing: [
      {
        id: "smelt_highland_ore",
        operation: "smelt",
        station: "forge",
        skill: { id: "smithing", minimum: 35 },
        input: { form: "ore", quantity: 1 },
        output: { form: "ingot", quantity: 1 },
      },
    ],
    visual: { family: "stone", primary: "#48515b", secondary: "#71808f" },
  },
  {
    id: "common_cloth",
    label: "Common Cloth",
    kind: "fiber",
    forms: ["cloth"],
    qualityType: "grade",
    traitIds: [],
    processing: [],
    visual: { family: "cloth", primary: "#c8bda6", secondary: "#e0d7c5" },
  },
  {
    id: "fine_linen",
    label: "Fine Linen",
    kind: "fiber",
    forms: ["cloth"],
    qualityType: "grade",
    traitIds: ["handling"],
    processing: [],
    visual: { family: "cloth", primary: "#d8d1bd", secondary: "#f0ead9" },
  },
  {
    id: "ruby",
    label: "Ruby",
    kind: "gem",
    forms: ["gem"],
    qualityType: "clarity",
    traitIds: ["power"],
    spawn: {
      nodeKind: "rock",
      weight: 2,
      regions: { desert: 1, jungle: 0.5 },
      identifySkill: { id: "mining", minimum: 50 },
      extractSkill: { id: "mining", minimum: 60 },
      toolTier: 2,
    },
    processing: [],
    visual: { family: "gem", primary: "#8f2739", secondary: "#d65a6f" },
  },
  {
    id: "sapphire",
    label: "Sapphire",
    kind: "gem",
    forms: ["gem"],
    qualityType: "clarity",
    traitIds: ["fortune"],
    spawn: {
      nodeKind: "rock",
      weight: 2,
      regions: { tundra: 1, taiga: 0.5 },
      identifySkill: { id: "mining", minimum: 55 },
      extractSkill: { id: "mining", minimum: 65 },
      toolTier: 2,
    },
    processing: [],
    visual: { family: "gem", primary: "#294f83", secondary: "#5d8fc8" },
  },
] as const satisfies readonly ResourceDefinition[];

const RESOURCE_KIND_BY_ID = {
  oak: "timber",
  pine: "timber",
  willow: "timber",
  birch: "timber",
  ash: "timber",
  redwood: "timber",
  yew: "timber",
  ghostwood: "timber",
  iron_ore: "ore",
  highland_ore: "ore",
  common_cloth: "fiber",
  fine_linen: "fiber",
  ruby: "gem",
  sapphire: "gem",
} as const satisfies Record<ResourceId, ResourceKind>;

const BIOME_IDS = {
  vale: true,
  tundra: true,
  taiga: true,
  fen: true,
  jungle: true,
  desert: true,
} as const satisfies Record<BiomeId, true>;

const SKILL_IDS = {
  swords: true,
  lumberjack: true,
  mining: true,
  anatomy: true,
  healing: true,
  cooking: true,
  smithing: true,
  carpentry: true,
  taming: true,
  magery: true,
  farming: true,
  forestry: true,
  alchemy: true,
  archery: true,
  cartography: true,
  fencing: true,
  lockpicking: true,
  mace: true,
  music: true,
  poisoning: true,
  stealing: true,
  tailoring: true,
  tinkering: true,
  tracking: true,
} as const satisfies Record<SkillId, true>;

const FORMS_BY_KIND = {
  timber: ["log", "board"],
  ore: ["ore", "ingot"],
  fiber: ["cloth"],
  gem: ["gem"],
} as const satisfies Record<ResourceKind, readonly ResourceForm[]>;

const VISUAL_FAMILIES_BY_KIND = {
  timber: ["broadleaf", "conifer"],
  ore: ["stone"],
  fiber: ["cloth"],
  gem: ["gem"],
} as const;

const REQUIRED_STATION = { saw: "bench", smelt: "forge" } as const;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn<Key extends PropertyKey>(record: object, key: Key): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isResourceId(value: unknown): value is ResourceId {
  return typeof value === "string" && hasOwn(RESOURCE_KIND_BY_ID, value);
}

function isSkillId(value: unknown): value is SkillId {
  return typeof value === "string" && hasOwn(SKILL_IDS, value);
}

function isBiomeId(value: string): value is BiomeId {
  return hasOwn(BIOME_IDS, value);
}

function isTraitId(value: unknown): value is MaterialTraitId {
  return typeof value === "string" && hasOwn(TRAIT_REGISTRY, value);
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validateSkillRequirement(value: unknown): asserts value is SkillRequirement {
  if (!isRecord(value) || !isSkillId(value.id)) throw new Error(`unknown skill id: ${isRecord(value) ? String(value.id) : "undefined"}`);
  if (!Number.isInteger(value.minimum) || (value.minimum as number) < 0 || (value.minimum as number) > 100) {
    throw new Error("skill minimum must be an integer from 0 to 100");
  }
}

function validateSpawn(definition: ResourceDefinition): void {
  const spawnValue = (definition as unknown as Record<string, unknown>).spawn;
  if (spawnValue === undefined) return;
  if (!isRecord(spawnValue)) throw new Error(`${definition.id} has an invalid spawn`);
  const spawn = spawnValue as unknown as ResourceSpawn;
  if (definition.kind === "fiber") throw new Error(`${definition.id} fiber resources cannot define a spawn`);
  const expectedNodeKind = definition.kind === "timber" ? "tree" : "rock";
  if (spawn.nodeKind !== expectedNodeKind) throw new Error(`${definition.id} must spawn as ${expectedNodeKind}`);
  if (!isPositiveFinite(spawn.weight)) throw new Error(`${definition.id} spawn weight must be finite and positive`);
  if (!isRecord(spawn.regions) || Object.keys(spawn.regions).length === 0) {
    throw new Error(`${definition.id} must define at least one spawn region`);
  }
  for (const [region, weight] of Object.entries(spawn.regions)) {
    if (!isBiomeId(region)) throw new Error(`${definition.id} has unknown region: ${region}`);
    if (!isPositiveFinite(weight)) throw new Error(`${definition.id} region ${region} weight must be finite and positive`);
  }
  if (spawn.places !== undefined) {
    if (!isRecord(spawn.places) || Object.keys(spawn.places).length === 0) {
      throw new Error(`${definition.id} places must be a non-empty record when set`);
    }
    for (const [placeId, weight] of Object.entries(spawn.places)) {
      if (!PLACES.some((p) => p.id === placeId)) throw new Error(`${definition.id} has unknown place: ${placeId}`);
      if (!isPositiveFinite(weight)) throw new Error(`${definition.id} place ${placeId} weight must be finite and positive`);
    }
  }
  validateSkillRequirement(spawn.identifySkill);
  validateSkillRequirement(spawn.extractSkill);
  if (spawn.extractSkill.minimum < spawn.identifySkill.minimum) {
    throw new Error(`${definition.id} extraction skill cannot be lower than identification skill`);
  }
  if (!Number.isInteger(spawn.toolTier) || spawn.toolTier <= 0) {
    throw new Error(`${definition.id} tool tier must be a positive integer`);
  }
}

function validateQuantity(routeId: string, side: "input" | "output", value: unknown): void {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${routeId} ${side} quantity must be a positive integer`);
  }
}

function validateRoute(definition: ResourceDefinition, route: ProcessingRoute, routeIds: Set<string>): void {
  if (typeof route.id !== "string" || route.id.length === 0) throw new Error(`${definition.id} has an invalid route id`);
  if (routeIds.has(route.id)) throw new Error(`duplicate route id: ${route.id}`);
  routeIds.add(route.id);
  if (!hasOwn(REQUIRED_STATION, route.operation)) throw new Error(`${route.id} has invalid operation: ${String(route.operation)}`);
  const requiredStation = REQUIRED_STATION[route.operation];
  if (route.station !== requiredStation) throw new Error(`operation ${route.operation} requires station ${requiredStation}`);
  validateSkillRequirement(route.skill);
  if (!isRecord(route.input) || typeof route.input.form !== "string") throw new Error(`${route.id} has an invalid input`);
  if (!isRecord(route.output) || typeof route.output.form !== "string") throw new Error(`${route.id} has an invalid output`);
  if (!(definition.forms as readonly string[]).includes(route.input.form)) {
    throw new Error(`${route.id} input form ${route.input.form} is not declared by ${definition.id}`);
  }
  if (!(definition.forms as readonly string[]).includes(route.output.form)) {
    throw new Error(`${route.id} output form ${route.output.form} is not declared by ${definition.id}`);
  }
  validateQuantity(route.id, "input", route.input.quantity);
  validateQuantity(route.id, "output", route.output.quantity);
  if (route.operation === "saw" && (route.input.form !== "log" || route.output.form !== "board")) {
    throw new Error(`${route.id} must convert log to board`);
  }
  if (route.operation === "smelt" && (route.input.form !== "ore" || route.output.form !== "ingot")) {
    throw new Error(`${route.id} must convert ore to ingot`);
  }
}

function validateDefinition(definition: ResourceDefinition, routeIds: Set<string>): void {
  const expectedKind = RESOURCE_KIND_BY_ID[definition.id];
  if (definition.kind !== expectedKind) throw new Error(`resource ${definition.id} must use kind ${expectedKind}`);
  const expectedQuality = definition.kind === "gem" ? "clarity" : "grade";
  if (definition.qualityType !== expectedQuality) {
    throw new Error(`resource ${definition.id} kind ${definition.kind} must use quality type ${expectedQuality}`);
  }
  if (typeof definition.label !== "string" || definition.label.trim().length === 0) {
    throw new Error(`resource ${definition.id} must have a label`);
  }
  if (!Array.isArray(definition.forms) || definition.forms.length === 0) {
    throw new Error(`resource ${definition.id} must declare at least one form`);
  }
  const legalForms = FORMS_BY_KIND[definition.kind] as readonly string[];
  const seenForms = new Set<string>();
  for (const form of definition.forms) {
    if (!legalForms.includes(form)) throw new Error(`form ${String(form)} is illegal for ${definition.kind}`);
    if (seenForms.has(form)) throw new Error(`duplicate form ${form} on ${definition.id}`);
    seenForms.add(form);
  }
  if (!Array.isArray(definition.traitIds)) throw new Error(`resource ${definition.id} must declare trait ids`);
  const seenTraits = new Set<string>();
  for (const traitId of definition.traitIds as readonly unknown[]) {
    if (!isTraitId(traitId)) throw new Error(`unknown trait id: ${String(traitId)}`);
    if (seenTraits.has(traitId)) throw new Error(`duplicate trait id: ${traitId}`);
    seenTraits.add(traitId);
    const trait = TRAIT_REGISTRY[traitId];
    if (trait.qualityType !== definition.qualityType) {
      throw new Error(`trait ${traitId} uses ${trait.qualityType}, not ${definition.qualityType}`);
    }
  }
  validateSpawn(definition);
  if (!Array.isArray(definition.processing)) throw new Error(`resource ${definition.id} must declare processing routes`);
  for (const route of definition.processing) {
    if (!isRecord(route)) throw new Error(`${definition.id} has an invalid processing route`);
    validateRoute(definition, route as unknown as ProcessingRoute, routeIds);
  }
  if (!isRecord(definition.visual)) throw new Error(`${definition.id} must define a visual`);
  const legalFamilies = VISUAL_FAMILIES_BY_KIND[definition.kind] as readonly string[];
  if (!legalFamilies.includes(definition.visual.family)) {
    throw new Error(`visual family ${definition.visual.family} is illegal for ${definition.kind}`);
  }
  if (typeof definition.visual.primary !== "string" || typeof definition.visual.secondary !== "string") {
    throw new Error(`${definition.id} visual colors must be strings`);
  }
}

function cloneDefinition(definition: ResourceDefinition): ResourceDefinition {
  return structuredClone(definition) as ResourceDefinition;
}

export function buildResourceCatalog(
  definitions: readonly ResourceDefinition[],
): ResourceCatalog {
  if (!Array.isArray(definitions)) throw new Error("resource definitions must be an array");
  const catalog: Partial<Record<ResourceId, ResourceDefinition>> = {};
  const routeIds = new Set<string>();
  for (const candidate of definitions as readonly unknown[]) {
    if (!isRecord(candidate)) throw new Error("resource definition must be an object");
    if (!isResourceId(candidate.id)) throw new Error(`unknown resource id: ${String(candidate.id)}`);
    const id = candidate.id;
    if (catalog[id]) throw new Error(`duplicate resource id: ${id}`);
    const definition = candidate as unknown as ResourceDefinition;
    validateDefinition(definition, routeIds);
    catalog[id] = deepFreeze(cloneDefinition(definition)) as ResourceDefinition;
  }
  for (const id of RESOURCE_IDS) {
    if (!catalog[id]) throw new Error(`missing resource id: ${id}`);
  }
  return deepFreeze(catalog) as ResourceCatalog;
}

export const RESOURCE_CATALOG = buildResourceCatalog(RESOURCE_DEFINITIONS);
