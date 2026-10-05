import type { Tile, World } from "./types.ts";

/** One authored crossing. Units match world X/Y-up/Z; origin is the waterline. */
export const REEDWAKE_BRIDGE = {
  x: 952,
  z: 560,
  waterY: 0.6,
  deckY: 1.2,
  halfLength: 3.5,
  halfWidth: 1.5,
  url: "/art/river-bridge/reedwake-bridge.glb",
} as const;

/** Render-only earth blend at the two banks; collision and saved step tiles stay canonical. */
export function bridgeSurfaceKind(x: number, z: number, kind: Tile["kind"]): Tile["kind"] {
  const dx = Math.abs(x - 952);
  return kind === "step" && dx > 3.5 && dx <= 7 && Math.abs(z - 560) <= 1.5 ? "dirt" : kind;
}

export function bridgeRailBlocked(x: number, z: number) {
  return Math.abs(x - 952) <= 3 && Math.abs(z - 560) === 2;
}
export function bridgeDeckAt(x: number, z: number) {
  return Math.abs(x - 952) <= 3.5 && Math.abs(z - 560) <= 1.5;
}
/** Only derived step terrain qualifies; saved dirt scars retain their own height. */
export function bridgeGroundY(world: World, x: number, z: number): number | null {
  const dx = Math.abs(x - 952);
  if (dx > 5.5 || Math.abs(z - 560) > 1.5) return null;
  const t = world.tiles[Math.round(z)]?.[Math.round(x)];
  if (t?.kind !== "step") return null;
  return 1.2 - Math.max(0, dx - 3.5) * 0.2;
}
/** Render the bed, not the authoritative walk surface, only below this bridge. */
export function bridgeTerrainY(world: World, x: number, z: number, normalY: number) {
  if (bridgeGroundY(world, x, z) === null) return normalY;
  return bridgeDeckAt(x, z) ? 0.6 : normalY - 0.03;
}
export function stampRiverBridge(tiles: Tile[][]) {
  for (let z = 559; z <= 561; z++) {
    for (let x = 945; x <= 959; x++) {
      const t = tiles[z]?.[x];
      if (!t) continue;
      const dx = Math.abs(x - 952);
      t.h = dx <= 3 ? 6 : dx === 4 ? 5 : 4;
      t.kind = "step";
    }
  }
}
