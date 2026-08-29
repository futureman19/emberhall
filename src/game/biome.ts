import { COURT, MAP, placeById } from "./atlas";
import { hash2 } from "./rng";
import type { World } from "./types";

export type BiomeId = "vale" | "tundra" | "fen" | "desert";

function falloff(x: number, y: number, cx: number, cy: number, r: number) {
  const d = Math.hypot(x - cx, y - cy);
  if (d >= r) return 0;
  const t = 1 - d / r;
  return t * t * (3 - 2 * t);
}

export function biomeAt(x: number, y: number): BiomeId {
  const ridge = placeById("ridgewatch");
  const fen = placeById("hearthfen");
  const brine = placeById("brinegate");
  const north = y < 92 ? (92 - y) / 92 : 0;
  const tundra = Math.max(falloff(x, y, ridge.tx, ridge.ty, 82), north * 0.88);
  const marsh = falloff(x, y, fen.tx, fen.ty, 48);
  const east = x > 428 && y > 348 ? Math.min(1, (x - 428) / 84) * Math.min(1, (y - 348) / 90) : 0;
  const desert = Math.max(falloff(x, y, brine.tx, brine.ty, 64), east * 0.85);
  if (falloff(x, y, COURT.tx, COURT.ty, 52) > 0.32) return "vale";
  if (tundra > 0.28 && tundra >= marsh && tundra >= desert) return "tundra";
  if (marsh > 0.28 && marsh >= desert) return "fen";
  if (desert > 0.28) return "desert";
  return "vale";
}

/** Paint climate onto grass and trees. Halls, roads, rock, and farms stay. Safe to run twice. */
export function paintBiomes(world: World) {
  const { tiles, seed } = world;
  if (!tiles.length) return;
  for (let y = 0; y < MAP; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < MAP; x++) {
      const t = row[x];
      if (!t) continue;
      if (
        t.kind === "water" ||
        t.kind === "road" ||
        t.kind === "cobble" ||
        t.kind === "floor" ||
        t.kind === "wall" ||
        t.kind === "pit" ||
        t.kind === "step" ||
        t.kind === "rock"
      ) {
        continue;
      }
      const b = biomeAt(x, y);
      if (b === "vale") continue;
      const n = hash2(x, y, seed + 61);
      if (b === "tundra") {
        if (t.kind === "tree") {
          if (n > 0.5) t.kind = t.h >= 5 ? "snow" : "dirt";
        } else if (t.kind === "grass" || t.kind === "sand" || t.kind === "marsh") {
          t.kind = t.h >= 4 || n > 0.34 ? "snow" : "dirt";
        }
      } else if (b === "fen") {
        if (t.kind === "tree") {
          if (n > 0.6) t.kind = "marsh";
        } else if (t.kind === "grass" || t.kind === "snow") {
          t.kind = "marsh";
        }
      } else if (b === "desert") {
        if (t.kind === "tree") {
          if (n <= 0.84) t.kind = "sand";
        } else if (t.kind === "grass" || t.kind === "marsh" || t.kind === "snow") {
          t.kind = "sand";
        }
      }
    }
  }
}
