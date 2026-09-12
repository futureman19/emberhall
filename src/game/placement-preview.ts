import { siteError } from "./building-size.ts";
import { houseSiteError, isHouseKind } from "./house.ts";
import type { BuildingKind, World } from "./types.ts";

/** Read-only preview validation; never consumes a deed or places a building. */
export function placementPreviewError(world: World, kind: BuildingKind, tx: number, ty: number): string | null {
  return isHouseKind(kind) ? houseSiteError(world, kind, tx, ty) : siteError(world, kind, tx, ty);
}
