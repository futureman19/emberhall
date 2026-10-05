import { bridgeRailBlocked, stampRiverBridge } from "./river-bridge.ts";
import { stampFrontierRiver } from "./frontier-river.ts";
import type { Place } from "./atlas.ts";
import type { Tile } from "./types.ts";
import { FRONTIER_ART } from "./frontier-art-catalog.ts";
export { FRONTIER_ART } from "./frontier-art-catalog.ts";

/** Markers are clear arrival points, not the centre of a solid art asset. */
export const FRONTIER_SITES: Place[] = [
  {
    id: "twinward",
    name: "Twinward Gate",
    tx: 560,
    ty: 268,
    radius: 20,
    kind: "ruins",
    blurb: "The eastern road. Open gate passage; nearby houses are exterior landmarks.",
  },
  {
    id: "wintercrown",
    name: "Winter Crown",
    tx: 720,
    ty: 268,
    radius: 32,
    kind: "ruins",
    blurb: "Snow-capped stone above the pass.",
  },
  {
    id: "grimroot",
    name: "Grimroot Warcamp",
    tx: 900,
    ty: 268,
    radius: 20,
    kind: "ruins",
    blurb: "An abandoned camp with an open entrance. Supplies are scenery, not loot.",
  },
  {
    id: "mossveil",
    name: "Mossveil Sanctuary",
    tx: 560,
    ty: 560,
    radius: 24,
    kind: "ruins",
    blurb: "A quiet woodland altar among old roots.",
  },
  {
    id: "hollowvein",
    name: "Hollowvein Diggings",
    tx: 760,
    ty: 560,
    radius: 20,
    kind: "ruins",
    blurb: "Forgotten rails lead to a sealed mine. No entrance underground.",
  },
  {
    id: "reedwake",
    name: "Reedwake Landing",
    tx: 960,
    ty: 560,
    radius: 22,
    kind: "ruins",
    blurb: "A timber bridge crosses the mill stream beside the old wrecked ferry.",
  },
  {
    id: "amberrest",
    name: "The Amber Rest",
    tx: 560,
    ty: 820,
    radius: 24,
    kind: "ruins",
    blurb: "An old roadside inn and evening bell. Exterior landmarks, no services.",
  },
  {
    id: "ashfall",
    name: "Ashfall Caldera",
    tx: 820,
    ty: 820,
    radius: 28,
    kind: "ruins",
    blurb: "Basalt and cooling lava. The crater is impassable scenery, not a damage zone.",
  },
  {
    id: "eldercircle",
    name: "The Elder Circle",
    tx: 1020,
    ty: 1000,
    radius: 24,
    kind: "ruins",
    blurb: "Standing stones at the far end of the frontier road.",
  },
];
export const FRONTIER_ROUTES: [string, string][] = [
  ["ironfold", "twinward"],
  ["twinward", "wintercrown"],
  ["wintercrown", "grimroot"],
  ["twinward", "mossveil"],
  ["mossveil", "hollowvein"],
  ["hollowvein", "reedwake"],
  ["mossveil", "amberrest"],
  ["amberrest", "ashfall"],
  ["ashfall", "eldercircle"],
];
/** Bypass the sanctuary rather than routing the north road through its altar. */
export function frontierRoadPoints(from: Place, to: Place): [number, number][] {
  const bends: [number, number][] =
    from.id === "twinward" && to.id === "mossveil"
      ? [
          [584, 268],
          [584, 560],
        ]
      : from.id === "mossveil" && to.id === "twinward"
        ? [
            [584, 560],
            [584, 268],
          ]
        : (from.id === "ashfall" && to.id === "eldercircle") ||
            (from.id === "eldercircle" && to.id === "ashfall")
          ? [[1020, 820]]
          : [];
  return [[from.tx, from.ty], ...bends, [to.tx, to.ty]];
}

export type FrontierArt = (typeof FRONTIER_ART)[number];
const blocked = new Set<string>();
const reserved = new Set<string>();
const buckets = new Map<string, FrontierArt[]>();
export const FRONTIER_CHUNK = 32;
for (const p of FRONTIER_ART) {
  const key = `${Math.floor(p.x / FRONTIER_CHUNK)},${Math.floor(p.z / FRONTIER_CHUNK)}`;
  const bucket = buckets.get(key) ?? [];
  bucket.push(p);
  buckets.set(key, bucket);
  const [x0, z0, x1, z1] = p.bounds;
  for (let z = Math.floor(z0 - 1); z <= Math.ceil(z1 + 1); z++) {
    for (let x = Math.floor(x0 - 1); x <= Math.ceil(x1 + 1); x++)
      reserved.add(`${p.x + x},${p.z + z}`);
  }
  for (const [bx0, bz0, bx1, bz1] of p.blocks) {
    // Tile centres with 0.2 body clearance. Gate centre cells remain passable.
    for (let z = Math.ceil(bz0 - 0.2); z <= Math.floor(bz1 + 0.2); z++) {
      for (let x = Math.ceil(bx0 - 0.2); x <= Math.floor(bx1 + 0.2); x++)
        blocked.add(`${p.x + x},${p.z + z}`);
    }
  }
}
export function sceneryBlocked(x: number, z: number) {
  return bridgeRailBlocked(x, z) || blocked.has(`${x},${z}`);
}
export function sceneryReserved(x: number, z: number) {
  return reserved.has(`${x},${z}`);
}

/** At most 25 bucket lookups, once per 32-tile streaming change, never a terrain scan. */
export function visibleFrontierArt(x: number, z: number): FrontierArt[] {
  const cx = Math.floor(x / FRONTIER_CHUNK),
    cz = Math.floor(z / FRONTIER_CHUNK);
  const result: FrontierArt[] = [];
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -2; dx <= 2; dx++) {
      result.push(...(buckets.get(`${cx + dx},${cz + dz}`) ?? []));
    }
  return result;
}

/** Deterministic derived terrain, shared by new worlds and save regeneration. */
export function stampFrontier(tiles: Tile[][], places: Place[]) {
  for (const p of FRONTIER_ART) {
    const [x0, z0, x1, z1] = p.bounds;
    for (let z = Math.floor(p.z + z0 - 2); z <= Math.ceil(p.z + z1 + 2); z++) {
      for (let x = Math.floor(p.x + x0 - 2); x <= Math.ceil(p.x + x1 + 2); x++) {
        const t = tiles[z]?.[x];
        if (t) {
          t.h = 4;
          t.kind = "dirt";
        }
      }
    }
  }
  for (const [a, b] of FRONTIER_ROUTES) {
    const from = places.find((p) => p.id === a)!,
      to = places.find((p) => p.id === b)!;
    const points = frontierRoadPoints(from, to);
    for (let segment = 1; segment < points.length; segment++) {
      const [ax, az] = points[segment - 1]!,
        [bx, bz] = points[segment]!;
      const startHeight = tiles[az]![ax]!.h;
      const n = Math.ceil(Math.hypot(bx - ax, bz - az));
      for (let i = 0; i <= n; i++) {
        const x = Math.round(ax + ((bx - ax) * i) / n);
        const z = Math.round(az + ((bz - az) * i) / n);
        const h =
          a === "ironfold" ? Math.round(startHeight + (4 - startHeight) * Math.min(1, i / 24)) : 4;
        for (let dz = -2; dz <= 2; dz++)
          for (let dx = -2; dx <= 2; dx++) {
            const tile = tiles[z + dz]?.[x + dx];
            if (tile) {
              tile.h = h;
              tile.kind = Math.abs(dx) + Math.abs(dz) <= 1 ? "road" : "dirt";
            }
          }
      }
    }
  }
  stampFrontierRiver(tiles, sceneryReserved);
  stampRiverBridge(tiles);
}
