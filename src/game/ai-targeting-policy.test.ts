import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "./world.ts";
import { ensureEmberdeepMonsters, tickEmberdeepMonster } from "./emberdeep-monsters.ts";
import { ensureGloomwraiths, tickGloomwraith, GLOOM_SPAWNS } from "./gloomwraith.ts";
import { spawn, strikePlayer } from "./ecology.ts";
import { tickWarden } from "./furnace-warden.ts";
import { emberdeepState } from "./emberdeep.ts";

/**
 * C1d ownership lock: AI target acquisition is sim authority with
 * current-target semantics (controller policy, t_f37cd205) — the legacy
 * isPlayer-first body, validated gates, windup position locks, cancellation
 * without transfer on invalidation. The multi-actor threat table is deferred
 * to the host and must NOT appear here. Characterization tests: expected to
 * pass on first run. See docs/actor-ownership-weather-ai.md.
 */

function golemFixture() {
  const w = createWorld(41);
  ensureEmberdeepMonsters(w);
  const c = w.fauna.find((f) => f.kind === "slag_golem")!;
  const p = w.people.find((pl) => pl.isPlayer)!;
  p.hp = p.maxHp = 100;
  w.player.invisUntil = 0;
  return { w, c, p };
}

test("acquisition picks the legacy isPlayer body, never a nearer bystander", () => {
  const { w, c, p } = golemFixture();
  const npc = w.people.find((pl) => !pl.isPlayer)!;
  npc.hp = npc.maxHp = 100;
  // The bystander stands closer to the golem than the player does.
  npc.x = c.x + 1; npc.z = c.z;
  p.x = c.x + 2; p.z = c.z;

  tickEmberdeepMonster(w, c, 0.01);
  assert.equal(c.task, "fight");
  assert.equal(c.monster?.phase, "windup");
  assert.equal(c.monster?.targetX, p.x, "locked onto the player, not the nearer NPC");
  assert.equal(c.monster?.targetZ, p.z);

  // Let the windup land: only the player's sheet takes the slam.
  tickEmberdeepMonster(w, c, 0.5);
  tickEmberdeepMonster(w, c, 0.5);
  tickEmberdeepMonster(w, c, 0.2);
  assert.ok(p.hp < 100, `the slam lands on the acquired body: ${p.hp}`);
  assert.equal(npc.hp, 100, "the nearer bystander is untouched");
});

test("ghosted, invisible or departed marks are dropped, never finished off", () => {
  // Ghost mid-windup: phase resets, no strike ever resolves.
  const g = golemFixture();
  g.p.x = g.c.x + 2; g.p.z = g.c.z;
  tickEmberdeepMonster(g.w, g.c, 0.01);
  assert.equal(g.c.monster?.phase, "windup");
  g.p.ghost = true;
  tickEmberdeepMonster(g.w, g.c, 0.01);
  assert.equal(g.c.task, "wander");
  assert.equal(g.c.monster?.phase, "patrol");
  for (let i = 0; i < 10; i++) tickEmberdeepMonster(g.w, g.c, 0.2);
  assert.equal(g.p.hp, 100, "a ghost is never struck");

  // Invisible: never acquired in the first place.
  const inv = golemFixture();
  inv.p.x = inv.c.x + 2; inv.p.z = inv.c.z;
  inv.w.player.invisUntil = inv.w.hour + 5;
  tickEmberdeepMonster(inv.w, inv.c, 0.01);
  assert.equal(inv.c.task, "wander");
  assert.equal(inv.c.monster?.phase, "patrol");

  // Stepped out of the deep: acquired, then dropped on the next beat.
  const out = golemFixture();
  out.p.x = out.c.x + 2; out.p.z = out.c.z;
  tickEmberdeepMonster(out.w, out.c, 0.01);
  assert.equal(out.c.task, "fight");
  out.p.x = 256; out.p.z = 292; // the court, far above the deep
  tickEmberdeepMonster(out.w, out.c, 0.01);
  assert.equal(out.c.task, "wander");
  assert.equal(out.c.monster?.phase, "patrol");
  for (let i = 0; i < 10; i++) tickEmberdeepMonster(out.w, out.c, 0.2);
  assert.equal(out.p.hp, 100, "no strike follows a departed mark");
});

test("a stale strike loaded from an old save is cancelled, never transferred", () => {
  // Post-load state: the mark ghosted while the game was away. The stale
  // strike points at a tile where an innocent bystander now stands.
  const dead = golemFixture();
  const npc = dead.w.people.find((pl) => !pl.isPlayer)!;
  npc.hp = npc.maxHp = 100;
  npc.x = dead.c.x + 1; npc.z = dead.c.z;
  dead.c.monster = { phase: "strike", time: 0, targetX: npc.x, targetZ: npc.z };
  dead.p.ghost = true;
  for (let i = 0; i < 5; i++) tickEmberdeepMonster(dead.w, dead.c, 0.2);
  assert.equal(npc.hp, 100, "strike never transfers to the bystander on the old lock");
  assert.equal(dead.p.hp, 100, "nor finishes the ghosted mark");
  assert.equal(dead.c.monster?.phase, "patrol", "stale phase reset");

  // Live mark, stale lock: the save caught a windup aimed at where the
  // player no longer stands. The strike frame evaluates and whiffs.
  const moved = golemFixture();
  moved.p.x = moved.c.x + 2; moved.p.z = moved.c.z;
  moved.c.monster = { phase: "strike", time: 0, targetX: moved.p.x - 5, targetZ: moved.p.z };
  tickEmberdeepMonster(moved.w, moved.c, 0.2);
  assert.equal(moved.p.hp, 100, "a stale lock whiffs");
  assert.equal(moved.c.monster?.phase, "recover", "the whiffed strike spends itself");
});

test("the Furnace Warden only fights inside a live encounter", () => {
  const w = createWorld(41);
  const p = w.people.find((pl) => pl.isPlayer)!;
  p.hp = p.maxHp = 500;
  w.player.invisUntil = 0;
  const c = spawn(w, "furnace_warden", 1106, 674);
  w.fauna.push(c);
  p.x = 1106; p.z = 676; // inside the furnace room, in reach

  // No encounter state at all: the warden stands down.
  tickWarden(w, c, 0.01);
  const idleWithoutEncounter = c.monster === undefined;
  assert.ok(idleWithoutEncounter, "no encounter, no windup");
  assert.equal(p.hp, 500);
  assert.notEqual(c.task, "fight");

  // Encounter known but not fighting: still stands down.
  const state = emberdeepState(w);
  state.bossEncounter = "ready";
  tickWarden(w, c, 0.01);
  const idleWhenReady = c.monster === undefined;
  assert.ok(idleWhenReady, "a ready room is not a fight");
  assert.equal(p.hp, 500);

  // Only an active encounter wakes it.
  state.bossEncounter = "fighting";
  tickWarden(w, c, 0.01);
  assert.equal(c.task, "fight");
  assert.equal(c.monster?.phase, "windup");
});

test("a gloomwraith abandons the bolt when the mark steps out of the deep", () => {
  const w = createWorld(42);
  ensureGloomwraiths(w);
  const c = w.fauna.find((f) => f.id === GLOOM_SPAWNS[0]!.id)!;
  const p = w.people.find((pl) => pl.isPlayer)!;
  p.hp = p.maxHp = 100;
  p.x = c.x + 3; p.z = c.z;
  w.player.wear = {};
  w.player.invisUntil = 0;
  w.player.blessUntil = 0;
  w.player.ironwoodUntil = 0;
  c.gloom = { clock: 3, phase: "windup", time: 0, targetX: p.x, targetZ: p.z };

  p.x = 256; p.z = 292; // the mark leaves the deep mid-windup
  tickGloomwraith(w, c, 0.1);
  assert.equal(c.gloom?.phase, "prowl", "the cast is abandoned");
  assert.equal(c.task, "wander");
  for (let i = 0; i < 6; i++) tickGloomwraith(w, c, 0.5);
  assert.equal(p.hp, 100, "the bolt never lands on a departed mark");
});

test("strikePlayer refuses a body that is not the resolved actor", () => {
  const { w, c, p } = golemFixture();
  const npc = w.people.find((pl) => !pl.isPlayer)!;
  npc.hp = npc.maxHp = 100;
  assert.throws(() => strikePlayer(w, c, npc), /does not match actor/, "no strike on a mismatched body");
  strikePlayer(w, c, p); // omitted id resolves the legacy solo body
  assert.ok(p.hp < 100, "the resolved body takes the bite");
  assert.equal(w.player.lastBittenAt, w.hour);
});
