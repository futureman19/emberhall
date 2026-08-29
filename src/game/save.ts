import { generateTiles } from "./world";
import type { World } from "./types";

const KEY = "emberhall-save-v4";

export function hasSave() {
  try {
    return Boolean(localStorage.getItem(KEY));
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function writeSave(world: World) {
  try {
    const { tiles: _t, ...rest } = world;
    localStorage.setItem(KEY, JSON.stringify({ ...rest, tiles: null }));
  } catch {
    /* quota */
  }
}

export function loadSave(): World | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as World;
    data.tiles = generateTiles(data.seed);
    if (data.scars) {
      for (const [k, s] of Object.entries(data.scars)) {
        const [x, y] = k.split(",").map(Number);
        const t = data.tiles[y!]?.[x!];
        if (t && s.kind) t.kind = s.kind;
        if (t && s.h != null) t.h = s.h;
      }
    }
    data.restored = true;
    if (!Array.isArray(data.player?.marks)) data.player.marks = [];
    if (data.player && data.player.ghost == null) data.player.ghost = false;
    if (data.player && data.player.corpseAt === undefined) data.player.corpseAt = null;
    if (data.player && data.player.workT == null) data.player.workT = 0;
    if (!Array.isArray(data.plots)) data.plots = [];
    if (Array.isArray(data.people)) {
      for (const p of data.people) if (p.ghost == null) p.ghost = Boolean(p.isPlayer && data.player.ghost);
    }
    return data;
  } catch {
    return null;
  }
}
