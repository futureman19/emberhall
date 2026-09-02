import { MAP, placeAffinity } from "../atlas.ts";
import { BIOME_IDS, biomeAt, biomeWeights, type BiomeW } from "../biome.ts";
import type { BiomeId } from "../types.ts";
import { RESOURCE_CATALOG, RESOURCE_IDS } from "./catalog.ts";
import {
  defineResourceNodeIdentity,
  type GemClarity,
  type GemResourceId,
  type MaterialGrade,
  type ResourceId,
  type ResourceNodeIdentity,
} from "./types.ts";

export type ResourceNodeKind = "tree" | "rock";

export interface ResourceNodeInput {
  readonly seed: number;
  readonly tx: number;
  readonly ty: number;
  readonly nodeKind: ResourceNodeKind;
}

export interface ResourceNodeLocationInput {
  readonly tx: number;
  readonly ty: number;
  readonly nodeKind: ResourceNodeKind;
}

export interface ResourceFamilyProbability {
  readonly resourceId: ResourceId;
  readonly ordinary: boolean;
  readonly affinity: number;
  readonly rawWeight: number;
  readonly probability: number;
}

export interface ResourceNodeProbabilityInspection {
  readonly nodeKind: ResourceNodeKind;
  readonly biome: BiomeId;
  readonly biomeWeights: Readonly<BiomeW>;
  readonly candidates: readonly ResourceFamilyProbability[];
}

export interface ResourceNodeResolution {
  readonly nodeKind: ResourceNodeKind;
  readonly biome: BiomeId;
  readonly biomeWeights: Readonly<BiomeW>;
  readonly identity: ResourceNodeIdentity;
}

export interface QualityPolicyEntry<Q extends MaterialGrade | GemClarity> {
  readonly quality: Q;
  readonly probability: number;
  readonly upperThreshold: number;
}

/**
 * Ungated tier-one definitions form the ordinary baseline. When both groups
 * exist, rare definitions may consume at most 20%; the ordinary complement is
 * therefore always at least 80%. A naturally smaller rare share is unchanged.
 */
export const RESOURCE_NODE_RARE_FAMILY_CAP = 0.2;
export const RESOURCE_NODE_ORDINARY_FAMILY_FLOOR = 1 - RESOURCE_NODE_RARE_FAMILY_CAP;

/**
 * Quality is a separate node-owned roll. Pristine material remains possible
 * for every grade family but is bounded to 3%.
 */
export const MATERIAL_GRADE_QUALITY_POLICY = Object.freeze([
  Object.freeze({ quality: "rough", probability: 0.45, upperThreshold: 0.45 }),
  Object.freeze({ quality: "sound", probability: 0.35, upperThreshold: 0.8 }),
  Object.freeze({ quality: "choice", probability: 0.17, upperThreshold: 0.97 }),
  Object.freeze({ quality: "pristine", probability: 0.03, upperThreshold: 1 }),
] as const satisfies readonly QualityPolicyEntry<MaterialGrade>[]);

/** Perfect gems remain discoverable but are bounded to the rarest 2% of gem nodes. */
export const GEM_CLARITY_QUALITY_POLICY = Object.freeze([
  Object.freeze({ quality: "cracked", probability: 0.38, upperThreshold: 0.38 }),
  Object.freeze({ quality: "flawed", probability: 0.3, upperThreshold: 0.68 }),
  Object.freeze({ quality: "cut", probability: 0.2, upperThreshold: 0.88 }),
  Object.freeze({ quality: "flawless", probability: 0.1, upperThreshold: 0.98 }),
  Object.freeze({ quality: "perfect", probability: 0.02, upperThreshold: 1 }),
] as const satisfies readonly QualityPolicyEntry<GemClarity>[]);

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

const LOCATION_INPUT_FIELDS = ["tx", "ty", "nodeKind"] as const;
const RESOLVER_INPUT_FIELDS = ["seed", ...LOCATION_INPUT_FIELDS] as const;

function snapshotOwnDataFields<const Fields extends readonly string[]>(input: unknown, fields: Fields): Readonly<Record<Fields[number], unknown>> {
  const fail = (): never => {
    throw new Error(`resource node input must be a plain object with exactly own data fields: ${fields.join(", ")}`);
  };
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return fail();

  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.length !== fields.length || ownKeys.some((key) => typeof key !== "string" || !fields.includes(key))) return fail();

  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const field of fields) {
    const descriptor = Reflect.getOwnPropertyDescriptor(input, field);
    if (descriptor === undefined || !("value" in descriptor)) return fail();
    snapshot[field] = descriptor.value;
  }
  return Object.freeze(snapshot) as Readonly<Record<Fields[number], unknown>>;
}

function validateCoordinate(name: "tx" | "ty", value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value >= MAP) {
    throw new Error(`${name} must be a safe integer within map bounds 0..${MAP - 1}`);
  }
}

function validateNodeKind(value: unknown): asserts value is ResourceNodeKind {
  if (value !== "tree" && value !== "rock") throw new Error("nodeKind must be tree or rock");
}

function parseLocationInput(input: unknown): ResourceNodeLocationInput {
  const snapshot = snapshotOwnDataFields(input, LOCATION_INPUT_FIELDS);
  validateCoordinate("tx", snapshot.tx);
  validateCoordinate("ty", snapshot.ty);
  validateNodeKind(snapshot.nodeKind);
  return snapshot as unknown as ResourceNodeLocationInput;
}

function parseResolverInput(input: unknown): ResourceNodeInput {
  const snapshot = snapshotOwnDataFields(input, RESOLVER_INPUT_FIELDS);
  if (typeof snapshot.seed !== "number" || !Number.isSafeInteger(snapshot.seed)) throw new Error("seed must be a safe integer");
  validateCoordinate("tx", snapshot.tx);
  validateCoordinate("ty", snapshot.ty);
  validateNodeKind(snapshot.nodeKind);
  return snapshot as unknown as ResourceNodeInput;
}

function isOrdinaryResource(resourceId: ResourceId): boolean {
  const spawn = RESOURCE_CATALOG[resourceId].spawn;
  return spawn !== undefined && spawn.identifySkill.minimum === 0 && spawn.extractSkill.minimum === 0 && spawn.toolTier === 1;
}

function affinityFor(resourceId: ResourceId, weights: BiomeW, tx: number, ty: number): number {
  const spawn = RESOURCE_CATALOG[resourceId].spawn;
  if (!spawn) return 0;
  const biome = BIOME_IDS.reduce((sum, biomeId) => sum + weights[biomeId] * (spawn.regions[biomeId] ?? 0), 0);
  if (!spawn.places) return biome;
  let place = 0;
  for (const [placeId, weight] of Object.entries(spawn.places)) {
    place += placeAffinity(tx, ty, placeId) * (weight ?? 0);
  }
  if (place <= 0) return 0;
  return biome + place;
}

/**
 * Inspect exact family weights at a tile without sampling. RESOURCE_IDS owns
 * candidate order, avoiding object-key iteration as a balance dependency.
 */
export function inspectResourceNodeProbabilities(input: ResourceNodeLocationInput): ResourceNodeProbabilityInspection {
  return inspectResourceNodeProbabilitiesFromSnapshot(parseLocationInput(input));
}

function inspectResourceNodeProbabilitiesFromSnapshot(input: ResourceNodeLocationInput): ResourceNodeProbabilityInspection {
  const weights = biomeWeights(input.tx, input.ty);
  const rawCandidates = RESOURCE_IDS.flatMap((resourceId) => {
    const spawn = RESOURCE_CATALOG[resourceId].spawn;
    if (!spawn || spawn.nodeKind !== input.nodeKind) return [];
    const affinity = affinityFor(resourceId, weights, input.tx, input.ty);
    const rawWeight = spawn.weight * affinity;
    if (!Number.isFinite(rawWeight) || rawWeight <= 0) return [];
    return [{ resourceId, ordinary: isOrdinaryResource(resourceId), affinity, rawWeight }];
  });

  const ordinaryRaw = rawCandidates.filter(({ ordinary }) => ordinary).reduce((sum, candidate) => sum + candidate.rawWeight, 0);
  const rareRaw = rawCandidates.filter(({ ordinary }) => !ordinary).reduce((sum, candidate) => sum + candidate.rawWeight, 0);
  const rawTotal = ordinaryRaw + rareRaw;
  if (!Number.isFinite(rawTotal) || rawTotal <= 0) throw new Error(`no ${input.nodeKind} resource candidates at ${input.tx},${input.ty}`);

  const rawRareShare = rareRaw / rawTotal;
  const capRare = ordinaryRaw > 0 && rareRaw > 0 && rawRareShare > RESOURCE_NODE_RARE_FAMILY_CAP;
  const candidates = rawCandidates.map((candidate): ResourceFamilyProbability => {
    let probability = candidate.rawWeight / rawTotal;
    if (capRare) {
      probability = candidate.ordinary
        ? (candidate.rawWeight / ordinaryRaw) * RESOURCE_NODE_ORDINARY_FAMILY_FLOOR
        : (candidate.rawWeight / rareRaw) * RESOURCE_NODE_RARE_FAMILY_CAP;
    }
    return { ...candidate, probability };
  });

  return deepFreeze({
    nodeKind: input.nodeKind,
    biome: biomeAt(input.tx, input.ty),
    biomeWeights: weights,
    candidates,
  }) as ResourceNodeProbabilityInspection;
}

/** FNV-1a 64 keeps deterministic channels local and independent of global RNG. */
function deterministicUnit(key: string): number {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= BigInt(key.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return Number(hash >> 11n) / 9_007_199_254_740_992;
}

function canonicalNodeId(input: ResourceNodeInput): string {
  return `resource-node:v1:${input.seed}:${input.tx}:${input.ty}:${input.nodeKind}`;
}

function selectFamily(inspection: ResourceNodeProbabilityInspection, roll: number): ResourceId {
  let cumulative = 0;
  for (const candidate of inspection.candidates) {
    cumulative += candidate.probability;
    if (roll < cumulative) return candidate.resourceId;
  }
  return inspection.candidates.at(-1)!.resourceId;
}

function selectGrade(roll: number): MaterialGrade {
  return MATERIAL_GRADE_QUALITY_POLICY.find(({ upperThreshold }) => roll < upperThreshold)?.quality ?? "pristine";
}

function selectClarity(roll: number): GemClarity {
  return GEM_CLARITY_QUALITY_POLICY.find(({ upperThreshold }) => roll < upperThreshold)?.quality ?? "perfect";
}

function isGemResource(resourceId: ResourceId): resourceId is GemResourceId {
  return RESOURCE_CATALOG[resourceId].qualityType === "clarity";
}

/**
 * Pure node resolver. Family and quality use distinct hash channels; neither
 * skill, time, call order, mutable world state, nor an external RNG can reroll
 * this identity.
 */
export function resolveResourceNode(input: ResourceNodeInput): ResourceNodeResolution {
  const snapshot = parseResolverInput(input);
  const nodeId = canonicalNodeId(snapshot);
  const inspection = inspectResourceNodeProbabilitiesFromSnapshot(snapshot);
  const resourceId = selectFamily(inspection, deterministicUnit(`${nodeId}|family`));
  const qualityRoll = deterministicUnit(`${nodeId}|quality`);
  const identity = isGemResource(resourceId)
    ? defineResourceNodeIdentity(nodeId, resourceId, selectClarity(qualityRoll))
    : defineResourceNodeIdentity(nodeId, resourceId, selectGrade(qualityRoll));

  return deepFreeze({
    nodeKind: inspection.nodeKind,
    biome: inspection.biome,
    biomeWeights: inspection.biomeWeights,
    identity,
  }) as ResourceNodeResolution;
}
