import assert from "node:assert/strict";
import test from "node:test";
import { stationsHere } from "../craft.ts";
import { verbsFor } from "../context.ts";
import { walkable } from "../pathfinding.ts";
import { getWorld, setWorld } from "../live.ts";
import { createPerson, createStubWorld } from "../world.ts";
import { placeObject, reclaimObject } from "./commands.ts";
import {
  chestPut,
  chestTake,
  restAtBed,
  setSignText,
  toggleDoor,
} from "./functions.ts";
import type { World } from "../types.ts";

function primed(): World {
  const world = createStubWorld();
  const player = createPerson(world, () => 0.5, { x: 100, z: 100, isPlayer: true, member: true });
  player.hp = 10;
  player.maxHp = 40;
  world.people.push(player);
  world.player.id = player.id;
  world.player.ghost = false;
  world.player.pack.board = 40;
  world.player.pack.ingot = 8;
  world.player.pack.cabbage_seed = 1;
  setWorld(world);
  return getWorld();
}

test("a closed door blocks the tile; an open door lets you through", () => {
  const world = primed();
  assert.equal(placeObject(world, "door_timber", 102, 100, 0), null);
  const id = world.placedObjects[0]!.id;
  assert.equal(walkable(world, 102, 100), false);
  assert.equal(toggleDoor(world, id), null);
  assert.equal(world.placedObjects[0]!.state.open, true);
  assert.equal(walkable(world, 102, 100), true);
  assert.equal(toggleDoor(world, id), null);
  assert.equal(walkable(world, 102, 100), false);
});

test("a workbench counts as a bench and a hearth counts as fire", () => {
  const world = primed();
  assert.equal(placeObject(world, "bench_work", 100, 100, 0), null);
  assert.ok(stationsHere(world).includes("bench"));
  assert.equal(placeObject(world, "hearth_stone", 101, 101, 0), null);
  const here = stationsHere(world);
  assert.ok(here.includes("fire"));
  assert.ok(here.includes("forge"));
});

test("a bed restores health", () => {
  const world = primed();
  assert.equal(placeObject(world, "bed_simple", 100, 100, 0), null);
  const before = world.people[0]!.hp;
  assert.equal(restAtBed(world, world.placedObjects[0]!.id), null);
  assert.ok(world.people[0]!.hp > before);
});

test("a chest stores and refunds a validated stack, and refuses a stranger", () => {
  const world = primed();
  assert.equal(placeObject(world, "chest_keep", 100, 100, 0), null);
  const id = world.placedObjects[0]!.id;
  world.player.pack.board = 5;
  assert.equal(chestPut(world, id, "board", 2), null);
  assert.equal(world.player.pack.board, 3);
  assert.equal(chestTake(world, id, "board", 1), null);
  assert.equal(world.player.pack.board, 4);
  world.player.id = "stranger";
  assert.equal(chestPut(world, id, "board", 1), "That hold is not yours.");
});

test("a sign keeps bounded text", () => {
  const world = primed();
  assert.equal(placeObject(world, "sign_board", 100, 100, 0), null);
  const id = world.placedObjects[0]!.id;
  assert.equal(setSignText(world, id, "Oakstand mill"), null);
  assert.equal(world.placedObjects[0]!.state.text, "Oakstand mill");
  assert.match(setSignText(world, id, "x".repeat(81)) ?? "", /too long/i);
  assert.equal(world.placedObjects[0]!.state.text, "Oakstand mill");
});

test("a planter is a crop bed you can sow", () => {
  const world = primed();
  assert.equal(placeObject(world, "planter_box", 100, 100, 0), null);
  assert.ok(world.plots.some((p) => p.tx === 100 && p.ty === 100));
  const verbs = verbsFor({ kind: "plot", id: world.plots[0]!.id, tx: 100, ty: 100, label: "bed" });
  assert.ok(verbs.some((v) => v.verb === "sowCabbage"));
  reclaimObject(world, world.placedObjects[0]!.id);
  assert.equal(world.plots.length, 0);
});

test("context offers Open on a hung door", () => {
  const world = primed();
  assert.equal(placeObject(world, "door_timber", 100, 100, 0), null);
  const verbs = verbsFor({ kind: "building", id: world.placedObjects[0]!.id, tx: 100, ty: 100, label: "door" });
  assert.ok(verbs.some((v) => v.verb === "use" && /door/i.test(v.label)));
});
