/**
 * Ambient determinism — the survival replay oracle's source guarantee.
 *
 * The strict traceHash of the water-survival replay covers every observation
 * (vitals, position, water, day/night) AND the offered verb menu with its
 * multiplicity. Ambient NPC/fauna wander used unseeded Math.random(), so two
 * fresh boots of one seed offered different counts of talk/walk/hunt/tame/
 * cast/fireball and the strict hash could never match. These tests pin the
 * fix: ambient rolls are a pure function of (seed, tickCount, entity id,
 * purpose), so identical seeds replay bit-identically — and a real world
 * divergence still changes the menu (the oracle stays sensitive).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "./world.ts";
import { tickWorld } from "./sim.ts";
import { spawn, strikePlayer } from "./ecology.ts";
import { you } from "./player.ts";
import { candidatesFor, AGENT_MENU_RADIUS } from "./agent/candidates.ts";
import { hashKey, tickRng } from "./rng.ts";
import { encodeSave, decodeSave } from "./save.ts";
import type { World } from "./types.ts";

const SEED = 424242;

function player(w: World) {
  const p = you(w);
  assert.ok(p, "world has a player");
  return p;
}

/** Compact ambient state: every wanderer's position, route and task clock. */
function ambientSnapshot(w: World): string {
  return JSON.stringify({
    people: w.people.map((p) => [p.id, p.x, p.z, p.path]),
    fauna: w.fauna.map((c) => [c.id, c.x, c.z, c.task, c.taskUntil, c.path]),
  });
}

/** The offered verb menu WITH multiplicity, on a clone (labeling may record
 * resource-node discoveries; the ticking worlds must stay untouched). */
function verbMenu(w: World): string[] {
  return candidatesFor(structuredClone(w), undefined, AGENT_MENU_RADIUS).map((c) => c.verb);
}

test("tickRng is a pure key stream: same key, same draws, any order", () => {
  const a = tickRng(SEED, 100, "npc-1", "wander");
  const b = tickRng(SEED, 100, "npc-1", "wander");
  const drawsA = Array.from({ length: 8 }, () => a());
  const drawsB = Array.from({ length: 8 }, () => b());
  assert.deepEqual(drawsA, drawsB);
  for (const v of drawsA) assert.ok(v >= 0 && v < 1);

  // Every key part changes the stream.
  const base = tickRng(SEED, 100, "npc-1", "wander")();
  assert.notEqual(tickRng(SEED + 1, 100, "npc-1", "wander")(), base);
  assert.notEqual(tickRng(SEED, 101, "npc-1", "wander")(), base);
  assert.notEqual(tickRng(SEED, 100, "npc-2", "wander")(), base);
  assert.notEqual(tickRng(SEED, 100, "npc-1", "venom")(), base);

  // Order independence: interleaving other entities' draws changes nothing.
  const x1 = tickRng(SEED, 7, "a", "wander");
  const y1 = tickRng(SEED, 7, "b", "wander");
  const first = [x1(), y1(), x1(), y1()];
  const x2 = tickRng(SEED, 7, "a", "wander");
  const y2 = tickRng(SEED, 7, "b", "wander");
  const second = [y2(), x2(), y2(), x2()];
  assert.deepEqual([first[0], first[2]], [second[1], second[3]]);
  assert.deepEqual([first[1], first[3]], [second[0], second[2]]);

  // hashKey is stable and part-sensitive.
  assert.equal(hashKey(1, 2, "a"), hashKey(1, 2, "a"));
  assert.notEqual(hashKey(1, 2, "a"), hashKey(1, 2, "b"));
  assert.notEqual(hashKey(1, 2, "a"), hashKey(2, 1, "a"));
});

test("same-seed fresh boots tick to identical ambient trajectories", () => {
  const w1 = createWorld(SEED);
  const w2 = createWorld(SEED);
  assert.equal(ambientSnapshot(w1), ambientSnapshot(w2), "initial world");
  let moved = false;
  const start = ambientSnapshot(w1);
  for (let i = 0; i < 600; i++) {
    tickWorld(w1, 0.1);
    tickWorld(w2, 0.1);
    assert.equal(ambientSnapshot(w1), ambientSnapshot(w2), `tick ${i + 1}`);
  }
  moved = ambientSnapshot(w1) !== start;
  assert.ok(moved, "ambient wander must still move (fix seeds, not freezes)");
});

test("verb-offer menus with multiplicity match across same-seed boots", () => {
  const w1 = createWorld(SEED);
  const w2 = createWorld(SEED);
  assert.deepEqual(verbMenu(w1), verbMenu(w2), "tick 0 menu");
  for (let i = 1; i <= 600; i++) {
    tickWorld(w1, 0.1);
    tickWorld(w2, 0.1);
    if (i % 150 === 0) {
      assert.deepEqual(verbMenu(w1), verbMenu(w2), `tick ${i} menu`);
    }
  }
});

test("a different seed still diverges (determinism is per-seed, not frozen)", () => {
  const w1 = createWorld(SEED);
  const w3 = createWorld(SEED + 1);
  for (let i = 0; i < 600; i++) {
    tickWorld(w1, 0.1);
    tickWorld(w3, 0.1);
  }
  assert.notEqual(ambientSnapshot(w1), ambientSnapshot(w3));
});

test("spider venom is tick-keyed: both outcomes replay identically", () => {
  // Find one tick whose venom roll poisons and one whose roll does not.
  const probe = createWorld(SEED);
  const spiderProbe = spawn(probe, "stonecrawl_spider", 10, 10);
  let yesTick = -1;
  let noTick = -1;
  for (let t = 0; t < 400 && (yesTick < 0 || noTick < 0); t++) {
    const roll = tickRng(SEED, t, spiderProbe.id, "venom")();
    if (roll < 0.35 && yesTick < 0) yesTick = t;
    if (roll >= 0.35 && noTick < 0) noTick = t;
  }
  assert.ok(yesTick >= 0 && noTick >= 0, "both venom outcomes exist");

  for (const [tick, poisons] of [[yesTick, true], [noTick, false]] as const) {
    const wa = createWorld(SEED);
    const wb = createWorld(SEED);
    const sa = spawn(wa, "stonecrawl_spider", player(wa).x + 1, player(wa).z);
    const sb = spawn(wb, "stonecrawl_spider", player(wb).x + 1, player(wb).z);
    assert.equal(sa.id, sb.id, "same boot state gives the same creature id");
    wa.tickCount = tick;
    wb.tickCount = tick;
    strikePlayer(wa, sa, player(wa));
    strikePlayer(wb, sb, player(wb));
    assert.equal(wa.player.poisonUntil ?? 0, wb.player.poisonUntil ?? 0);
    if (poisons) {
      assert.ok((wa.player.poisonUntil ?? 0) > wa.hour, `tick ${tick} must poison`);
    } else {
      assert.equal(wa.player.poisonUntil ?? 0, 0, `tick ${tick} must not poison`);
    }
  }
});

test("a real world divergence changes the verb menu (oracle sensitivity)", () => {
  const w = createWorld(SEED);
  w.player.pack.spellbook = 1; // cast/fireball offers require a spellbook
  for (let i = 0; i < 100; i++) tickWorld(w, 0.1);
  const baseline = verbMenu(w);
  // A beast appears beside the player: hunt/tame/cast/fireball offers must
  // appear. A safety-relevant world change cannot hide behind the oracle.
  const p = player(w);
  w.fauna.push(spawn(w, "wolf", p.x + 1, p.z));
  const perturbed = verbMenu(w);
  assert.notDeepEqual(perturbed, baseline);
  for (const verb of ["hunt", "tame", "cast", "fireball"]) {
    assert.ok(perturbed.includes(verb), `divergence must offer ${verb}`);
  }
});

test("save/load round-trip preserves the ambient stream", () => {
  const w1 = createWorld(SEED);
  for (let i = 0; i < 200; i++) tickWorld(w1, 0.1);
  const decoded = decodeSave(encodeSave(w1));
  assert.ok(decoded, "save must decode");
  assert.equal(decoded.seed, w1.seed);
  assert.equal(decoded.tickCount, w1.tickCount);
  assert.equal(ambientSnapshot(decoded), ambientSnapshot(w1), "state at save");
  for (let i = 0; i < 200; i++) {
    tickWorld(w1, 0.1);
    tickWorld(decoded, 0.1);
    assert.equal(ambientSnapshot(w1), ambientSnapshot(decoded), `post-load tick ${i + 1}`);
  }
});