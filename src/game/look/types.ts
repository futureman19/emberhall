// The look recipe — who a person appears to be, kept apart from what they do.
// `emberhall.look/1` is pure data: every field optional, defaults owned by
// resolve.ts. Optional additions never bump the save version.
import type { ClassId } from "../types";

export const LOOK_SCHEMA = "emberhall.look/1" as const;

export type HairStyleId = "bald" | "crop" | "shag" | "tail" | "long";

export interface LookRecipeV1 {
  schema: typeof LOOK_SCHEMA;
  cls?: ClassId;
  skin?: string;
  hairStyle?: HairStyleId;
  hairColor?: string;
  garb?: string;
  parts?: string[]; // emberhall.part/1 ids — crafted voxel parts
}
