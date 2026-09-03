import assert from "node:assert/strict";
import test from "node:test";
import { EXTRACTION_BEAT, EXTRACTION_IMPACT, extractionPose, extractionVisualProfile, getExtractionFx } from "./extraction-animation.ts";
import { commandChop, commandMine, tickPlayer, you } from "./player.ts";
import { createPerson, createStubWorld } from "./world.ts";
import type { TileKind, World } from "./types.ts";

function workWorld(kind: TileKind): { world: World; tx: number; ty: number } {
  const world = createStubWorld();
  const player = createPerson(world, () => 0.5, { x: 40, z: 40, cls: "ranger", member: true, isPlayer: true });
  world.player.id = player.id;
  world.people.push(player);
  const tx = 41;
  const ty = 40;
  for (let z = ty - 2; z <= ty + 2; z += 1) {
    for (let x = tx - 2; x <= tx + 2; x += 1) world.tiles[z]![x] = { h: 1, kind: "grass" };
  }
  world.tiles[ty]![tx]!.kind = kind;
  player.path = [];
  world.player.skills.lumberjack = 100;
  world.player.skills.mining = 100;
  return { world, tx, ty };
}

function withRoll<T>(roll: number, action: () => T): T {
  const random = Math.random;
  Math.random = () => roll;
  try {
    return action();
  } finally {
    Math.random = random;
  }
}

test("extraction animation - distinct poses peak at the shared impact time", () => {
  const axe = extractionPose("lumberjacking", EXTRACTION_IMPACT);
  const pick = extractionPose("mining", EXTRACTION_IMPACT);
  assert.equal(axe.swing, 1);
  assert.equal(pick.swing, 1);
  assert.ok(axe.twist > pick.twist);
  assert.ok(pick.crouch > axe.crouch);
  assert.equal(extractionPose("mining", EXTRACTION_BEAT).swing, 0);
  assert.notDeepEqual(extractionVisualProfile("lumberjacking"), extractionVisualProfile("mining"));
});

test("extraction animation - a successful tree impact emits without changing recovery", () => {
  const { world, tx, ty } = workWorld("tree");
  assert.equal(commandChop(world, tx, ty), null);
  you(world)!.path = [];
  assert.equal(getExtractionFx(world), null, "approach and windup do not claim an impact");
  withRoll(0, () => tickPlayer(world, 0.6));
  assert.deepEqual(getExtractionFx(world), { kind: "lumberjacking", success: true, x: tx, z: ty, at: world.hour });
  assert.equal(getExtractionFx(workWorld("tree").world), null, "events cannot leak into another world");
  assert.equal(world.tiles[ty]![tx]!.kind, "dirt");
  assert.equal(world.player.intent.kind, "none");
});

test("extraction animation - mining records success and a glancing axe records failure", () => {
  const mine = workWorld("rock");
  mine.world.player.wear.main = "pick";
  assert.equal(commandMine(mine.world, mine.tx, mine.ty), null);
  you(mine.world)!.path = [];
  withRoll(0, () => tickPlayer(mine.world, 0.6));
  assert.deepEqual(getExtractionFx(mine.world), { kind: "mining", success: true, x: mine.tx, z: mine.ty, at: mine.world.hour });

  const chop = workWorld("tree");
  chop.world.player.skills.lumberjack = 0;
  assert.equal(commandChop(chop.world, chop.tx, chop.ty), null);
  you(chop.world)!.path = [];
  const tile = structuredClone(chop.world.tiles[chop.ty]![chop.tx]!);
  withRoll(0.99, () => tickPlayer(chop.world, 0.6));
  assert.deepEqual(getExtractionFx(chop.world), { kind: "lumberjacking", success: false, x: chop.tx, z: chop.ty, at: chop.world.hour });
  assert.deepEqual(chop.world.tiles[chop.ty]![chop.tx], tile);
  assert.equal(chop.world.player.intent.kind, "chop", "failed work keeps its established retry loop");
});

test("extraction animation - invalid targets emit nothing", () => {
  const { world, tx, ty } = workWorld("grass");
  assert.equal(commandChop(world, tx, ty), null);
  you(world)!.path = [];
  assert.equal(withRoll(0, () => tickPlayer(world, 0.6)), "No tree.");
  assert.equal(getExtractionFx(world), null);
});
