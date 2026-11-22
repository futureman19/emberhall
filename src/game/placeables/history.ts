import { actorPerson, actorState } from "../actor.ts";
import type { ItemId, World } from "../types.ts";
import type { PlacedObject } from "./schema.ts";
import { canPlace } from "./placement.ts";

export const HISTORY_LIMIT = 100;
type Change<T> = { key: string; before: T | undefined; after: T | undefined; index: number };
type Entry = {
  pack: Change<number>[];
  placed: Change<PlacedObject>[];
  structures: Change<World["structures"][number]>[];
  plots: Change<World["plots"][number]>[];
  scars: Change<World["scars"][string]>[];
  tiles: Change<World["tiles"][number][number]["kind"]>[];
};
type Session = { past: Entry[]; future: Entry[] };
const sessions = new WeakMap<World, Map<string, Session>>();

function session(world: World, actorId?: string): Session {
  const id = actorState(world, actorId).id;
  let actors = sessions.get(world);
  if (!actors) { actors = new Map(); sessions.set(world, actors); }
  let s = actors.get(id);
  if (!s) { s = { past: [], future: [] }; actors.set(id, s); }
  return s;
}
function eligible(world: World, actorId?: string) {
  const player = actorState(world, actorId);
  const body = actorPerson(world, actorId);
  if (player.ghost || body?.ghost) return "A ghost cannot.";
  if (actorId !== undefined && (!body || body.hp <= 0)) return "No body.";
  return null;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function changes<T>(before: Record<string, T>, after: Record<string, T>): Change<T>[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(key => !same(before[key], after[key]))
    .map(key => ({ key, before: before[key], after: after[key], index: Object.keys(before).indexOf(key) }));
}
function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map(item => [item.id, structuredClone(item)]));
}
function snap(world: World, actorId?: string) {
  return {
    pack: { ...actorState(world, actorId).pack },
    placed: byId(world.placedObjects), structures: byId(world.structures), plots: byId(world.plots),
    scars: structuredClone(world.scars),
    // Transient read set only; history retains changed cells, never a grid/array snapshot.
    tiles: world.tiles.map(row => row.map(tile => tile.kind)),
  };
}
export function historyState(world: World, actorId?: string) {
  return structuredClone(session(world, actorId));
}
export function clearHistory(world: World, actorId?: string) {
  // Lifecycle: an omitted id wipes every journal for the world (the legacy
  // reset/load contract); an explicit id wipes only that actor's journal.
  if (actorId === undefined) {
    sessions.delete(world);
    return;
  }
  const id = actorState(world, actorId).id;
  sessions.get(world)?.delete(id);
}
export function withHistory(world: World, action: () => string | null | undefined, actorId?: string): string | null {
  const blocked = eligible(world, actorId);
  if (blocked) return blocked;
  const before = snap(world, actorId);
  const err = action();
  if (err) return err;
  const after = snap(world, actorId);
  const tiles: Entry["tiles"] = [];
  for (let y = 0; y < before.tiles.length; y++) for (let x = 0; x < before.tiles[y]!.length; x++) {
    if (before.tiles[y]![x] !== after.tiles[y]?.[x]) tiles.push({ key: `${x},${y}`, before: before.tiles[y]![x], after: after.tiles[y]?.[x], index: -1 });
  }
  const entry: Entry = { pack: changes(before.pack, after.pack), placed: changes(before.placed, after.placed),
    structures: changes(before.structures, after.structures), plots: changes(before.plots, after.plots),
    scars: changes(before.scars, after.scars), tiles };
  const s = session(world, actorId);
  s.future = [];
  s.past.push(entry);
  if (s.past.length > HISTORY_LIMIT) s.past.shift();
  return null;
}
function matches<T>(deltas: Change<T>[], get: (key: string) => T | undefined, side: "before" | "after") {
  return deltas.every(d => same(get(d.key), d[side]));
}
function applyArray<T extends { id: string }>(items: T[], deltas: Change<T>[], side: "before" | "after") {
  for (const d of deltas) {
    const i = items.findIndex(item => item.id === d.key);
    const value = d[side];
    if (value === undefined) { if (i >= 0) items.splice(i, 1); }
    else if (i >= 0) items[i] = structuredClone(value);
    else items.splice(side === "before" && d.index >= 0 ? d.index : items.length, 0, structuredClone(value));
  }
}
function replay(world: World, actorId: string | undefined, forward: boolean): string | null {
  const blocked = eligible(world, actorId);
  if (blocked) return blocked;
  const s = session(world, actorId);
  const from = forward ? s.future : s.past;
  const to = forward ? s.past : s.future;
  const e = from.at(-1);
  if (!e) return forward ? "Nothing to redo." : "Nothing to undo.";
  const expected = forward ? "before" : "after";
  const target = forward ? "after" : "before";
  const player = actorState(world, actorId);
  const tileAt = (key: string) => { const [x, y] = key.split(",").map(Number); return world.tiles[y!]?.[x!]; };
  // A callback is not authority to replay another owner's changes.
  if ([...e.placed, ...e.structures].some(d =>
    (d.before && d.before.ownerId !== player.id) || (d.after && d.after.ownerId !== player.id))) return "History conflict.";
  if (!matches(e.pack, key => player.pack[key as ItemId], expected)
    || !matches(e.placed, key => world.placedObjects.find(o => o.id === key), expected)
    || !matches(e.structures, key => world.structures.find(o => o.id === key), expected)
    || !matches(e.plots, key => world.plots.find(o => o.id === key), expected)
    || !matches(e.scars, key => world.scars[key], expected)
    || !matches(e.tiles, key => tileAt(key)?.kind, expected)) return "History conflict.";
  const changedPlots = new Set(e.plots.map(d => d.key));
  for (const d of e.plots) {
    const plot = d[target];
    if (plot && world.plots.some(p => !changedPlots.has(p.id) && p.tx === plot.tx && p.ty === plot.ty)) return "History conflict.";
  }
  // Validate the proposed final placement set without touching the live arrays.
  const affected = new Set(e.placed.map(d => d.key));
  const proposed = world.placedObjects.filter(o => !affected.has(o.id));
  const view = { ...world, placedObjects: proposed };
  for (const d of e.placed) {
    const obj = d[target];
    if (!obj) continue;
    if (obj.ownerId !== player.id) return "History conflict.";
    const err = canPlace(view, obj.definitionId, obj.tx, obj.ty, obj.rotation, { skipCost: true, actorId });
    if (err) return err;
    proposed.push(obj);
  }
  for (const d of e.pack) {
    if (d[target] === undefined) delete player.pack[d.key as ItemId];
    else player.pack[d.key as ItemId] = d[target]!;
  }
  applyArray(world.placedObjects, e.placed, target);
  applyArray(world.structures, e.structures, target);
  applyArray(world.plots, e.plots, target);
  for (const d of e.scars) {
    if (d[target] === undefined) delete world.scars[d.key];
    else world.scars[d.key] = structuredClone(d[target]!);
  }
  for (const d of e.tiles) tileAt(d.key)!.kind = d[target]!;
  if (e.tiles.length || e.plots.length) world.landRev += 1;
  from.pop(); to.push(e);
  return null;
}
export function undo(world: World, actorId?: string): string | null { return replay(world, actorId, false); }
export function redo(world: World, actorId?: string): string | null { return replay(world, actorId, true); }
