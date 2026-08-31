import assert from "node:assert/strict";
import test from "node:test";
import { buildResourceCatalog, RESOURCE_CATALOG, RESOURCE_IDS } from "./catalog.ts";
import { CANONICAL_STAT_IDS, MAX_LOCAL_FORTUNE, TRAIT_REGISTRY } from "./traits.ts";
import {
  defineResourceNodeIdentity,
  type GemResourceId,
  type MaterialTraitId,
  type ResourceDefinition,
  type ResourceForm,
  type ResourceId,
  type ResourceNodeIdentity,
  type ResourceSelector,
} from "./types.ts";

const EXPECTED_IDS = [
  "oak",
  "redwood",
  "iron_ore",
  "highland_ore",
  "common_cloth",
  "fine_linen",
  "ruby",
  "sapphire",
] as const satisfies readonly ResourceId[];

const GEM_IDS = ["ruby", "sapphire"] as const satisfies readonly GemResourceId[];
const TRAIT_IDS = ["accuracy", "damage", "handling", "power", "fortune"] as const satisfies readonly MaterialTraitId[];

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;

type MutableDefinition = DeepMutable<ResourceDefinition>;

function mutableDefinitions(): MutableDefinition[] {
  return structuredClone(Object.values(RESOURCE_CATALOG)) as MutableDefinition[];
}

function definition(definitions: MutableDefinition[], id: ResourceId): MutableDefinition {
  const found = definitions.find((candidate) => candidate.id === id);
  assert.ok(found, `fixture includes ${id}`);
  return found;
}

function assertDeepFrozen(value: unknown, path = "root"): void {
  if (typeof value !== "object" || value === null) return;
  assert.equal(Object.isFrozen(value), true, `${path} is frozen`);
  for (const [key, nested] of Object.entries(value)) assertDeepFrozen(nested, `${path}.${key}`);
}

function buildUnsafe(definitions: unknown): unknown {
  return buildResourceCatalog(definitions as readonly ResourceDefinition[]);
}

function assertCompileTimeContracts(): void {
  // @ts-expect-error Ruby quality is gem clarity, never a material grade.
  defineResourceNodeIdentity("bad-ruby", "ruby", "pristine");
  // @ts-expect-error Oak quality is a material grade, never gem clarity.
  defineResourceNodeIdentity("bad-oak", "oak", "flawless");
  // @ts-expect-error A ruby identity cannot carry a grade.
  const invalidRuby: ResourceNodeIdentity<"ruby"> = { nodeId: "bad", resourceId: "ruby", qualityCeiling: "pristine" };
  // @ts-expect-error Grade selectors cannot expose gem clarities.
  const invalidSelector: ResourceSelector = { qualityType: "grade", resourceIds: ["oak"], qualities: ["perfect"] };
  // @ts-expect-error A gem ID cannot be paired with a non-gem definition.
  const invalidDefinition: ResourceDefinition = {
    id: "ruby",
    label: "Invalid Ruby",
    kind: "timber",
    forms: ["log"],
    qualityType: "grade",
    traitIds: [],
    processing: [],
    visual: { family: "broadleaf", primary: "#000000", secondary: "#ffffff" },
  };
  assert.ok(invalidRuby && invalidSelector && invalidDefinition);
}

void assertCompileTimeContracts;

test("catalog has exactly eight stable IDs whose keys equal definition IDs", () => {
  assert.deepEqual(RESOURCE_IDS, EXPECTED_IDS);
  assert.deepEqual(Object.keys(RESOURCE_CATALOG), EXPECTED_IDS);
  for (const [id, resource] of Object.entries(RESOURCE_CATALOG)) assert.equal(id, resource.id);
});

test("resource quality pairs are correlated at compile time", () => {
  const oak: ResourceNodeIdentity<"oak"> = defineResourceNodeIdentity("12:34", "oak", "choice");
  const ruby: ResourceNodeIdentity<"ruby"> = defineResourceNodeIdentity("56:78", "ruby", "flawless");
  assert.equal(oak.qualityCeiling, "choice");
  assert.equal(ruby.qualityCeiling, "flawless");
});

test("resource node identity rejects incompatible pairs at runtime and is immutable", () => {
  const defineUnsafe = defineResourceNodeIdentity as (nodeId: string, resourceId: string, quality: string) => unknown;
  assert.throws(() => defineUnsafe("bad-ruby", "ruby", "pristine"), /quality pristine is incompatible with resource ruby/);
  assert.throws(() => defineUnsafe("bad-oak", "oak", "flawless"), /quality flawless is incompatible with resource oak/);
  assert.throws(() => defineUnsafe("bad-id", "bogus", "sound"), /unknown resource id: bogus/);

  const identity = defineResourceNodeIdentity("12:34", "redwood", "choice");
  assert.deepEqual(identity, { nodeId: "12:34", resourceId: "redwood", qualityCeiling: "choice" });
  assertDeepFrozen(identity);
  assert.throws(() => {
    (identity as { nodeId: string }).nodeId = "changed";
  }, TypeError);
});

test("catalog builder rejects unknown, extra, duplicate, and missing IDs", () => {
  const unknown = mutableDefinitions();
  (unknown[0] as { id: string }).id = "bogus";
  assert.throws(() => buildUnsafe(unknown), /unknown resource id: bogus/);

  const extra = mutableDefinitions();
  extra.push({ ...structuredClone(extra[0]), id: "bogus" } as unknown as MutableDefinition);
  assert.throws(() => buildUnsafe(extra), /unknown resource id: bogus/);

  const duplicate = mutableDefinitions();
  duplicate[1] = structuredClone(duplicate[0]);
  assert.throws(() => buildUnsafe(duplicate), /duplicate resource id: oak/);

  const missing = mutableDefinitions().filter((candidate) => candidate.id !== "sapphire");
  assert.throws(() => buildUnsafe(missing), /missing resource id: sapphire/);
});

test("catalog builder rejects kind, quality, and trait mismatches", () => {
  const wrongKind = mutableDefinitions();
  Object.assign(definition(wrongKind, "ruby"), { kind: "ore", qualityType: "grade", forms: ["ore"] });
  assert.throws(() => buildUnsafe(wrongKind), /resource ruby must use kind gem/);

  const wrongQuality = mutableDefinitions();
  Object.assign(definition(wrongQuality, "oak"), { qualityType: "clarity" });
  assert.throws(() => buildUnsafe(wrongQuality), /resource oak kind timber must use quality type grade/);

  const unknownTrait = mutableDefinitions();
  (definition(unknownTrait, "oak").traitIds as MaterialTraitId[]).push("bogus" as MaterialTraitId);
  assert.throws(() => buildUnsafe(unknownTrait), /unknown trait id: bogus/);

  const wrongTraitQuality = mutableDefinitions();
  (definition(wrongTraitQuality, "oak").traitIds as MaterialTraitId[]).push("power");
  assert.throws(() => buildUnsafe(wrongTraitQuality), /trait power uses clarity, not grade/);
});

test("catalog builder rejects invalid rarity, regions, tools, and skill thresholds", () => {
  const invalidWeight = mutableDefinitions();
  definition(invalidWeight, "oak").spawn!.weight = 0;
  assert.throws(() => buildUnsafe(invalidWeight), /oak spawn weight must be finite and positive/);

  const invalidRegion = mutableDefinitions();
  Object.assign(definition(invalidRegion, "oak").spawn!.regions, { moon: 1 });
  assert.throws(() => buildUnsafe(invalidRegion), /oak has unknown region: moon/);

  const invalidRegionWeight = mutableDefinitions();
  definition(invalidRegionWeight, "oak").spawn!.regions.vale = Number.NaN;
  assert.throws(() => buildUnsafe(invalidRegionWeight), /oak region vale weight must be finite and positive/);

  const invalidTool = mutableDefinitions();
  definition(invalidTool, "oak").spawn!.toolTier = 1.5;
  assert.throws(() => buildUnsafe(invalidTool), /oak tool tier must be a positive integer/);

  const unknownSkill = mutableDefinitions();
  (definition(unknownSkill, "oak").spawn!.identifySkill as { id: string }).id = "bogus";
  assert.throws(() => buildUnsafe(unknownSkill), /unknown skill id: bogus/);

  const invalidThreshold = mutableDefinitions();
  definition(invalidThreshold, "oak").spawn!.extractSkill.minimum = 101;
  assert.throws(() => buildUnsafe(invalidThreshold), /skill minimum must be an integer from 0 to 100/);

  const invertedThresholds = mutableDefinitions();
  definition(invertedThresholds, "oak").spawn!.identifySkill.minimum = 50;
  assert.throws(() => buildUnsafe(invertedThresholds), /oak extraction skill cannot be lower than identification skill/);
});

test("catalog builder rejects illegal forms and malformed processing routes", () => {
  const illegalForm = mutableDefinitions();
  (definition(illegalForm, "oak").forms as ResourceForm[]).push("gem");
  assert.throws(() => buildUnsafe(illegalForm), /form gem is illegal for timber/);

  const routeFormMismatch = mutableDefinitions();
  definition(routeFormMismatch, "oak").processing[0].output.form = "log";
  assert.throws(() => buildUnsafe(routeFormMismatch), /saw_oak must convert log to board/);

  const formNotDeclared = mutableDefinitions();
  definition(formNotDeclared, "oak").forms.splice(1, 1);
  assert.throws(() => buildUnsafe(formNotDeclared), /saw_oak output form board is not declared by oak/);

  const invalidAmount = mutableDefinitions();
  definition(invalidAmount, "oak").processing[0].input.quantity = 0;
  assert.throws(() => buildUnsafe(invalidAmount), /saw_oak input quantity must be a positive integer/);

  const fractionalAmount = mutableDefinitions();
  definition(fractionalAmount, "oak").processing[0].output.quantity = 1.5;
  assert.throws(() => buildUnsafe(fractionalAmount), /saw_oak output quantity must be a positive integer/);

  const duplicateRoute = mutableDefinitions();
  definition(duplicateRoute, "redwood").processing[0].id = "saw_oak";
  assert.throws(() => buildUnsafe(duplicateRoute), /duplicate route id: saw_oak/);

  const invalidPair = mutableDefinitions();
  definition(invalidPair, "oak").processing[0].station = "forge";
  assert.throws(() => buildUnsafe(invalidPair), /operation saw requires station bench/);
});

test("catalog builder clones and deeply freezes all nested data", () => {
  const source = mutableDefinitions();
  const built = buildResourceCatalog(source);
  assertDeepFrozen(RESOURCE_IDS);
  assertDeepFrozen(built);

  const sourceOak = definition(source, "oak");
  sourceOak.label = "Changed";
  sourceOak.forms[0] = "board";
  sourceOak.spawn!.regions.vale = 99;
  sourceOak.processing[0].input.quantity = 99;
  sourceOak.visual.primary = "#000000";

  assert.equal(built.oak.label, "Oak");
  assert.deepEqual(built.oak.forms, ["log", "board"]);
  assert.equal(built.oak.spawn?.regions.vale, 1);
  assert.equal(built.oak.processing[0].input.quantity, 1);
  assert.equal(built.oak.visual.primary, "#756044");
  assert.throws(() => {
    (built.oak.visual as { primary: string }).primary = "#ffffff";
  }, TypeError);
});

test("trait registry is exhaustive, deeply immutable, and preserves Fortune as local-only", () => {
  assert.deepEqual(Object.keys(TRAIT_REGISTRY), TRAIT_IDS);
  assert.deepEqual(CANONICAL_STAT_IDS, ["damage", "hitBonus", "armor"]);
  assert.equal(MAX_LOCAL_FORTUNE, 5);
  assertDeepFrozen(TRAIT_REGISTRY);
  assert.equal(TRAIT_REGISTRY.fortune.scope, "local");
  assert.equal(TRAIT_REGISTRY.fortune.stat, "fortune");
  assert.equal(TRAIT_REGISTRY.fortune.values.perfect, MAX_LOCAL_FORTUNE);
  assert.throws(() => {
    (TRAIT_REGISTRY.fortune.values as { perfect: number }).perfect = 99;
  }, TypeError);
});

test("existing traits, values, skills, routes, and forms remain unchanged", () => {
  assert.deepEqual(
    Object.fromEntries(Object.values(RESOURCE_CATALOG).map(({ id, traitIds }) => [id, traitIds])),
    {
      oak: [],
      redwood: ["accuracy"],
      iron_ore: [],
      highland_ore: ["damage"],
      common_cloth: [],
      fine_linen: ["handling"],
      ruby: ["power"],
      sapphire: ["fortune"],
    },
  );
  assert.deepEqual(TRAIT_REGISTRY.accuracy.values, { rough: 0.5, sound: 1, choice: 2, pristine: 3 });
  assert.deepEqual(TRAIT_REGISTRY.damage.values, { rough: 0.5, sound: 1, choice: 1.5, pristine: 2 });
  assert.deepEqual(TRAIT_REGISTRY.handling.values, { rough: 0.25, sound: 0.5, choice: 0.75, pristine: 1 });
  assert.deepEqual(TRAIT_REGISTRY.power.values, { cracked: 1, flawed: 2, cut: 3, flawless: 4, perfect: 5 });
  assert.deepEqual(TRAIT_REGISTRY.fortune.values, { cracked: 1, flawed: 2, cut: 3, flawless: 4, perfect: 5 });

  const routeIds = new Set<string>();
  const familyByForm: Record<ResourceForm, "timber" | "ore" | "fiber" | "gem"> = {
    log: "timber",
    board: "timber",
    ore: "ore",
    ingot: "ore",
    cloth: "fiber",
    gem: "gem",
  };
  for (const resource of Object.values(RESOURCE_CATALOG)) {
    assert.equal(resource.qualityType, resource.kind === "gem" ? "clarity" : "grade", resource.id);
    if (resource.spawn) {
      assert.ok(resource.spawn.extractSkill.minimum >= resource.spawn.identifySkill.minimum, resource.id);
      for (const weight of Object.values(resource.spawn.regions)) assert.ok(weight !== undefined && weight > 0, resource.id);
    }
    for (const route of resource.processing) {
      routeIds.add(route.id);
      assert.equal(familyByForm[route.input.form], familyByForm[route.output.form]);
    }
  }
  assert.deepEqual([...routeIds], ["saw_oak", "saw_redwood", "smelt_iron_ore", "smelt_highland_ore"]);
  assert.deepEqual(
    Object.fromEntries(Object.values(RESOURCE_CATALOG).map(({ id, forms }) => [id, forms])),
    {
      oak: ["log", "board"],
      redwood: ["log", "board"],
      iron_ore: ["ore", "ingot"],
      highland_ore: ["ore", "ingot"],
      common_cloth: ["cloth"],
      fine_linen: ["cloth"],
      ruby: ["gem"],
      sapphire: ["gem"],
    },
  );
  assert.deepEqual(
    Object.fromEntries(Object.values(RESOURCE_CATALOG).filter((resource) => resource.kind === "gem").map(({ id }) => [id, true])),
    Object.fromEntries(GEM_IDS.map((id) => [id, true])),
  );
});
