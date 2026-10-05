import type { Tile } from "./types.ts";

/** Snowmelt to the south rim. Radius varies in tiles; mill narrows to its original channel.
 * Water is a level rendered terrain surface, not a hydraulic/fluid simulation. */
export const FRONTIER_RIVER = [
  [738, 258, 2],
  [750, 268, 3],
  [773, 295, 4],
  [800, 340, 5],
  [846, 365, 6],
  [860, 405, 5],
  [890, 430, 6],
  [925, 478, 5],
  [944, 515, 4],
  [952, 532, 1],
  [952, 560, 1],
  [952, 585, 2],
  [975, 618, 5],
  [990, 660, 7],
  [974, 710, 6],
  [940, 765, 7],
  [940, 820, 8],
  [930, 874, 7],
  [970, 940, 8],
  [970, 1035, 9],
  [1084, 1090, 10],
  [1100, 1144, 11],
] as const;

export const RIVER_CROSSINGS = [
  { id: "snowmelt-ford", x: 750, z: 268, halfSpan: 9 },
  { id: "reedwake-ford", x: 952, z: 560, halfSpan: 7 },
  { id: "south-ford", x: 940, z: 820, halfSpan: 14 },
] as const;

/** Build once, not per frame or per terrain tile. Minimum signed distance merges bends. */
const valley = new Map<string, { x: number; z: number; edge: number }>();
for (let i = 1; i < FRONTIER_RIVER.length; i++) {
  const [ax, az, ar] = FRONTIER_RIVER[i - 1]!;
  const [bx, bz, br] = FRONTIER_RIVER[i]!;
  const margin = Math.max(ar, br) + 18;
  for (
    let z = Math.floor(Math.min(az, bz) - margin);
    z <= Math.ceil(Math.max(az, bz) + margin);
    z++
  ) {
    for (
      let x = Math.floor(Math.min(ax, bx) - margin);
      x <= Math.ceil(Math.max(ax, bx) + margin);
      x++
    ) {
      const t = Math.max(
        0,
        Math.min(
          1,
          ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2),
        ),
      );
      const edge =
        Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t) - (ar + (br - ar) * t);
      if (edge > 18) continue;
      const key = `${x},${z}`;
      if (edge < (valley.get(key)?.edge ?? Infinity)) valley.set(key, { x, z, edge });
    }
  }
}

/** Keep this river visibly wet and its stone fords distinct, without recoloring legacy terrain or scars. */
export function isFrontierRiverSurface(x: number, z: number, kind: Tile["kind"]) {
  return (kind === "water" || kind === "step") && (valley.get(`${x},${z}`)?.edge ?? Infinity) <= 0;
}

/** Last terrain stamp: roads cannot erase the river; only named fords span its bed. */
export function stampFrontierRiver(tiles: Tile[][], reserved: (x: number, z: number) => boolean) {
  for (const { x, z, edge } of valley.values()) {
    if (x < 512 && z < 512) continue;
    const tile = tiles[z]?.[x];
    if (!tile) continue;
    // Short tapered verges soften road-to-bank joins; no footprint heights or legacy tiles change.
    const verge = RIVER_CROSSINGS.some((c) => {
      const dx = Math.abs(x - c.x),
        dz = Math.abs(z - c.z);
      return dx <= c.halfSpan && dz >= 2 && dz <= 4 && dx + dz <= c.halfSpan + 2;
    });
    if (verge && edge > 0 && tile.kind === "dirt") tile.kind = edge < 2 ? "sand" : "marsh";
    const crossing = RIVER_CROSSINGS.some(
      (c) => Math.abs(z - c.z) <= 1 && Math.abs(x - c.x) <= c.halfSpan,
    );
    if (edge <= 0) {
      tile.h = crossing ? 4 : 3;
      tile.kind = crossing ? "step" : "water";
    } else if (!reserved(x, z)) {
      // A low wet margin, then a gradual valley side, rather than a vertical cut.
      tile.h = Math.min(tile.h, 4 + Math.floor(Math.max(0, edge - 5) / 2));
      tile.h = Math.max(4, tile.h);
      if (tile.kind !== "road" && edge <= 5) tile.kind = edge < 2 ? "sand" : "marsh";
    }
  }
}
