import assert from "node:assert/strict";
import test from "node:test";
import { generateTiles, createWorld } from "./world.ts";
import { astar, lineWalkable, walkable, type GridPoint } from "./pathfinding.ts";
import { commandWalk } from "./player.ts";
import type { World } from "./types.ts";
import { ensureCity, WARD, KEEP } from "./city.ts";

// The exact seed that exposed the old off-road destination, not a lucky seed.
function regressionWorld() {
  const random = Math.random;
  try {
    Math.random = () => 2469134 / 1e9;
    const world = createWorld();
    assert.equal(world.seed, 2469134);
    return world;
  } finally {
    Math.random = random;
  }
}

function assertRoute(world: World, from: GridPoint, to: GridPoint) {
  const route = astar(world, from.x, from.y, to.x, to.y, 4000);
  assert.ok(route && route.length > 0, `route ${JSON.stringify(from)} -> ${JSON.stringify(to)}`);
  assert.deepEqual(route.at(-1), to, "reaches the exact destination, not a retarget");
  const nodes = [from, ...route];
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1]!;
    const b = nodes[i]!;
    assert.ok(lineWalkable(world, a.x, a.y, b.x, b.y), "every smoothed segment obeys climb/wall/corner rules");
  }
  return nodes;
}

test("the capital's ground: wall ring, gates, streets, keep shell", () => {
  const tiles = generateTiles(7);
  const at = (x: number, y: number) => tiles[y]![x]!;
  // The curtain wall stands on every side.
  assert.equal(at(176, WARD.z0).kind, "wall");
  assert.equal(at(176, WARD.z1).kind, "wall");
  assert.equal(at(WARD.x0, 320).kind, "wall");
  assert.equal(at(WARD.x1, 320).kind, "wall");
  // The gates are open road.
  for (const z of [334, 335, 336, 337, 338]) {
    assert.equal(at(WARD.x0, z).kind, "cobble");
    assert.equal(at(WARD.x1, z).kind, "cobble");
  }
  // High street and plaza are cobbled; the ward is tamed.
  assert.equal(at(176, 336).kind, "cobble");
  assert.equal(at(176, 336).h, 3);
  assert.notEqual(at(160, 350).kind, "tree");
  // The keep's shell: stone ring, floor within, a door off the bailey.
  assert.equal(at(KEEP.x0, KEEP.ty).kind, "wall");
  assert.equal(at(KEEP.tx, KEEP.ty).kind, "floor");
  assert.equal(at(KEEP.tx, KEEP.z1).kind, "cobble");
  assert.ok(KEEP.x1 - KEEP.x0 >= 18, "keep shell is a castle, not a hut");
});

test("the ward truly encloses: you leave through a gate or not at all", () => {
  const world = regressionWorld();
  assert.equal(walkable(world, WARD.x0, 336), true); // west gate
  assert.equal(walkable(world, WARD.x1, 336), true); // east gate
  assert.equal(walkable(world, WARD.x0, 320), false); // wall
  assert.equal(walkable(world, 176, WARD.z0), false); // wall
  // The road heads northwest: at x=140 its centre is z=328, not z=336.
  // Lock its identity first, so an arbitrary forest tile cannot stand in for it.
  assert.equal(world.tiles[328]![140]!.kind, "road");
  const out = assertRoute(world, { x: 176, y: 336 }, { x: 140, y: 328 });
  const crossing = out.findIndex((b, i) => i > 0 && out[i - 1]!.x >= WARD.x0 && b.x < WARD.x0);
  assert.ok(crossing > 0, "exits through the west wall, not the east gate");
  const a = out[crossing - 1]!;
  const b = out[crossing]!;
  const z = a.y + (b.y - a.y) * (WARD.x0 - a.x) / (b.x - a.x);
  assert.ok(z >= 333.5 && z <= 338.5, "crossing lies in the existing gate opening");
  assertRoute(world, { x: 140, y: 328 }, { x: 176, y: 336 });
  // Bailey to high street.
  const inTown = astar(world, 176, 326, 176, 336, 2000);
  assert.ok(inTown && inTown.length > 0, "bailey to street");
});

test("the reported seed connects the plaza to Millcross itself", () => {
  const world = regressionWorld();
  assert.equal(world.tiles[300]![96]!.kind, "road");
  assertRoute(world, { x: 176, y: 336 }, { x: 96, y: 300 });
  assertRoute(world, { x: 96, y: 300 }, { x: 176, y: 336 });
});

test("the old off-road destination remains an unreachable height island", () => {
  const world = regressionWorld();
  const tile = world.tiles[336]![140]!;
  assert.deepEqual(tile, { h: 7, kind: "tree" });
  assert.equal(walkable(world, 140, 336), true, "kind-walkable is not reachable");
  for (let y = 335; y <= 337; y++) {
    for (let x = 139; x <= 141; x++) {
      if (x === 140 && y === 336) continue;
      assert.equal(lineWalkable(world, 140, 336, x, y), false, "no legal edge leaves the island");
    }
  }
  assert.equal(astar(world, 176, 336, 140, 336, 4000), null);
  const p = world.people.find(p => p.isPlayer)!;
  p.x = 176;
  p.z = 336;
  const before = { x: p.x, z: p.z, path: structuredClone(p.path), intent: structuredClone(world.player.intent) };
  assert.equal(commandWalk(world, 140, 336), "The way is closed.");
  assert.deepEqual({ x: p.x, z: p.z, path: p.path, intent: world.player.intent }, before);
});

test("ensureCity stamps the capital once, buildings and souls", () => {
  const world = createWorld();
  const buildings = world.buildings.length;
  const people = world.people.length;
  assert.ok(world.buildings.some((b) => b.kind === "keep"), "a keep stands");
  assert.ok(world.buildings.filter((b) => b.kind === "rampart" || b.kind === "rampartV").length >= 20, "ramparts ring the ward");
  assert.ok(world.people.some((p) => p.name === "Odo Goldhand" && p.role === "banker"), "the banker holds the plaza");
  assert.ok(world.people.some((p) => p.name === "Hodge Ward"), "the west gate is watched");
  // Idempotent: a second stamping (the load path) adds nothing.
  ensureCity(world);
  assert.equal(world.buildings.length, buildings);
  assert.equal(world.people.length, people);
});
