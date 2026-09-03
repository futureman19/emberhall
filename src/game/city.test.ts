import assert from "node:assert/strict";
import test from "node:test";
import { generateTiles, createWorld } from "./world.ts";
import { astar, walkable } from "./pathfinding.ts";
import { ensureCity, WARD, KEEP } from "./city.ts";

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
  const world = createWorld();
  assert.equal(walkable(world, WARD.x0, 336), true); // west gate
  assert.equal(walkable(world, WARD.x1, 336), true); // east gate
  assert.equal(walkable(world, WARD.x0, 320), false); // wall
  assert.equal(walkable(world, 176, WARD.z0), false); // wall
  // Plaza to the Millcross road outside the west gate.
  const out = astar(world, 176, 336, 140, 336, 4000);
  assert.ok(out && out.length > 0, "a road out the west gate");
  // Bailey to high street.
  const inTown = astar(world, 176, 326, 176, 336, 2000);
  assert.ok(inTown && inTown.length > 0, "bailey to street");
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
