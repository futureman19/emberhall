import { MAP, inBounds } from "./atlas.ts";
import type { Tile, TileKind, World } from "./types.ts";

export type GridPoint = { x: number; y: number };

type SearchNode = GridPoint & { g: number; f: number };

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

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

class MinHeap {
  private readonly items: SearchNode[] = [];

  get size() {
    return this.items.length;
  }

  push(value: SearchNode) {
    const items = this.items;
    items.push(value);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (items[parent]!.f <= value.f) break;
      items[index] = items[parent]!;
      index = parent;
    }
    items[index] = value;
  }

  pop() {
    const items = this.items;
    const first = items[0];
    const last = items.pop();
    if (!first || !last || items.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= items.length) break;
      const right = left + 1;
      const child = right < items.length && items[right]!.f < items[left]!.f ? right : left;
      if (items[child]!.f >= last.f) break;
      items[index] = items[child]!;
      index = child;
    }
    items[index] = last;
    return first;
  }
}

function key(x: number, y: number) {
  return y * MAP + x;
}

function canStep(world: World, x: number, y: number, nx: number, ny: number) {
  const dx = nx - x;
  const dy = ny - y;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (dx === 0 && dy === 0)) return false;
  if (!walkable(world, nx, ny)) return false;
  const from = world.tiles[y]?.[x];
  const to = world.tiles[ny]?.[nx];
  if (!from || !to || !climbOk(from, to)) return false;
  // A diagonal is legal only when its two cardinal shoulders are open. This
  // keeps characters from squeezing through the touching corners of walls.
  if (dx !== 0 && dy !== 0 && (!walkable(world, x + dx, y) || !walkable(world, x, y + dy))) return false;
  return true;
}

/** True when a straight tile-center segment obeys the same rules as A*. */
export function lineWalkable(world: World, ax: number, ay: number, bx: number, by: number) {
  if (!inBounds(ax, ay) || !inBounds(bx, by) || !walkable(world, bx, by)) return false;
  let x = ax;
  let y = ay;
  const dx = bx - ax;
  const dy = by - ay;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const deltaX = dx === 0 ? Infinity : 1 / Math.abs(dx);
  const deltaY = dy === 0 ? Infinity : 1 / Math.abs(dy);
  let maxX = dx === 0 ? Infinity : deltaX / 2;
  let maxY = dy === 0 ? Infinity : deltaY / 2;

  while (x !== bx || y !== by) {
    let nx = x;
    let ny = y;
    if (Math.abs(maxX - maxY) < 1e-9) {
      nx += stepX;
      ny += stepY;
      maxX += deltaX;
      maxY += deltaY;
    } else if (maxX < maxY) {
      nx += stepX;
      maxX += deltaX;
    } else {
      ny += stepY;
      maxY += deltaY;
    }
    if (!canStep(world, x, y, nx, ny)) return false;
    x = nx;
    y = ny;
  }
  return true;
}

function smoothPath(world: World, path: GridPoint[]) {
  if (path.length <= 2) return path;
  const smooth: GridPoint[] = [path[0]!];
  let anchor = 0;
  while (anchor < path.length - 1) {
    let next = path.length - 1;
    while (next > anchor + 1) {
      const a = path[anchor]!;
      const b = path[next]!;
      if (lineWalkable(world, a.x, a.y, b.x, b.y)) break;
      next -= 1;
    }
    smooth.push(path[next]!);
    anchor = next;
  }
  return smooth;
}

function reconstruct(came: Map<number, number>, endKey: number) {
  const path: GridPoint[] = [];
  let cursor = endKey;
  while (true) {
    path.push({ x: cursor % MAP, y: Math.floor(cursor / MAP) });
    const parent = came.get(cursor);
    if (parent === undefined) break;
    cursor = parent;
  }
  path.reverse();
  return path;
}

function search(
  world: World,
  ax: number,
  ay: number,
  isGoal: (x: number, y: number) => boolean,
  heuristic: (x: number, y: number) => number,
  cap: number,
) {
  ax = Math.max(0, Math.min(MAP - 1, Math.round(ax)));
  ay = Math.max(0, Math.min(MAP - 1, Math.round(ay)));
  const startKey = key(ax, ay);
  const open = new MinHeap();
  open.push({ x: ax, y: ay, g: 0, f: heuristic(ax, ay) });
  const came = new Map<number, number>();
  const gScore = new Map<number, number>([[startKey, 0]]);
  const closed = new Set<number>();
  let steps = 0;

  while (open.size && steps++ < cap) {
    const cur = open.pop()!;
    const curKey = key(cur.x, cur.y);
    if (closed.has(curKey) || cur.g !== gScore.get(curKey)) continue;
    closed.add(curKey);
    if (isGoal(cur.x, cur.y)) return smoothPath(world, reconstruct(came, curKey)).slice(1);

    const from = world.tiles[cur.y]?.[cur.x];
    if (!from) continue;
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!canStep(world, cur.x, cur.y, nx, ny)) continue;
      const to = world.tiles[ny]![nx]!;
      const step = Math.hypot(dx, dy) + Math.abs(to.h - from.h) * 0.35;
      const nextKey = key(nx, ny);
      const g = cur.g + step;
      if (g >= (gScore.get(nextKey) ?? Infinity)) continue;
      gScore.set(nextKey, g);
      came.set(nextKey, curKey);
      open.push({ x: nx, y: ny, g, f: g + heuristic(nx, ny) });
    }
  }
  return null;
}

function octile(ax: number, ay: number, bx: number, by: number) {
  const dx = Math.abs(bx - ax);
  const dy = Math.abs(by - ay);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

/** Find a corner-safe, smoothed route. Returned waypoints never include start. */
export function astar(world: World, ax: number, ay: number, bx: number, by: number, cap = 9000) {
  bx = Math.max(0, Math.min(MAP - 1, Math.round(bx)));
  by = Math.max(0, Math.min(MAP - 1, Math.round(by)));
  if (!walkable(world, bx, by)) {
    const nearest = nearestWalkable(world, bx, by);
    if (!nearest) return null;
    bx = nearest.x;
    by = nearest.y;
  }
  return search(world, ax, ay, (x, y) => x === bx && y === by, (x, y) => octile(x, y, bx, by), cap);
}

/** Route to a reachable ring around an interaction or moving target. */
export function astarToRange(
  world: World,
  ax: number,
  ay: number,
  tx: number,
  ty: number,
  maxRange: number,
  cap = 9000,
  minRange = 0.7,
) {
  tx = Math.round(tx);
  ty = Math.round(ty);
  const goal = (x: number, y: number) => {
    const distance = Math.hypot(tx - x, ty - y);
    return walkable(world, x, y) && distance >= minRange && distance <= maxRange;
  };
  const heuristic = (x: number, y: number) => Math.max(0, Math.hypot(tx - x, ty - y) - maxRange);
  return search(world, ax, ay, goal, heuristic, cap);
}
