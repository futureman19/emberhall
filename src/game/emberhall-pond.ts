import type { Tile } from "./types.ts";

// Southwest of spawn, east of the diagonal Ford road and west of the south
// route/moongate. Dots leave the original terrain untouched; s = dry sand,
// w = existing water tiles. Keep this footprint seed-independent and small.
const SHORELINE = [
  ".sssss.",
  "sswwwss",
  "swwwwws",
  "swwwwws",
  "sswwwws",
  ".sswwss",
  "..ssss.",
] as const;

/** Generation only: saved scars are applied afterwards by loadSave. */
export function stampEmberhallPond(tiles: Tile[][]) {
  for (const [dy, row] of SHORELINE.entries()) {
    for (const [dx, cell] of [...row].entries()) {
      if (cell === ".") continue;
      const tile = tiles[301 + dy]![247 + dx]!;
      // Match the original vale's level water (h=0) and dry shoreline (h=1).
      // The existing terrain renderer and collision rules own their behavior.
      tile.kind = cell === "w" ? "water" : "sand";
      tile.h = cell === "w" ? 0 : 1;
    }
  }
  // Two clear approach tiles connect the h=3 court at (253,299) to the h=1
  // north bank at (252,301), without touching any existing road or landmark.
  Object.assign(tiles[299]![252]!, { kind: "dirt", h: 3 });
  Object.assign(tiles[300]![252]!, { kind: "step", h: 2 });
}
