import type { BiomeId, SkillId } from "../types.ts";

export type GradeResourceId =
  | "oak"
  | "pine"
  | "willow"
  | "birch"
  | "ash"
  | "redwood"
  | "yew"
  | "ghostwood"
  | "iron_ore"
  | "highland_ore"
  | "common_cloth"
  | "fine_linen";
export type GemResourceId = "ruby" | "sapphire";
export type ResourceId = GradeResourceId | GemResourceId;

export type NonGemResourceKind = "timber" | "ore" | "fiber";
export type ResourceKind = NonGemResourceKind | "gem";
export type GradeResourceForm = "log" | "board" | "ore" | "ingot" | "cloth";
export type ResourceForm = GradeResourceForm | "gem";
export type MaterialGrade = "rough" | "sound" | "choice" | "pristine";
export type GemClarity = "cracked" | "flawed" | "cut" | "flawless" | "perfect";
export type MaterialQuality = MaterialGrade | GemClarity;
export type QualityForResource<I extends ResourceId> = I extends GemResourceId ? GemClarity : MaterialGrade;
export type GradeMaterialTraitId = "accuracy" | "damage" | "handling";
export type ClarityMaterialTraitId = "power" | "fortune";
export type MaterialTraitId = GradeMaterialTraitId | ClarityMaterialTraitId;
export type ProcessingStation = "bench" | "forge" | "fire";

export interface SkillRequirement {
  readonly id: SkillId;
  readonly minimum: number;
}

export interface ProcessingRoute {
  readonly id: string;
  readonly operation: "saw" | "smelt";
  readonly station: ProcessingStation;
  readonly skill: SkillRequirement;
  readonly input: {
    readonly form: ResourceForm;
    readonly quantity: number;
  };
  readonly output: {
    readonly form: ResourceForm;
    readonly quantity: number;
  };
}

export interface ResourceSpawn {
  readonly nodeKind: "tree" | "rock";
  readonly weight: number;
  readonly regions: Readonly<Partial<Record<BiomeId, number>>>;
  readonly identifySkill: SkillRequirement;
  readonly extractSkill: SkillRequirement;
  readonly toolTier: number;
}

export interface ResourceVisual {
  readonly family: "broadleaf" | "conifer" | "stone" | "cloth" | "gem";
  readonly primary: string;
  readonly secondary: string;
}

interface ResourceDefinitionBase {
  readonly label: string;
  readonly spawn?: ResourceSpawn;
  readonly processing: readonly ProcessingRoute[];
  readonly visual: ResourceVisual;
}

export type ResourceKindFor<I extends ResourceId> = I extends "iron_ore" | "highland_ore"
  ? "ore"
  : I extends "common_cloth" | "fine_linen"
    ? "fiber"
    : I extends GemResourceId
      ? "gem"
      : "timber";

export type ResourceFormFor<I extends ResourceId> = ResourceKindFor<I> extends "timber"
  ? "log" | "board"
  : ResourceKindFor<I> extends "ore"
    ? "ore" | "ingot"
    : ResourceKindFor<I> extends "fiber"
      ? "cloth"
      : "gem";

export type GradeResourceDefinition<I extends GradeResourceId = GradeResourceId> = ResourceDefinitionBase & {
  readonly id: I;
  readonly kind: ResourceKindFor<I>;
  readonly forms: readonly ResourceFormFor<I>[];
  readonly qualityType: "grade";
  readonly traitIds: readonly GradeMaterialTraitId[];
};

export type GemResourceDefinition<I extends GemResourceId = GemResourceId> = ResourceDefinitionBase & {
  readonly id: I;
  readonly kind: "gem";
  readonly forms: readonly "gem"[];
  readonly qualityType: "clarity";
  readonly traitIds: readonly ClarityMaterialTraitId[];
};

export type ResourceDefinitionFor<I extends ResourceId> = I extends GemResourceId
  ? GemResourceDefinition<I>
  : I extends GradeResourceId
    ? GradeResourceDefinition<I>
    : never;

export type ResourceDefinition = {
  readonly [I in ResourceId]: ResourceDefinitionFor<I>;
}[ResourceId];

export type ResourceCatalog = {
  readonly [I in ResourceId]: ResourceDefinitionFor<I>;
};

export type GradeResourceSelector = {
  readonly qualityType: "grade";
  readonly resourceIds?: readonly GradeResourceId[];
  readonly kinds?: readonly NonGemResourceKind[];
  readonly forms?: readonly GradeResourceForm[];
  readonly qualities?: readonly MaterialGrade[];
};

export type GemResourceSelector = {
  readonly qualityType: "clarity";
  readonly resourceIds?: readonly GemResourceId[];
  readonly kinds?: readonly "gem"[];
  readonly forms?: readonly "gem"[];
  readonly qualities?: readonly GemClarity[];
};

export type ResourceSelector = GradeResourceSelector | GemResourceSelector;

/**
 * Stable node identity. The world seed/location owns qualityCeiling;
 * harvesting skill never creates or rerolls it.
 */
export type ResourceNodeIdentity<I extends ResourceId = ResourceId> = I extends ResourceId
  ? Readonly<{
      nodeId: string;
      resourceId: I;
      qualityCeiling: QualityForResource<I>;
    }>
  : never;

const GRADE_RESOURCE_IDS = [
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
] as const satisfies readonly GradeResourceId[];
const GEM_RESOURCE_IDS = ["ruby", "sapphire"] as const satisfies readonly GemResourceId[];
const MATERIAL_GRADES = ["rough", "sound", "choice", "pristine"] as const satisfies readonly MaterialGrade[];
const GEM_CLARITIES = ["cracked", "flawed", "cut", "flawless", "perfect"] as const satisfies readonly GemClarity[];

function includes<const Value extends string>(values: readonly Value[], candidate: string): candidate is Value {
  return values.some((value) => value === candidate);
}

export function defineResourceNodeIdentity<const I extends ResourceId>(
  nodeId: string,
  resourceId: I,
  qualityCeiling: QualityForResource<NoInfer<I>>,
): ResourceNodeIdentity<I> {
  if (!includes(GRADE_RESOURCE_IDS, resourceId) && !includes(GEM_RESOURCE_IDS, resourceId)) {
    throw new Error(`unknown resource id: ${resourceId}`);
  }
  const compatible = includes(GEM_RESOURCE_IDS, resourceId)
    ? includes(GEM_CLARITIES, qualityCeiling)
    : includes(MATERIAL_GRADES, qualityCeiling);
  if (!compatible) throw new Error(`quality ${qualityCeiling} is incompatible with resource ${resourceId}`);
  return Object.freeze({ nodeId, resourceId, qualityCeiling }) as ResourceNodeIdentity<I>;
}
