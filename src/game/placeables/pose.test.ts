import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ghostTint, worldVoxels } from "./pose.ts";

test("a lodge's floor, wall, door, and roof occupy the intended cells", () => {
  const floor = worldVoxels("floor_timber", 10, 20, 0, 0);
  assert.equal(floor.length, 4);
  assert.ok(floor.some((v) => v.x === 10.25 && v.z === 20.25 && v.y === 0.25 && v.t === "timber"));
  assert.ok(floor.every((v) => v.y === 0.25));

  const wall = worldVoxels("wall_straight", 10, 20, 0, 0);
  assert.equal(wall.length, 8);
  assert.ok(wall.every((v) => v.x === 10.25));
  assert.ok(wall.some((v) => v.y === 0.25 + 3 * 0.5));

  const door = worldVoxels("door_timber", 10, 20, 0, 0);
  assert.equal(door.length, 3);
  assert.ok(door.every((v) => v.x === 10.25 && v.z === 20.25));

  const roof = worldVoxels("roof_slope", 10, 20, 0, 0);
  assert.ok(roof.every((v) => v.y === 0.25 + 3 * 0.5));
  assert.equal(roof.length, 4);
});

test("valid ghosts are gold; invalid ghosts are rust", () => {
  assert.equal(ghostTint(true), "#c9a36a");
  assert.equal(ghostTint(false), "#a85a42");
});

test("the vale scene mounts kit meshes beside civic buildings", () => {
  const source = readFileSync(new URL("../../components/game/world-scene.tsx", import.meta.url), "utf8");
  assert.match(source, /<Placeables \/>/);
  assert.match(source, /from "\.\/placeable-meshes"/);
});
