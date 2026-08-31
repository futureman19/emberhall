import { ITEM_META, SKILL_META } from "../catalog.ts";
import { makeResourceStackKey } from "../inventory/resources.ts";
import type { ItemId, ResourceStackKey } from "../types.ts";
import { RESOURCE_CATALOG } from "./catalog.ts";
import { resolveResourceNode, type ResourceNodeKind } from "./nodes.ts";
import type {
  GemClarity,
  GemResourceId,
  MaterialGrade,
  MaterialQuality,
  QualityForResource,
  ResourceId,
  ResourceNodeIdentity,
} from "./types.ts";

export interface HarvestSkillBand<Q extends MaterialQuality> {
  readonly minimum: number;
  readonly quality: Q;
}

/** Material recovery is skill-capped at these documented thresholds. */
export const MATERIAL_HARVEST_SKILL_BANDS = Object.freeze([
  Object.freeze({ minimum: 0, quality: "rough" }),
  Object.freeze({ minimum: 25, quality: "sound" }),
  Object.freeze({ minimum: 50, quality: "choice" }),
  Object.freeze({ minimum: 75, quality: "pristine" }),
] as const satisfies readonly HarvestSkillBand<MaterialGrade>[]);

/** Gem recovery adds a mastery-only perfect-clarity band. */
export const GEM_HARVEST_SKILL_BANDS = Object.freeze([
  Object.freeze({ minimum: 0, quality: "cracked" }),
  Object.freeze({ minimum: 25, quality: "flawed" }),
  Object.freeze({ minimum: 50, quality: "cut" }),
  Object.freeze({ minimum: 75, quality: "flawless" }),
  Object.freeze({ minimum: 100, quality: "perfect" }),
] as const satisfies readonly HarvestSkillBand<GemClarity>[]);

/**
 * Harvesting tools have a small, explicit policy. Blades remain valid for
 * ordinary timber, only a hatchet reaches rare timber tier two, and the
 * existing pick reaches both current rock tiers.
 */
export const HARVEST_TOOL_POLICY = Object.freeze({
  tree: Object.freeze({ hatchet: 2, knife: 1, sword: 1 }),
  rock: Object.freeze({ pick: 2 }),
} as const satisfies Readonly<Record<ResourceNodeKind, Readonly<Partial<Record<ItemId, number>>>>>);

export const UNKNOWN_RESOURCE_MESSAGE = "You cannot identify this resource node.";

export interface HarvestIdentificationInput {
  readonly seed: number;
  readonly tx: number;
  readonly ty: number;
  readonly nodeKind: ResourceNodeKind;
  readonly effectiveSkill: number;
}

export interface HarvestAssessmentInput extends HarvestIdentificationInput {
  readonly toolTier: number;
}

export interface HarvestToolInput {
  readonly nodeKind: ResourceNodeKind;
  readonly tool: ItemId | null;
}

export interface HarvestToolTierInput {
  readonly availableTier: number;
  readonly requiredTier: number;
}

export type HarvestIdentification =
  | Readonly<{ status: "unknown"; message: typeof UNKNOWN_RESOURCE_MESSAGE }>
  | Readonly<{
      status: "identified";
      identity: ResourceNodeIdentity;
      label: string;
    }>;

type HarvestResourceId = Exclude<ResourceId, "common_cloth" | "fine_linen">;
type HarvestFormFor<I extends HarvestResourceId> = I extends "oak" | "redwood"
  ? "log"
  : I extends "iron_ore" | "highland_ore"
    ? "ore"
    : "gem";
type HarvestYieldFor<I extends HarvestResourceId> = {
  [Q in QualityForResource<I>]: Readonly<{
    key: Extract<ResourceStackKey, `${I}:${HarvestFormFor<I>}:${Q}`>;
    resourceId: I;
    form: HarvestFormFor<I>;
    quality: Q;
    quantity: 1 | 2;
  }>;
}[QualityForResource<I>];

/** Correlated resource, form, quality, and canonical stack key. */
export type HarvestYield = {
  [I in HarvestResourceId]: HarvestYieldFor<I>;
}[HarvestResourceId];

export type HarvestAssessment =
  | Readonly<{ status: "unknown"; message: typeof UNKNOWN_RESOURCE_MESSAGE }>
  | Readonly<{
      status: "blocked";
      reason: "skill" | "tool";
      identity: ResourceNodeIdentity;
      message: string;
    }>
  | Readonly<{
      status: "ready";
      identity: ResourceNodeIdentity;
      yield: Readonly<HarvestYield>;
      message: string;
    }>;

const IDENTIFICATION_FIELDS = ["seed", "tx", "ty", "nodeKind", "effectiveSkill"] as const;
const ASSESSMENT_FIELDS = [...IDENTIFICATION_FIELDS, "toolTier"] as const;
const TOOL_FIELDS = ["nodeKind", "tool"] as const;
const TOOL_TIER_FIELDS = ["availableTier", "requiredTier"] as const;

function failInput(fields: readonly string[]): never {
  throw new Error(`harvest input must be a plain object with exactly own data fields: ${fields.join(", ")}`);
}

function snapshotOwnDataFields<const Fields extends readonly string[]>(
  input: unknown,
  fields: Fields,
): Readonly<Record<Fields[number], unknown>> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return failInput(fields);
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return failInput(fields);
  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.length !== fields.length || ownKeys.some((key) => typeof key !== "string" || !fields.includes(key))) {
    return failInput(fields);
  }
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const field of fields) {
    const descriptor = Reflect.getOwnPropertyDescriptor(input, field);
    if (descriptor === undefined || !("value" in descriptor)) return failInput(fields);
    snapshot[field] = descriptor.value;
  }
  return Object.freeze(snapshot) as Readonly<Record<Fields[number], unknown>>;
}

function validateEffectiveSkill(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 200) {
    throw new Error("effectiveSkill must be finite from 0 to 200");
  }
}

function validateTier(name: "toolTier" | "availableTier" | "requiredTier", value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 100) {
    throw new Error(`${name} must be a safe integer from 0 to 100`);
  }
}

function validateNodeKind(value: unknown): asserts value is ResourceNodeKind {
  if (value !== "tree" && value !== "rock") throw new Error("nodeKind must be tree or rock");
}

interface ParsedIdentificationInput {
  readonly effectiveSkill: number;
  readonly identity: ResourceNodeIdentity;
}

interface ParsedAssessmentInput extends ParsedIdentificationInput {
  readonly toolTier: number;
}

function parseIdentificationInput(input: unknown): ParsedIdentificationInput {
  const snapshot = snapshotOwnDataFields(input, IDENTIFICATION_FIELDS);
  validateEffectiveSkill(snapshot.effectiveSkill);
  // Task 5 remains the sole validator/resolver for seed, coordinate, kind,
  // family, and node-owned quality. No harvest-local identity roll exists.
  const resolution = resolveResourceNode({
    seed: snapshot.seed as number,
    tx: snapshot.tx as number,
    ty: snapshot.ty as number,
    nodeKind: snapshot.nodeKind as ResourceNodeKind,
  });
  return Object.freeze({
    effectiveSkill: snapshot.effectiveSkill,
    identity: resolution.identity,
  });
}

function parseAssessmentInput(input: unknown): ParsedAssessmentInput {
  const snapshot = snapshotOwnDataFields(input, ASSESSMENT_FIELDS);
  validateEffectiveSkill(snapshot.effectiveSkill);
  validateTier("toolTier", snapshot.toolTier);
  const resolution = resolveResourceNode({
    seed: snapshot.seed as number,
    tx: snapshot.tx as number,
    ty: snapshot.ty as number,
    nodeKind: snapshot.nodeKind as ResourceNodeKind,
  });
  return Object.freeze({
    effectiveSkill: snapshot.effectiveSkill,
    toolTier: snapshot.toolTier,
    identity: resolution.identity,
  });
}

function titleCase(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

function identifiedLabel(identity: ResourceNodeIdentity): string {
  return `${titleCase(identity.qualityCeiling)} ${RESOURCE_CATALOG[identity.resourceId].label}`;
}

function identifiedFromSnapshot(input: ParsedIdentificationInput): HarvestIdentification {
  const { identity } = input;
  const spawn = RESOURCE_CATALOG[identity.resourceId].spawn!;
  if (input.effectiveSkill < spawn.identifySkill.minimum) {
    return Object.freeze({ status: "unknown", message: UNKNOWN_RESOURCE_MESSAGE });
  }
  return Object.freeze({ status: "identified", identity, label: identifiedLabel(identity) });
}

/** Identify a stable node without exposing any family or band below threshold. */
export function identifyHarvestNode(input: HarvestIdentificationInput): HarvestIdentification {
  return identifiedFromSnapshot(parseIdentificationInput(input));
}

function qualityFromSkill(identity: ResourceNodeIdentity, effectiveSkill: number): MaterialQuality {
  const definition = RESOURCE_CATALOG[identity.resourceId];
  if (definition.qualityType === "clarity") {
    const skillQuality = [...GEM_HARVEST_SKILL_BANDS].reverse().find(({ minimum }) => effectiveSkill >= minimum)!.quality;
    const ceilingIndex = GEM_HARVEST_SKILL_BANDS.findIndex(({ quality }) => quality === identity.qualityCeiling);
    const skillIndex = GEM_HARVEST_SKILL_BANDS.findIndex(({ quality }) => quality === skillQuality);
    return GEM_HARVEST_SKILL_BANDS[Math.min(ceilingIndex, skillIndex)]!.quality;
  }
  const skillQuality = [...MATERIAL_HARVEST_SKILL_BANDS].reverse().find(({ minimum }) => effectiveSkill >= minimum)!.quality;
  const ceilingIndex = MATERIAL_HARVEST_SKILL_BANDS.findIndex(({ quality }) => quality === identity.qualityCeiling);
  const skillIndex = MATERIAL_HARVEST_SKILL_BANDS.findIndex(({ quality }) => quality === skillQuality);
  return MATERIAL_HARVEST_SKILL_BANDS[Math.min(ceilingIndex, skillIndex)]!.quality;
}

function yieldFor(identity: ResourceNodeIdentity, effectiveSkill: number): HarvestYield {
  const definition = RESOURCE_CATALOG[identity.resourceId];
  const quality = qualityFromSkill(identity, effectiveSkill);
  const quantity = effectiveSkill >= 100 ? 2 : 1;
  if (definition.kind === "timber") {
    const resourceId = identity.resourceId as "oak" | "redwood";
    const key = makeResourceStackKey(resourceId, "log", quality as MaterialGrade);
    return Object.freeze({ key, resourceId, form: "log", quality, quantity }) as HarvestYield;
  }
  if (definition.kind === "ore") {
    const resourceId = identity.resourceId as "iron_ore" | "highland_ore";
    const key = makeResourceStackKey(resourceId, "ore", quality as MaterialGrade);
    return Object.freeze({ key, resourceId, form: "ore", quality, quantity }) as HarvestYield;
  }
  const resourceId = identity.resourceId as GemResourceId;
  const key = makeResourceStackKey(resourceId, "gem", quality as GemClarity);
  return Object.freeze({ key, resourceId, form: "gem", quality, quantity }) as HarvestYield;
}

function pluralResourceNoun(yielded: HarvestYield): string {
  const definition = RESOURCE_CATALOG[yielded.resourceId];
  const label = definition.label.toLowerCase();
  if (definition.kind === "timber") return `${label} logs`;
  if (definition.kind === "gem") return label.endsWith("y") ? `${label.slice(0, -1)}ies` : `${label}s`;
  return label;
}

function singularResourceNoun(yielded: HarvestYield): string {
  const definition = RESOURCE_CATALOG[yielded.resourceId];
  const label = definition.label.toLowerCase();
  return definition.kind === "timber" ? `${label} log` : label;
}

function formatHarvestSuccess(yielded: HarvestYield): string {
  if (yielded.quantity === 1) return `Recovered a ${yielded.quality} ${singularResourceNoun(yielded)}.`;
  return `Recovered ${yielded.quantity} ${yielded.quality} ${pluralResourceNoun(yielded)}.`;
}

/** Pure numeric gate used independently of item/catalog integration. */
export function meetsHarvestToolTier(input: HarvestToolTierInput): boolean {
  const snapshot = snapshotOwnDataFields(input, TOOL_TIER_FIELDS);
  validateTier("availableTier", snapshot.availableTier);
  validateTier("requiredTier", snapshot.requiredTier);
  return snapshot.availableTier >= snapshot.requiredTier;
}

/** Resolve current equipment through the immutable harvesting tool policy. */
export function harvestToolTier(input: HarvestToolInput): number {
  const snapshot = snapshotOwnDataFields(input, TOOL_FIELDS);
  validateNodeKind(snapshot.nodeKind);
  if (snapshot.tool !== null && (typeof snapshot.tool !== "string" || !Object.hasOwn(ITEM_META, snapshot.tool))) {
    throw new Error("unknown harvest tool");
  }
  if (snapshot.tool === null) return 0;
  const policy = HARVEST_TOOL_POLICY[snapshot.nodeKind];
  return Object.hasOwn(policy, snapshot.tool) ? policy[snapshot.tool as keyof typeof policy] : 0;
}

/**
 * Resolve all permanent gates before chance or mutation. Ready results contain
 * one canonical typed stack; mastery (effective skill >= 100) yields exactly
 * two, and every lower skill yields one.
 */
export function assessResourceHarvest(input: HarvestAssessmentInput): HarvestAssessment {
  const parsed = parseAssessmentInput(input);
  const identification = identifiedFromSnapshot(parsed);
  if (identification.status === "unknown") return identification;

  const { identity } = identification;
  const spawn = RESOURCE_CATALOG[identity.resourceId].spawn!;
  if (parsed.effectiveSkill < spawn.extractSkill.minimum) {
    const skillLabel = SKILL_META[spawn.extractSkill.id].label;
    return Object.freeze({
      status: "blocked",
      reason: "skill",
      identity,
      message: `You identify ${identification.label}, but need ${spawn.extractSkill.minimum} ${skillLabel} to extract it.`,
    });
  }
  if (!meetsHarvestToolTier({ availableTier: parsed.toolTier, requiredTier: spawn.toolTier })) {
    return Object.freeze({
      status: "blocked",
      reason: "tool",
      identity,
      message: `You identify ${identification.label}, but need a tier ${spawn.toolTier} tool to extract it.`,
    });
  }

  const yielded = yieldFor(identity, parsed.effectiveSkill);
  return Object.freeze({
    status: "ready",
    identity,
    yield: yielded,
    message: formatHarvestSuccess(yielded),
  });
}
