import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { houseTouchTarget } from "./house-touch.ts";
import { createStubWorld } from "./world.ts";
import type { World } from "./types.ts";

function fixture(kind: "porch" | "hut" | "homestead" = "hut") {
  const world = createStubWorld();
  world.people = world.people.filter(p => p.isPlayer);
  world.fauna = []; world.herbs = []; world.piles = []; world.plots = [];
  world.buildings = [{ id: "house", kind, tx: 256, ty: 320, beds: [], ownerId: world.player.id }];
  world.tiles[320]![256]!.kind = "dirt";
  return world;
}
for (const kind of ["porch", "hut", "homestead"] as const) test(`${kind} touch target preserves world and house identity`, () => {
  const world = fixture(kind), before = JSON.stringify(world);
  assert.equal(houseTouchTarget(world, { tx: 256, ty: 320 })?.id, "house");
  assert.equal(JSON.stringify(world), before);
  assert.equal(houseTouchTarget(world, { tx: 270, ty: 320 }), null);
});
test("touch houses exclude ghosts, armed spells, resources and non-house buildings", () => {
  const world = fixture(), tile = { tx: 256, ty: 320 };
  world.player.ghost = true; assert.equal(houseTouchTarget(world, tile), null);
  world.player.ghost = false; world.player.armedSpell = "teleport"; assert.equal(houseTouchTarget(world, tile), null);
  world.player.armedSpell = null;
  for (const kind of ["tree", "rock", "water", "pit", "wall"] as const) { world.tiles[320]![256]!.kind = kind; assert.equal(houseTouchTarget(world, tile), null); }
  world.tiles[320]![256]!.kind = "dirt"; world.buildings[0]!.kind = "shop";
  assert.equal(houseTouchTarget(world, tile), null);
});
for (const key of ["piles", "herbs", "fauna", "people", "plots"] as const) test(`house gesture preserves ${key} target priority`, () => {
  const world = fixture();
  if (key === "fauna") world.fauna = [{ x: 256, z: 320 }] as World["fauna"];
  else if (key === "people") world.people.push({ id: "npc", x: 256, z: 320, isPlayer: false } as World["people"][number]);
  else Object.assign(world, { [key]: [{ tx: 256, ty: 320 }] });
  assert.equal(houseTouchTarget(world, { tx: 256, ty: 320 }), null);
});
test("paused house chest subscribes to fresh snapshot identity, not mutable bag references", () => {
  const source = readFileSync(new URL("../components/game/house-gump.tsx", import.meta.url), "utf8");
  assert.match(source, /const snap = useGame\(\(s\) => s\.snap\)/);
  assert.doesNotMatch(source, /useGame\(\(s\) => s\.snap\.(buildings|player)/);
});

for (const entity of ["fauna", "person"] as const) test(`fractional nearby ${entity} keeps primary input priority across tile rounding`, () => {
  const world = fixture();
  if (entity === "fauna") world.fauna = [{ x: 256.6, z: 320, task: "idle" }] as World["fauna"];
  else world.people.push({ id: "near-npc", x: 256.6, z: 320, isPlayer: false } as World["people"][number]);
  assert.equal(houseTouchTarget(world, { tx: 256, ty: 320 }), null);
});
