import type { FaunaKind, ItemId, SkillId } from "../types.ts";
import type {
  ClarityMaterialTraitId,
  GemClarity,
  GemResourceId,
  GradeResourceForm,
  GradeResourceId,
  MaterialGrade,
  MaterialTraitId,
  ResourceSelector,
} from "../resources/types.ts";
import type { CanonicalStatId } from "../resources/traits.ts";

export type ItemFormId = "bow" | "sword";
export type ItemClass = "weapon" | "armor" | "jewelry" | "tool" | "placeable";
export type MaterialRole =
  "body" | "binding" | "edge" | "hilt" | "plate" | "lining" | "frame" | "finish";
export type MaterialContribution = "primary" | "secondary" | "cosmetic";
export type Workmanship = "ordinary" | "fine" | "exceptional";
export type GemFamily = ClarityMaterialTraitId;

export interface ItemFormIdentity {
  readonly baseItem: ItemId;
  readonly itemClass: ItemClass;
}

export interface RecipeRole {
  readonly role: MaterialRole;
  readonly amount: number;
  readonly accepts: ResourceSelector;
  readonly contribution: MaterialContribution;
}

export interface ResolvedItemStats {
  readonly damage: number;
  readonly hitBonus: number;
  readonly armor: number;
  readonly skillBonuses: Readonly<Partial<Record<SkillId, number>>>;
  readonly slayerMultipliers: Readonly<Partial<Record<FaunaKind, number>>>;
}

/** Local derivation only: Fortune must never be stored in a Vault payload. */
export interface LocalDerivedItemStats {
  readonly fortune: number;
}

export interface ItemStatCaps {
  readonly damage: number;
  readonly hitBonus: number;
  readonly armor: number;
  readonly skillBonusPerSkill: number;
  readonly slayerMultiplier: number;
}

export interface ItemFormDefinition {
  readonly id: ItemFormId;
  readonly recipeVersion: number;
  readonly baseItem: ItemId;
  readonly label: string;
  readonly itemClass: ItemClass;
  readonly roles: readonly RecipeRole[];
  readonly baseStats: ResolvedItemStats;
  readonly caps: ItemStatCaps;
  readonly allowedGemFamilies: readonly GemFamily[];
  readonly maxInlays: number;
}

export interface CraftedComponent {
  readonly role: MaterialRole;
  readonly resourceId: GradeResourceId;
  readonly form: GradeResourceForm;
  readonly grade: MaterialGrade;
  readonly amount: number;
}

export interface GemInlay {
  readonly resourceId: GemResourceId;
  readonly clarity: GemClarity;
}

export interface ItemBuild {
  readonly workmanship: Workmanship;
  readonly components: readonly CraftedComponent[];
  readonly inlays: readonly GemInlay[];
}

export interface StatContribution {
  readonly source: "workmanship" | "material" | "gem";
  readonly sourceId: Workmanship | GradeResourceId | GemResourceId;
  readonly role?: MaterialRole;
  readonly traitId?: MaterialTraitId;
  readonly family?: GemFamily;
  readonly stats: Readonly<
    Partial<Record<CanonicalStatId, number>> & {
      readonly skillBonuses?: Readonly<Partial<Record<SkillId, number>>>;
      readonly slayerMultipliers?: Readonly<Partial<Record<FaunaKind, number>>>;
    }
  >;
  readonly local: Readonly<Partial<LocalDerivedItemStats>>;
}

export interface ResolvedItemResolution {
  readonly stats: ResolvedItemStats;
  readonly local: LocalDerivedItemStats;
  readonly contributions: readonly StatContribution[];
}
