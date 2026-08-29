import { MAP, inBounds } from "./atlas";
import type { Tile, TileKind, World } from "./types";

export function tileOf(x: number, z: number) {
  return { tx: Math.round(x), ty: Math.round(z) };
}

function kindWalk(kind: TileKind) {
  return kind !== "water" && kind !== "wall" && kind !== "rock";
}

export function climbOk(from: Tile, to: Tile) {
  const dh = Math.abs(to.h - from.h);
  if (dh <= 1) return true;
  if (dh <= 2 && (from.kind === "step" || to.kind === "step")) return true;
  return false;
}

export function walkable(world: World, tx: number, ty: number) {
  if (!inBounds(tx, ty)) return false;
  const t = world.tiles[ty]?.[tx];
  if (!t) return false;
  return kindWalk(t.kind);
}

export function nearestWalkable(world: World, tx: number, ty: number, r = 6) {
  tx = Math.max(0, Math.min(MAP - 1, Math.round(tx)));
  ty = Math.max(0, Math.min(MAP - 1, Math.round(ty)));
  if (walkable(world, tx, ty)) return { x: tx, y: ty };
  for (let d = 1; d <= r; d++) {
    for (let y = ty - d; y <= ty + d; y++) {
      for (let x = tx - d; x <= tx + d; x++) {
        if (Math.abs(x - tx) !== d && Math.abs(y - ty) !== d) continue;
        if (walkable(world, x, y)) return { x, y };
      }
    }
  }
  return null;
}

const DIRS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export function astar(world: World, ax: number, ay: number, bx: number, by: number, cap = 9000) {
  if (!walkable(world, bx, by)) {
    const n = nearestWalkable(world, bx, by);
    if (!n) return null;
    bx = n.x;
    by = n.y;
  }
  const key = (x: number, y: number) => y * MAP + x;
  const open: { x: number; y: number; g: number; f: number }[] = [{ x: ax, y: ay, g: 0, f: Math.hypot(bx - ax, by - ay) }];
  const came = new Map<number, number>();
  const gScore = new Map<number, number>([[key(ax, ay), 0]]);
  const seen = new Set<number>();
  let steps = 0;
  while (open.length && steps++ < cap) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    const ck = key(cur.x, cur.y);
    if (seen.has(ck)) continue;
    seen.add(ck);
    if (cur.x === bx && cur.y === by) {
      const path = [{ x: bx, y: by }];
      let k = ck;
      while (came.has(k)) {
        k = came.get(k)!;
        path.push({ x: k % MAP, y: Math.floor(k / MAP) });
      }
      path.reverse();
      return path;
    }
    const from = world.tiles[cur.y]![cur.x]!;
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!walkable(world, nx, ny)) continue;
      const to = world.tiles[ny]![nx]!;
      if (!climbOk(from, to)) continue;
      const step = Math.hypot(dx, dy) + Math.abs(to.h - from.h) * 0.35;
      const nk = key(nx, ny);
      const g = cur.g + step;
      if (g >= (gScore.get(nk) ?? Infinity)) continue;
      gScore.set(nk, g);
      came.set(nk, ck);
      open.push({ x: nx, y: ny, g, f: g + Math.hypot(bx - nx, by - ny) });
    }
  }
  return null;
}
