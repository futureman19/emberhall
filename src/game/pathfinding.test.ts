import assert from "node:assert/strict";
import test from "node:test";
import { astar, astarToRange, lineWalkable } from "./pathfinding.ts";
import { createStubWorld } from "./world.ts";

function block(world: ReturnType<typeof createStubWorld>, points: ReadonlyArray<readonly [number, number]>) {
  for (const [x, y] of points) world.tiles[y]![x]!.kind = "wall";
}

test("astar removes the starting tile and smooths an open route", () => {
  const world = createStubWorld();
  assert.deepEqual(astar(world, 10, 10, 14, 10), [{ x: 14, y: 10 }]);
});

test("astar cannot cut diagonally through a sealed corner", () => {
  const world = createStubWorld();
  block(world, [
    [11, 10],
    [10, 11],
    [12, 10],
    [12, 11],
    [12, 12],
    [11, 12],
    [10, 12],
  ]);
  assert.equal(astar(world, 10, 10, 11, 11), null);
});

test("astar smooths only across terrain with clear line of travel", () => {
  const world = createStubWorld();
  block(world, [[12, 10]]);
  const path = astar(world, 10, 10, 14, 10);
  assert.ok(path && path.length > 1);
  assert.deepEqual(path.at(-1), { x: 14, y: 10 });
  let from = { x: 10, y: 10 };
  for (const waypoint of path) {
    assert.equal(lineWalkable(world, from.x, from.y, waypoint.x, waypoint.y), true);
    from = waypoint;
  }
});

test("astarToRange chooses reachable footing beside an occupied target", () => {
  const world = createStubWorld();
  world.tiles[10]![14]!.kind = "rock";
  const path = astarToRange(world, 10, 10, 14, 10, 1.5);
  assert.ok(path);
  const endpoint = path.at(-1);
  assert.ok(endpoint);
  assert.ok(Math.hypot(endpoint.x - 14, endpoint.y - 10) <= 1.5);
  assert.notDeepEqual(endpoint, { x: 14, y: 10 });
});
