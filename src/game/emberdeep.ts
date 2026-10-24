import type { Tile, World } from "./types.ts";
import { walkable } from "./pathfinding.ts";
import { revealAround } from "./world.ts";

/** Versioned authored footprint. Coordinates never depend on runtime RNG.
 * The remote, enclosed footprint mirrors Greybarrow's shared-world terrain;
 * the entrance is on the Hollowvein road, outside existing prop footprints. */
export const EMBERDEEP_VERSION = 1;
export const EMBERDEEP_ENTRY = { tx: 650, ty: 565 } as const;
export const EMBERDEEP_EXIT = { tx: 1010, ty: 674 } as const;
export const EMBERDEEP_BOUNDS = { x0: 998, x1: 1122, y0: 648, y1: 730 } as const;
export const EMBERDEEP_ROOMS = [
  { id: "entrance", name: "Threshold Hall", tx: 1010, ty: 674, rx: 8, ry: 9 },
  { id: "cinder", name: "Cinder Gallery", tx: 1038, ty: 674, rx: 10, ry: 12 },
  { id: "cistern", name: "The Dry Cistern", tx: 1038, ty: 712, rx: 11, ry: 10 },
  { id: "forge", name: "Silent Forge", tx: 1073, ty: 712, rx: 12, ry: 10 },
  { id: "vault", name: "Ashen Vault", tx: 1073, ty: 674, rx: 11, ry: 12 },
  { id: "furnace", name: "The Sealed Furnace", tx: 1106, ty: 674, rx: 12, ry: 14 },
] as const;
export type EmberdeepRoomId = (typeof EMBERDEEP_ROOMS)[number]["id"];
export interface EmberdeepState {
  version: 1;
  visited: EmberdeepRoomId[];
  cleared: EmberdeepRoomId[];
  bossDoorOpen: boolean;
}
export const EMBERDEEP_CORRIDORS = [
  { x0: 1018, x1: 1028, y0: 672, y1: 676 },
  { x0: 1036, x1: 1040, y0: 686, y1: 702 },
  { x0: 1049, x1: 1061, y0: 710, y1: 714 },
  { x0: 1071, x1: 1075, y0: 686, y1: 702 },
  { x0: 1084, x1: 1094, y0: 672, y1: 676 },
] as const;
export const EMBERDEEP_GATE = { tx: 1089, y0: 672, y1: 676 } as const;
export const EMBERDEEP_ANCHORS = [
  ...EMBERDEEP_ROOMS.flatMap(room => [
    { id: `emberdeep:${room.id}:center`, roomId: room.id, role: "chamber" as const, tx: room.tx, ty: room.ty },
    { id: `emberdeep:${room.id}:guard`, roomId: room.id, role: "guard" as const, tx: room.tx + 3, ty: room.ty + 3 },
  ]),
  ...EMBERDEEP_CORRIDORS.map((c, i) => ({ id: `emberdeep:corridor:${i}`, roomId: EMBERDEEP_ROOMS[i]!.id, role: "corridor" as const, tx: Math.min(EMBERDEEP_GATE.tx - 2, Math.floor((c.x0 + c.x1) / 2)), ty: Math.floor((c.y0 + c.y1) / 2) })),
] as const;
export function inEmberdeep(x: number, z: number) {
  const b = EMBERDEEP_BOUNDS;
  return x >= b.x0 && x <= b.x1 && z >= b.y0 && z <= b.y1;
}
export function emberdeepRoomAt(x: number, z: number) {
  return EMBERDEEP_ROOMS.find(r => Math.abs(x - r.tx) <= r.rx && Math.abs(z - r.ty) <= r.ry) ?? null;
}
export function emberdeepFloor(x: number, z: number) {
  return !!emberdeepRoomAt(x, z) || EMBERDEEP_CORRIDORS.some(c => x >= c.x0 && x <= c.x1 && z >= c.y0 && z <= c.y1);
}
export function emberdeepState(w: World): EmberdeepState {
  return w.emberdeep ??= { version: 1, visited: [], cleared: [], bossDoorOpen: false };
}
export function isEmberdeepState(value: unknown): value is EmberdeepState {
  if (!value || typeof value !== "object") return false;
  const v = value as EmberdeepState;
  const ids = new Set<string>(EMBERDEEP_ROOMS.map(r => r.id));
  const valid = (a: unknown) => Array.isArray(a) && a.every(id => typeof id === "string" && ids.has(id)) && new Set(a).size === a.length;
  return v.version === 1 && typeof v.bossDoorOpen === "boolean" && valid(v.visited) && valid(v.cleared) && v.cleared.every(id => v.visited.includes(id));
}
/** Canonical collision survives scars, flight and a reloaded tile-free save. */
export function emberdeepBlocked(w: World, x: number, z: number) {
  if (!inEmberdeep(x, z)) return false;
  if (!emberdeepFloor(x, z)) return true;
  return !w.emberdeep?.bossDoorOpen && x >= EMBERDEEP_GATE.tx;
}
export function stampEmberdeep(tiles: Tile[][]) {
  const b = EMBERDEEP_BOUNDS;
  for (let z = b.y0; z <= b.y1; z++) for (let x = b.x0; x <= b.x1; x++) {
    if (tiles[z]?.[x]) tiles[z]![x] = { h: 0, kind: emberdeepFloor(x, z) ? "cobble" : "wall" };
  }
  // Three-wide spur meets the existing road without changing its height.
  const h = tiles[560]?.[EMBERDEEP_ENTRY.tx]?.h ?? 1;
  for (let z = 561; z <= 568; z++) for (let x = 648; x <= 652; x++) {
    if (tiles[z]?.[x]) tiles[z]![x] = { h, kind: "cobble" };
  }
}
export function visitEmberdeep(w: World) {
  const p = w.people.find(p => p.isPlayer);
  if (!p || !inEmberdeep(p.x, p.z)) return;
  const room = emberdeepRoomAt(p.x, p.z);
  const state = emberdeepState(w);
  if (room && !state.visited.includes(room.id)) state.visited.push(room.id);
}
/** Monster cards call this after authoritative room-clear resolution. */
export function clearEmberdeepRoom(w: World, id: EmberdeepRoomId) {
  if (!EMBERDEEP_ROOMS.some(r => r.id === id)) return false;
  const s = emberdeepState(w);
  if (!s.visited.includes(id)) s.visited.push(id);
  if (!s.cleared.includes(id)) s.cleared.push(id);
  return true;
}
function transition(w: World, source: { tx: number; ty: number }, dest: { tx: number; ty: number }) {
  const p = w.people.find(p => p.isPlayer);
  if (!p || Math.hypot(p.x - source.tx, p.z - source.ty) > 3) return "Walk to the stair first.";
  // Check actual arrival terrain too: a player construction must not trap travel.
  if (!walkable(w, dest.tx, dest.ty)) return "The stair is blocked.";
  p.x = dest.tx; p.z = dest.ty; p.path = []; p.story = 0; p.task = "idle";
  w.player.intent.kind = "none";
  w.player.workT = 0;
  // Following pets use the same safe arrival; stay/dead companions remain behind.
  for (const c of w.fauna) if (c.ownerId === w.player.id && !c.stay && c.task !== "dead") {
    c.x = dest.tx; c.z = dest.ty; c.path = [];
  }
  visitEmberdeep(w);
  revealAround(w, dest.tx, dest.ty, 22);
  return null;
}
export function enterEmberdeep(w: World) { return transition(w, EMBERDEEP_ENTRY, EMBERDEEP_EXIT); }
export function leaveEmberdeep(w: World) { return transition(w, EMBERDEEP_EXIT, EMBERDEEP_ENTRY); }
