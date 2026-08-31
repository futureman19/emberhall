import { COURT, MAP, placeById } from "./atlas.ts";
import { hash2 } from "./rng.ts";
import type { BiomeId, World } from "./types.ts";

export type { BiomeId } from "./types.ts";

export type BiomeW = {
  vale: number;
  tundra: number;
  taiga: number;
  fen: number;
  jungle: number;
  desert: number;
};

function falloff(x: number, y: number, cx: number, cy: number, r: number) {
  const d = Math.hypot(x - cx, y - cy);
  if (d >= r) return 0;
  const t = 1 - d / r;
  return t * t * (3 - 2 * t);
}

function fade3(t: number) {
  return t * t * (3 - 2 * t);
}

function vnoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade3(x - x0);
  const fy = fade3(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Large land-noise. Breaks the climate circles into fingers. */
export function macroNoise(x: number, y: number, seed = 17) {
  return vnoise(x / 32, y / 32, seed) * 0.62 + vnoise(x / 13, y / 13, seed + 9) * 0.38;
}

function clamp01(n: number) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function biomeWeights(x: number, y: number): BiomeW {
  const ridge = placeById("ridgewatch");
  const wolf = placeById("wolfhollow");
  const fen = placeById("hearthfen");
  const brine = placeById("brinegate");
  const mere = placeById("southmere");
  const north = y < 108 ? (108 - y) / 108 : 0;
  let tundra = Math.max(falloff(x, y, ridge.tx, ridge.ty, 92), north * 0.9);
  let taiga = falloff(x, y, wolf.tx, wolf.ty, 54);
  let marsh = falloff(x, y, fen.tx, fen.ty, 62);
  let jungle = y > 378 ? falloff(x, y, mere.tx, mere.ty, 58) : 0;
  const east = x > 412 && y > 330 ? Math.min(1, (x - 412) / 96) * Math.min(1, (y - 330) / 110) : 0;
  let desert = Math.max(falloff(x, y, brine.tx, brine.ty, 82), east * 0.85);

  tundra = clamp01(tundra + (macroNoise(x, y, 17) - 0.5) * 0.48);
  taiga = clamp01(taiga + (macroNoise(x, y, 23) - 0.5) * 0.34);
  marsh = clamp01(marsh + (macroNoise(x, y, 29) - 0.5) * 0.4);
  jungle = clamp01(jungle + (macroNoise(x, y, 31) - 0.5) * 0.32);
  desert = clamp01(desert + (macroNoise(x, y, 37) - 0.5) * 0.42);

  const hall = falloff(x, y, COURT.tx, COURT.ty, 58);
  const damp = 1 - hall * 0.94;
  tundra *= damp;
  taiga *= damp;
  marsh *= damp;
  jungle *= damp;
  desert *= damp;

  const vale = Math.max(0.12, 1 - (tundra + taiga + marsh + jungle + desert)) + hall * 0.55;
  const s = vale + tundra + taiga + marsh + jungle + desert;
  return {
    vale: vale / s,
    tundra: tundra / s,
    taiga: taiga / s,
    fen: marsh / s,
    jungle: jungle / s,
    desert: desert / s,
  };
}

export function biomeAt(x: number, y: number): BiomeId {
  const w = biomeWeights(x, y);
  let best: BiomeId = "vale";
  let n = w.vale;
  (["tundra", "taiga", "fen", "jungle", "desert"] as const).forEach((id) => {
    if (w[id] > n) {
      n = w[id];
      best = id;
    }
  });
  return best;
}

/** Paint climate onto grass and trees. Soft. Halls, roads, rock, and farms stay. Safe to run twice. */
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
      const w = biomeWeights(x, y);
      const n = hash2(x, y, seed + 61);
      const n2 = hash2(x, y, seed + 73);
      if (w.tundra > 0.16 && w.tundra * 0.82 + n * 0.38 + (t.h >= 4 ? 0.16 : 0) > 0.58) {
        if (t.kind === "tree") {
          if (n2 > 0.42) t.kind = t.h >= 5 ? "snow" : "dirt";
        } else if (t.kind === "grass" || t.kind === "sand" || t.kind === "marsh") {
          t.kind = t.h >= 3 || n > 0.3 ? "snow" : "dirt";
        }
      } else if (w.desert > 0.16 && w.desert * 0.8 + n * 0.36 > 0.56) {
        if (t.kind === "tree") {
          if (n <= 0.82) t.kind = "sand";
        } else if (t.kind === "grass" || t.kind === "marsh" || t.kind === "snow") {
          t.kind = "sand";
        }
      } else if (w.fen > 0.18 && w.fen * 0.88 + n * 0.28 > 0.54) {
        if (t.kind === "tree") {
          if (n > 0.55) t.kind = "marsh";
        } else if (t.kind === "grass" || t.kind === "snow") {
          t.kind = "marsh";
        }
      } else if (w.jungle > 0.32 && t.kind === "grass" && n > 0.7) {
        t.kind = "tree";
      } else if (w.taiga > 0.28 && t.kind === "grass" && n > 0.6) {
        t.kind = "dirt";
      }
    }
  }
}
