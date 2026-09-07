import assert from "node:assert/strict";
import test from "node:test";
import { LIVE_SKILLS } from "./catalog.ts";
import { verbsFor } from "./context.ts";
import { setWorld } from "./live.ts";
import { you } from "./player.ts";
import { compassOf, commandTrack, TRACK_SOUL, trackingRange } from "./tracking.ts";
import { createWorld } from "./world.ts";
import type { Creature } from "./types.ts";

test("tracking - range and compass", () => {
  assert.equal(trackingRange(0), 12);
  assert.equal(trackingRange(8), 14);
  assert.equal(trackingRange(100), 37);
  assert.equal(compassOf(0, -4), "north");
  assert.equal(compassOf(4, 0), "east");
  assert.equal(compassOf(0, 4), "south");
  assert.equal(compassOf(-4, 0), "west");
  assert.ok(LIVE_SKILLS.includes("tracking"));
});

function hareAt(world: ReturnType<typeof createWorld>, dx: number, dz: number): Creature {
  const p = you(world)!;
  const hare: Creature = {
    id: "track-hare",
    kind: "hare",
    x: p.x + dx,
    z: p.z + dz,
    hp: 8,
    maxHp: 8,
    path: [],
    task: "idle",
    taskUntil: 0,
    corpseUntil: 0,
    home: { tx: Math.round(p.x + dx), ty: Math.round(p.z + dz) },
    ownerId: null,
    loyalty: 0,
    stay: false,
  };
  world.fauna.push(hare);
  return hare;
}

test("tracking - names the nearest beast and faces it", () => {
  const world = createWorld();
  world.fauna = [];
  world.player.skills.tracking = 8;
  const p = you(world)!;
  hareAt(world, 0, 6);
  const note = commandTrack(world);
  assert.match(note, /Hare/);
  assert.match(note, /south/);
  assert.match(note, /6 pace/);
  assert.ok(Math.abs(p.facing - Math.atan2(0, 6)) < 0.01);
  assert.ok(world.player.skills.tracking > 8);
});

test("tracking - a cold trail when nothing lives in range", () => {
  const world = createWorld();
  world.fauna = [];
  world.player.skills.tracking = 8;
  hareAt(world, 0, 80);
  assert.equal(commandTrack(world), "The trail is cold.");
});

test("tracking - pets and corpses are not the wild", () => {
  const world = createWorld();
  world.fauna = [];
  world.player.skills.tracking = 8;
  const pet = hareAt(world, 2, 0);
  pet.ownerId = world.player.id;
  const dead = hareAt(world, 0, 3);
  dead.id = "dead-hare";
  dead.task = "dead";
  assert.equal(commandTrack(world), "The trail is cold.");
});

test("tracking - souls join the trail at 40", () => {
  const world = createWorld();
  world.fauna = [];
  world.player.skills.tracking = TRACK_SOUL;
  const p = you(world)!;
  const others = world.people.filter((person) => !person.isPlayer && person.id !== world.player.id);
  assert.ok(others.length > 0);
  for (const person of others) {
    person.x = p.x + 80;
    person.z = p.z;
  }
  const other = others[0]!;
  other.x = p.x + 3;
  other.z = p.z;
  const note = commandTrack(world);
  assert.match(note, new RegExp(other.name));
  assert.match(note, /east/);
});

test("tracking - dirt offers Track; a ghost cannot", () => {
  const world = createWorld();
  setWorld(world);
  const p = you(world)!;
  const verbs = verbsFor({ kind: "tile", id: "", tx: Math.round(p.x), ty: Math.round(p.z) + 2, label: "grass" });
  assert.ok(verbs.some((v) => v.verb === "track" && v.label === "Track"));
  world.player.ghost = true;
  p.ghost = true;
  assert.equal(commandTrack(world), "A ghost cannot.");
});
