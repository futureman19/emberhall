import { EMBERHALL_KIT } from "./kits/emberhall.ts";
import { PLACEABLE_CATEGORIES, type PlaceableDefinition } from "./types.ts";

export { PLACEABLE_CATEGORIES };

export const PLACEABLE_CATALOG: PlaceableDefinition[] = EMBERHALL_KIT;

export const PLACEABLE_BY_ID: Record<string, PlaceableDefinition> = Object.fromEntries(
  PLACEABLE_CATALOG.map((def) => [def.id, def]),
);
