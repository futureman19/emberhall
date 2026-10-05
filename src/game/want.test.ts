import assert from "node:assert/strict";
import test from "node:test";
import { commandTalk } from "./npcs.ts";
import { you } from "./player.ts";
import { setWorld } from "./live.ts";
import { createWorld, ensureRynWain, RYN_NAME, RYN_PAY, RYN_WANT } from "./world.ts";

test("want - Ryn stands on a new hall and asks for a hide", () => {
  const world = createWorld();
  const ryn = world.people.find((p) => p.name === RYN_NAME);
  assert.ok(ryn);
  assert.equal(ryn.role, null);
  const self = you(world)!;
  self.x = ryn.x;
  self.z = ryn.z;
  const note = commandTalk(world, ryn.id);
  assert.match(note, /Wolfhollow took my last hide/);
  assert.ok(world.quests.some((q) => q.id === RYN_WANT && q.title === "Bring Ryn a hide"));
});

test("want - a hide pays; she will not pay twice", () => {
  const world = createWorld();
  const ryn = world.people.find((p) => p.name === RYN_NAME)!;
  const self = you(world)!;
  self.x = ryn.x;
  self.z = ryn.z;
  world.player.pack.hide = 2;
  const gold = world.gold;
  const note = commandTalk(world, ryn.id);
  assert.match(note, /Don't sleep in the hollow/);
  assert.equal(world.player.pack.hide, 1);
  assert.equal(world.gold, gold + RYN_PAY);
  assert.equal(world.rep[RYN_WANT], 1);
  assert.match(commandTalk(world, ryn.id), /I remember/);
  assert.equal(world.player.pack.hide, 1);
  assert.equal(world.gold, gold + RYN_PAY);
});

test("want - a ghost cannot bargain", () => {
  const world = createWorld();
  const ryn = world.people.find((p) => p.name === RYN_NAME)!;
  const self = you(world)!;
  self.x = ryn.x;
  self.z = ryn.z;
  world.player.ghost = true;
  self.ghost = true;
  world.player.pack.hide = 1;
  assert.match(commandTalk(world, ryn.id), /dead keep no bargains/);
  assert.equal(world.player.pack.hide, 1);
});

test("want - old halls still get Ryn, and only once", () => {
  const world = createWorld();
  world.people = world.people.filter((p) => p.name !== RYN_NAME);
  assert.equal(world.people.some((p) => p.name === RYN_NAME), false);
  ensureRynWain(world);
  ensureRynWain(world);
  assert.equal(world.people.filter((p) => p.name === RYN_NAME).length, 1);
  setWorld(world);
  assert.equal(world.people.filter((p) => p.name === RYN_NAME).length, 1);
});
