import assert from "node:assert/strict";
import test from "node:test";
import { verbsFor } from "./context.ts";
import { applyDig, applyFill, holeAt, washHoles } from "./digging.ts";
import { setWorld } from "./live.ts";
import { commandDrop, you } from "./player.ts";
import { createPerson, createStubWorld } from "./world.ts";
import type { World } from "./types.ts";

function primed(): World {
  const world = createStubWorld();
  const player = createPerson(world, () => 0.5, { x: 100, z: 100, isPlayer: true, member: true });
  world.people.push(player);
  world.player.id = player.id;
  world.player.ghost = false;
  world.player.wear.main = "pick";
  world.player.skills.mining = 20;
  world.player.pack.cabbage = 1;
  setWorld(world);
  return world;
}

test("digging - a pick opens one pace of dirt and trains mining", () => {
  const world = primed();
  const h = world.tiles[100]![101]!.h;
  const note = applyDig(world, 101, 100);
  assert.match(note, /hole|dirt/i);
  assert.equal(world.tiles[100]![101]!.kind, "pit");
  assert.equal(world.tiles[100]![101]!.h, h - 1);
  assert.equal(world.scars["101,100"]?.kind, "pit");
  assert.equal(world.scars["101,100"]?.h, h - 1);
  const hole = holeAt(world, 101, 100);
  assert.equal(hole?.open, true);
  assert.equal(hole?.kind, "grass");
  assert.ok(world.player.skills.mining >= 20);
});

test("digging - cobble, water, the tomb, and a ghost refuse", () => {
  const world = primed();
  world.tiles[100]![101]!.kind = "cobble";
  assert.match(applyDig(world, 101, 100), /stone|cobble|hall/i);
  world.tiles[100]![101]!.kind = "water";
  assert.match(applyDig(world, 101, 100), /water/i);
  world.tiles[100]![101]!.kind = "pit";
  world.tiles[100]![101]!.h = 0;
  assert.match(applyDig(world, 101, 100), /tomb|pit|not yours/i);
  world.tiles[100]![101]!.kind = "grass";
  world.player.ghost = true;
  assert.equal(applyDig(world, 101, 100), "A ghost cannot.");
});

test("digging - fill kicks the dirt back", () => {
  const world = primed();
  const h = world.tiles[100]![101]!.h;
  applyDig(world, 101, 100);
  const note = applyFill(world, 101, 100);
  assert.match(note, /fill|dirt|kick/i);
  assert.equal(world.tiles[100]![101]!.kind, "grass");
  assert.equal(world.tiles[100]![101]!.h, h);
  assert.equal(holeAt(world, 101, 100), null);
});

test("digging - a dropped thing buried in the hole stays until you unearth it", () => {
  const world = primed();
  applyDig(world, 101, 100);
  const self = you(world)!;
  self.x = 101;
  self.z = 100;
  assert.match(String(commandDrop(world, "cabbage")), /Dropped/);
  assert.equal(world.player.pack.cabbage, 0);
  applyFill(world, 101, 100);
  assert.equal(world.tiles[100]![101]!.kind, "grass");
  assert.equal(world.piles.some((p) => (p.items.cabbage ?? 0) > 0), false);
  assert.equal(holeAt(world, 101, 100)?.buried?.items.cabbage, 1);
  const note = applyDig(world, 101, 100);
  assert.match(note, /cabbage/i);
  assert.equal(world.player.pack.cabbage, 1);
  assert.equal(holeAt(world, 101, 100), null);
});

test("digging - rain fills open holes and washes a stash into the mud", () => {
  const world = primed();
  const h = world.tiles[100]![101]!.h;
  applyDig(world, 101, 100);
  const self = you(world)!;
  self.x = 101;
  self.z = 100;
  commandDrop(world, "cabbage");
  applyFill(world, 101, 100);
  world.tiles[102]![100]!.kind = "pit";
  world.tiles[102]![100]!.h = 0;
  washHoles(world);
  assert.equal(world.tiles[100]![101]!.kind, "grass");
  assert.equal(world.tiles[100]![101]!.h, h);
  assert.equal(holeAt(world, 101, 100), null);
  assert.equal(world.player.pack.cabbage, 0);
  const mud = world.piles.find((p) => (p.items.cabbage ?? 0) > 0);
  assert.ok(mud);
  assert.equal(mud!.items.cabbage, 1);
  assert.match(mud!.label, /mud/i);
  assert.equal(world.tiles[102]![100]!.kind, "pit");
  assert.equal(world.tiles[102]![100]!.h, 0);
});

test("digging - rain fills an empty hole", () => {
  const world = primed();
  applyDig(world, 101, 100);
  washHoles(world);
  assert.equal(world.tiles[100]![101]!.kind, "grass");
  assert.equal(holeAt(world, 101, 100), null);
});

test("digging - the context offers Dig on dirt and Fill on your hole", () => {
  const world = primed();
  const grass = verbsFor({ kind: "tile", id: "t", tx: 101, ty: 100, label: "Grass" });
  assert.ok(grass.some((v) => v.verb === "dig"));
  applyDig(world, 101, 100);
  const open = verbsFor({ kind: "tile", id: "t", tx: 101, ty: 100, label: "Pit" });
  assert.ok(open.some((v) => v.verb === "fill"));
  assert.equal(open.some((v) => v.verb === "dig"), false);
});

test("digging - twelve open holes is enough", () => {
  const world = primed();
  for (let i = 0; i < 12; i++) {
    assert.match(applyDig(world, 110 + i, 110), /hole|dirt/i);
  }
  assert.match(applyDig(world, 130, 110), /enough|twelve|rain/i);
});
