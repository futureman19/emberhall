import assert from "node:assert/strict";
import test from "node:test";
import { createPerson, createStubWorld } from "./world.ts";
import { moveObject, placeObject, reclaimObject } from "./placeables/commands.ts";
import { HISTORY_LIMIT, clearHistory, historyState, redo, undo, withHistory } from "./placeables/history.ts";
import type { World } from "./types.ts";

// C1d kit-undo ownership policy: per-actor session journals; no cross-owner
// undo; shared-structure edits are undoable only via the placing actor's
// journal. See .hermes/verification/c1d/undo-policy-map.md.

function fixture() {
  const w = createStubWorld();
  const a = createPerson(w, () => 0.5, { x: 100, z: 100, isPlayer: true });
  const b = createPerson(w, () => 0.5, { x: 100, z: 100 });
  w.people = [a, b];
  w.player.id = a.id;
  w.player.ghost = false;
  const sheet = { ...structuredClone(w.player), id: b.id, ghost: false };
  w.playerStates = { [a.id]: w.player, [b.id]: sheet };
  for (const p of [w.player, sheet]) {
    p.pack.board = 500;
    p.pack.ingot = 50;
  }
  return { w, a, b, sheet };
}

function hash(w: World) {
  return JSON.stringify({ pack: w.player.pack, placed: w.placedObjects, structures: w.structures });
}

test("legacy solo undo/redo restores exact state with omitted id", () => {
  const { w } = fixture();
  const start = hash(w);
  assert.equal(withHistory(w, () => placeObject(w, "floor_timber", 100, 100, 0)), null);
  const placed = hash(w);
  assert.notEqual(placed, start);
  assert.equal(undo(w), null);
  assert.equal(hash(w), start);
  assert.equal(redo(w), null);
  assert.equal(hash(w), placed);
});

test("routing: actor actions journal only to that actor; explicit and omitted solo share one journal", () => {
  const { w, a, b, sheet } = fixture();
  assert.equal(withHistory(w, () => placeObject(w, "floor_timber", 100, 100, 0, { actorId: b.id }), b.id), null);
  // No dual writers: the actor's action never enters the solo journal.
  assert.equal(historyState(w).past.length, 0);
  assert.equal(historyState(w, b.id).past.length, 1);
  // Costs route to the acting actor, not the solo sheet.
  assert.ok(sheet.pack.board < 500);
  assert.equal(w.player.pack.board, 500);
  // Explicit solo id and omitted id resolve to the same journal (no dual solo journals).
  assert.equal(withHistory(w, () => placeObject(w, "floor_timber", 110, 110, 0), a.id), null);
  assert.equal(historyState(w).past.length, 1);
  assert.equal(undo(w), null);
  assert.equal(historyState(w, a.id).past.length, 0);
});

test("actor undo/redo restores placement and pack exactly; other actor untouched", () => {
  const { w, b, sheet } = fixture();
  const start = structuredClone({ pack: sheet.pack, placed: w.placedObjects, structures: w.structures });
  const soloPack = structuredClone(w.player.pack);
  assert.equal(withHistory(w, () => placeObject(w, "floor_timber", 100, 100, 0, { actorId: b.id }), b.id), null);
  assert.equal(undo(w, b.id), null);
  assert.deepEqual({ pack: sheet.pack, placed: w.placedObjects, structures: w.structures }, start);
  assert.deepEqual(w.player.pack, soloPack);
  assert.equal(redo(w, b.id), null);
  assert.equal(w.placedObjects.length, 1);
  assert.equal(w.placedObjects[0]!.ownerId, b.id);
});

test("unknown actor ids fail closed before any mutation", () => {
  const { w, b } = fixture();
  assert.equal(withHistory(w, () => placeObject(w, "floor_timber", 100, 100, 0, { actorId: b.id }), b.id), null);
  const before = structuredClone(w);
  let ran = false;
  assert.throws(() => withHistory(w, () => { ran = true; return null; }, "missing"), /Unknown actor/);
  assert.throws(() => undo(w, "missing"), /Unknown actor/);
  assert.throws(() => redo(w, "missing"), /Unknown actor/);
  assert.throws(() => historyState(w, "missing"), /Unknown actor/);
  assert.throws(() => clearHistory(w, "missing"), /Unknown actor/);
  assert.equal(ran, false);
  assert.deepEqual(structuredClone(w), before);
  assert.equal(historyState(w, b.id).past.length, 1);
});

test("ghost and dead actors are rejected without mutation or journal loss", () => {
  const { w, b, sheet } = fixture();
  assert.equal(withHistory(w, () => placeObject(w, "floor_timber", 100, 100, 0, { actorId: b.id }), b.id), null);
  const before = structuredClone(w);
  sheet.ghost = true;
  assert.equal(undo(w, b.id), "A ghost cannot.");
  sheet.ghost = false;
  b.ghost = true;
  assert.equal(undo(w, b.id), "A ghost cannot.");
  b.ghost = false;
  const hp = b.hp;
  b.hp = 0;
  assert.equal(undo(w, b.id), "No body.");
  b.hp = hp;
  assert.deepEqual(structuredClone(w), before);
  assert.equal(historyState(w, b.id).past.length, 1);
  assert.equal(undo(w, b.id), null);
});

test("stale expected values conflict without popping or mutating, then permit retry", () => {
  const { w, b, sheet } = fixture();
  assert.equal(withHistory(w, () => placeObject(w, "floor_timber", 100, 100, 0, { actorId: b.id }), b.id), null);
  const boards = sheet.pack.board;
  sheet.pack.board += 1; // another write desyncs the journal's expected pack
  const before = structuredClone(w);
  assert.equal(undo(w, b.id), "History conflict.");
  assert.deepEqual(structuredClone(w), before);
  assert.equal(historyState(w, b.id).past.length, 1);
  sheet.pack.board = boards;
  assert.equal(undo(w, b.id), null);
  assert.equal(w.placedObjects.length, 0);
});

test("cross-owner: a callback misrouted to another actor's journal cannot replay", () => {
  const { w, b } = fixture();
  // The action places a SOLO-owned piece but journals it to b — the exact
  // dual-writer routing bug this policy forbids. Replay must fail closed.
  assert.equal(withHistory(w, () => placeObject(w, "floor_timber", 100, 100, 0), b.id), null);
  const before = structuredClone(w);
  assert.equal(undo(w, b.id), "History conflict.");
  assert.deepEqual(structuredClone(w), before);
  assert.equal(historyState(w, b.id).past.length, 1);
  assert.equal(historyState(w).past.length, 0);
});

test("shared-structure edits are undoable only via the placing actor's journal", () => {
  const { w, b } = fixture();
  const tile = structuredClone(w.tiles[100]![100]);
  assert.equal(withHistory(w, () => placeObject(w, "planter_box", 100, 100, 0, { actorId: b.id }), b.id), null);
  assert.ok(w.plots.length > 0);
  // Solo has no journal entry for the actor's shared-terrain edit.
  assert.equal(undo(w), "Nothing to undo.");
  assert.ok(w.plots.length > 0);
  // The placing actor's journal reverts plot and tile deltas exactly.
  assert.equal(undo(w, b.id), null);
  assert.equal(w.plots.length, 0);
  assert.equal(w.placedObjects.length, 0);
  assert.deepEqual(w.tiles[100]![100], tile);
});

test("undo revalidates collision against another actor's intervening construction", () => {
  const { w, b } = fixture();
  placeObject(w, "floor_timber", 100, 100, 0, { actorId: b.id });
  const id = w.placedObjects[0]!.id;
  assert.equal(withHistory(w, () => moveObject(w, id, 110, 110, b.id), b.id), null);
  placeObject(w, "floor_timber", 100, 100, 0); // solo occupies the vacated cell
  const obstacle = w.placedObjects[1]!.id;
  assert.equal(undo(w, b.id), "That ground is taken.");
  assert.equal(w.placedObjects[0]!.tx, 110);
  assert.equal(historyState(w, b.id).past.length, 1);
  assert.equal(reclaimObject(w, obstacle), null);
  assert.equal(undo(w, b.id), null);
  assert.equal(w.placedObjects[0]!.tx, 100);
});

test("ordering: new action clears only that actor's redo stack", () => {
  const { w, b } = fixture();
  assert.equal(withHistory(w, () => placeObject(w, "floor_timber", 100, 100, 0, { actorId: b.id }), b.id), null);
  assert.equal(undo(w, b.id), null);
  assert.equal(historyState(w, b.id).future.length, 1);
  assert.equal(withHistory(w, () => placeObject(w, "floor_timber", 120, 120, 0)), null);
  assert.equal(historyState(w, b.id).future.length, 1);
  assert.equal(withHistory(w, () => placeObject(w, "floor_timber", 130, 130, 0, { actorId: b.id }), b.id), null);
  assert.equal(historyState(w, b.id).future.length, 0);
  assert.equal(redo(w, b.id), "Nothing to redo.");
  assert.equal(historyState(w).past.length, 1);
});

test("lifecycle: per-actor clear, whole-world clear, bounded journals, session-only", () => {
  const { w, b } = fixture();
  assert.equal(withHistory(w, () => placeObject(w, "floor_timber", 100, 100, 0)), null);
  assert.equal(withHistory(w, () => placeObject(w, "floor_timber", 110, 110, 0, { actorId: b.id }), b.id), null);
  clearHistory(w, b.id);
  assert.equal(historyState(w, b.id).past.length, 0);
  assert.equal(historyState(w).past.length, 1);
  clearHistory(w);
  assert.equal(historyState(w).past.length, 0);
  // Bounded per actor.
  for (let i = 0; i <= HISTORY_LIMIT; i++) {
    assert.equal(withHistory(w, () => placeObject(w, "post_beam", 150 + i * 2, 100, 0, { actorId: b.id }), b.id), null);
  }
  assert.equal(historyState(w, b.id).past.length, HISTORY_LIMIT);
  // Session-only: journals never serialize with the world.
  assert.equal(historyState(structuredClone(w), b.id).past.length, 0);
});

test("removed actor cannot replay; re-registered actor resumes its own journal", () => {
  const { w, b, sheet } = fixture();
  assert.equal(withHistory(w, () => placeObject(w, "floor_timber", 100, 100, 0, { actorId: b.id }), b.id), null);
  delete w.playerStates![b.id];
  const before = structuredClone(w);
  assert.throws(() => undo(w, b.id), /Unknown actor/);
  assert.deepEqual(structuredClone(w), before);
  w.playerStates![b.id] = sheet;
  assert.equal(undo(w, b.id), null);
  assert.equal(w.placedObjects.length, 0);
});
