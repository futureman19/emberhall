import type { GemClarity, MaterialGrade, MaterialTraitId } from "./types.ts";

export const CANONICAL_STAT_IDS = ["damage", "hitBonus", "armor"] as const;
export type CanonicalStatId = (typeof CANONICAL_STAT_IDS)[number];
export type LocalTraitStatId = "fortune";

export interface CanonicalStats {
  readonly damage: number;
  readonly hitBonus: number;
  readonly armor: number;
}

export interface LocalTraitStats {
  readonly fortune: number;
}

type GradeTraitDefinition = {
  readonly qualityType: "grade";
  readonly stat: CanonicalStatId;
  readonly scope: "canonical";
  readonly values: Readonly<Record<MaterialGrade, number>>;
};

type ClarityCanonicalTraitDefinition = {
  readonly qualityType: "clarity";
  readonly stat: CanonicalStatId;
  readonly scope: "canonical";
  readonly values: Readonly<Record<GemClarity, number>>;
};

type ClarityLocalTraitDefinition = {
  readonly qualityType: "clarity";
  readonly stat: LocalTraitStatId;
  readonly scope: "local";
  readonly values: Readonly<Record<GemClarity, number>>;
};

type ClaritySkillTraitDefinition = {
  readonly qualityType: "clarity";
  readonly stat: "skill";
  readonly scope: "canonical";
  readonly values: Readonly<Record<GemClarity, number>>;
};

export type MaterialTraitDefinition =
  | GradeTraitDefinition
  | ClarityCanonicalTraitDefinition
  | ClarityLocalTraitDefinition
  | ClaritySkillTraitDefinition;

export const MAX_LOCAL_FORTUNE = 5;

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

const TRAITS = {
  accuracy: {
    qualityType: "grade",
    stat: "hitBonus",
    scope: "canonical",
    values: { rough: 0.5, sound: 1, choice: 2, pristine: 3 },
  },
  damage: {
    qualityType: "grade",
    stat: "damage",
    scope: "canonical",
    values: { rough: 0.5, sound: 1, choice: 1.5, pristine: 2 },
  },
  handling: {
    qualityType: "grade",
    stat: "hitBonus",
    scope: "canonical",
    values: { rough: 0.25, sound: 0.5, choice: 0.75, pristine: 1 },
  },
  keen: {
    qualityType: "grade",
    stat: "damage",
    scope: "canonical",
    values: { rough: 0.25, sound: 0.5, choice: 0.75, pristine: 1 },
  },
  sturdy: {
    qualityType: "grade",
    stat: "armor",
    scope: "canonical",
    values: { rough: 0.5, sound: 1, choice: 1.5, pristine: 2 },
  },
  supple: {
    qualityType: "grade",
    stat: "armor",
    scope: "canonical",
    values: { rough: 0.5, sound: 1, choice: 1.5, pristine: 2 },
  },
  ember: {
    qualityType: "grade",
    stat: "damage",
    scope: "canonical",
    values: { rough: 1, sound: 2, choice: 3, pristine: 4 },
  },
  power: {
    qualityType: "clarity",
    stat: "damage",
    scope: "canonical",
    values: { cracked: 1, flawed: 2, cut: 3, flawless: 4, perfect: 5 },
  },
  fortune: {
    qualityType: "clarity",
    stat: "fortune",
    scope: "local",
    values: { cracked: 1, flawed: 2, cut: 3, flawless: 4, perfect: 5 },
  },
  precision: {
    qualityType: "clarity",
    stat: "hitBonus",
    scope: "canonical",
    values: { cracked: 1, flawed: 2, cut: 3, flawless: 4, perfect: 5 },
  },
  protection: {
    qualityType: "clarity",
    stat: "armor",
    scope: "canonical",
    values: { cracked: 0.25, flawed: 0.5, cut: 0.75, flawless: 1, perfect: 1.5 },
  },
  mastery: {
    qualityType: "clarity",
    stat: "skill",
    scope: "canonical",
    values: { cracked: 0.5, flawed: 1, cut: 1.5, flawless: 2, perfect: 3 },
  },
} satisfies Record<MaterialTraitId, MaterialTraitDefinition>;

export const TRAIT_REGISTRY = deepFreeze(TRAITS);
