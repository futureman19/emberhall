import assert from "node:assert/strict";
import test from "node:test";
import { createPerson, createStubWorld } from "./world.ts";
import { placeObject } from "./placeables/commands.ts";
import { parseCreatorFields } from "./placeables/schema.ts";
import { applyBlueprint, captureBlueprint, poseBlueprint } from "./blueprints.ts";
import type { World } from "./types.ts";

function primed(): World {
  const world = createStubWorld();
  const player = createPerson(world, () => 0.5, { x: 100, z: 100, isPlayer: true, member: true, name: "Ada" });
  world.people.push(player);
  world.player.id = player.id;
  world.player.ghost = false;
  world.player.pack.board = 40;
  return world;
}

test("capture stores a lodgerelative to the hold anchor with a board bill", () => {
  const world = primed();
  assert.equal(placeObject(world, "floor_timber", 100, 100, 0), null);
  assert.equal(placeObject(world, "wall_doorway", 100, 102, 0), null);
  assert.equal(placeObject(world, "door_timber", 101, 102, 0), null);
  const err = captureBlueprint(world, "Lean-to");
  assert.equal(err, null);
  const bp = world.blueprints[0]!;
  assert.equal(bp.name, "Lean-to");
  assert.equal(bp.author, "Ada");
  assert.ok(bp.objects.length >= 3);
  assert.equal(bp.objects.every((o) => o.dx >= 0 && o.dy >= 0), true);
  const boards = bp.billOfMaterials.find((b) => b.id === "board");
  assert.ok(boards && boards.n >= 6);
  const parsed = parseCreatorFields({
    placedObjects: world.placedObjects,
    structures: world.structures,
    blueprints: world.blueprints,
  });
  assert.ok(parsed);
});

test("a short pack or a collision spends nothing and places nothing", () => {
  const world = primed();
  assert.equal(placeObject(world, "floor_timber", 100, 100, 0), null);
  assert.equal(placeObject(world, "wall_straight", 100, 102, 0), null);
  assert.equal(captureBlueprint(world, "Hut"), null);
  const bp = world.blueprints[0]!.id;
  const boards = world.player.pack.board;
  const placed = world.placedObjects.length;

  world.player.pack.board = 0;
  assert.match(applyBlueprint(world, bp, 120, 120, 0) ?? "", /Need/);
  assert.equal(world.placedObjects.length, placed);
  assert.equal(world.player.pack.board, 0);

  world.player.pack.board = boards;
  assert.equal(placeObject(world, "floor_timber", 120, 120, 0), null);
  const afterBlock = world.placedObjects.length;
  const afterBoards = world.player.pack.board;
  assert.match(applyBlueprint(world, bp, 120, 120, 0) ?? "", /taken|Need|footing/i);
  assert.equal(world.placedObjects.length, afterBlock);
  assert.equal(world.player.pack.board, afterBoards);
});

test("rotating a blueprint keeps the doorway beside the door", () => {
  const world = primed();
  assert.equal(placeObject(world, "wall_doorway", 100, 100, 0), null);
  assert.equal(placeObject(world, "door_timber", 101, 100, 0), null);
  assert.equal(captureBlueprint(world, "Door"), null);
  const bp = world.blueprints[0]!;
  const origin = poseBlueprint(bp, 50, 60, 0);
  const turned = poseBlueprint(bp, 50, 60, 1);
  const stampedPose = poseBlueprint(bp, 80, 80, 1);
  const door0 = origin.find((p) => p.definitionId === "door_timber")!;
  const gap0 = origin.find((p) => p.definitionId === "wall_doorway")!;
  const door1 = turned.find((p) => p.definitionId === "door_timber")!;
  const gap1 = turned.find((p) => p.definitionId === "wall_doorway")!;
  assert.equal(Math.hypot(door0.tx - gap0.tx, door0.ty - gap0.ty), Math.hypot(door1.tx - gap1.tx, door1.ty - gap1.ty));
  assert.equal(((door0.rotation + 1) % 4), door1.rotation);
  const before = world.placedObjects.length;
  assert.equal(applyBlueprint(world, bp.id, 80, 80, 1), null);
  const stamped = world.placedObjects.slice(before);
  const sDoor = stamped.find((o) => o.definitionId === "door_timber")!;
  const sGap = stamped.find((o) => o.definitionId === "wall_doorway")!;
  const pDoor = stampedPose.find((p) => p.definitionId === "door_timber")!;
  const pGap = stampedPose.find((p) => p.definitionId === "wall_doorway")!;
  assert.equal(sDoor.rotation, pDoor.rotation);
  assert.equal(sDoor.tx, pDoor.tx);
  assert.equal(sGap.tx, pGap.tx);
  assert.equal(sGap.ty, pGap.ty);
});
