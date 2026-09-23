import type { ItemId, World } from "../types.ts";
import type { PlacedObject, Structure } from "./schema.ts";

export const HISTORY_LIMIT = 100;

type Snap = {
  pack: Record<ItemId, number>;
  placed: PlacedObject[];
  structures: Structure[];
};

type Entry = {
  before: Snap;
  after: Snap;
};

type Session = {
  past: Entry[];
  future: Entry[];
};

const sessions = new WeakMap<World, Session>();

function session(world: World): Session {
  let s = sessions.get(world);
  if (!s) {
    s = { past: [], future: [] };
    sessions.set(world, s);
  }
  return s;
}

function snap(world: World): Snap {
  return {
    pack: { ...world.player.pack },
    placed: structuredClone(world.placedObjects),
    structures: structuredClone(world.structures),
  };
}

function restore(world: World, shot: Snap) {
  world.player.pack = { ...shot.pack };
  world.placedObjects = structuredClone(shot.placed);
  world.structures = structuredClone(shot.structures);
}

export function historyState(world: World) {
  const s = session(world);
  return { past: s.past, future: s.future };
}

export function clearHistory(world: World) {
  sessions.delete(world);
}

export function withHistory(world: World, action: () => string | null | undefined): string | null {
  const before = snap(world);
  const err = action();
  if (err) return err;
  const after = snap(world);
  const s = session(world);
  s.future = [];
  s.past.push({ before, after });
  if (s.past.length > HISTORY_LIMIT) s.past.shift();
  return null;
}

export function undo(world: World): string | null {
  const s = session(world);
  const entry = s.past.pop();
  if (!entry) return "Nothing to undo.";
  restore(world, entry.before);
  s.future.push(entry);
  return null;
}

export function redo(world: World): string | null {
  const s = session(world);
  const entry = s.future.pop();
  if (!entry) return "Nothing to redo.";
  restore(world, entry.after);
  s.past.push(entry);
  return null;
}
