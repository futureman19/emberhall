import assert from "node:assert/strict";
import test from "node:test";
import { commandPlantTree, plantTreeNow, saplingAt, tickSaplings, TREE_HOURS } from "./forestry.ts";
import { you } from "./player.ts";
import { createWorld } from "./world.ts";

function grassAt(tx: number, ty: number) {
  const w = createWorld();
  const p = you(w)!;
  p.x = tx;
  p.z = ty;
  p.path = [];
  const tile = w.tiles[ty]![tx]!;
  tile.kind = "grass";
  w.player.pack.acorn = 3;
  w.player.skills.forestry = 0;
  return w;
}

test("forestry - an acorn takes grass and becomes a tree", () => {
  const w = grassAt(240, 280);
  const err = commandPlantTree(w, 240, 280);
  assert.equal(err, null);
  const note = plantTreeNow(w);
  assert.match(String(note), /oak takes/);
  assert.equal(w.player.pack.acorn, 2);
  const sap = saplingAt(w, 240, 280);
  assert.ok(sap);
  assert.equal(sap.stage, 1);
  assert.equal(w.tiles[280]![240]!.kind, "grass");

  w.hour += TREE_HOURS + 0.01;
  tickSaplings(w);
  assert.equal(saplingAt(w, 240, 280), null);
  assert.equal(w.tiles[280]![240]!.kind, "tree");
  assert.deepEqual(w.scars["240,280"], { kind: "tree" });
  assert.ok(w.player.skills.forestry >= 0);
});

test("forestry - cobble and a standing tree refuse the acorn", () => {
  const w = grassAt(256, 293);
  w.tiles[293]![256]!.kind = "cobble";
  w.player.pack.acorn = 1;
  assert.equal(commandPlantTree(w, 256, 293), "Not this stone.");
  w.tiles[293]![256]!.kind = "tree";
  assert.equal(commandPlantTree(w, 256, 293), "The tree stands.");
  assert.equal(w.player.pack.acorn, 1);
});

test("forestry - a ghost cannot plant, and an empty pack cannot", () => {
  const w = grassAt(240, 280);
  w.player.ghost = true;
  you(w)!.ghost = true;
  assert.equal(commandPlantTree(w, 240, 280), "A ghost cannot.");
  w.player.ghost = false;
  you(w)!.ghost = false;
  w.player.pack.acorn = 0;
  assert.match(String(commandPlantTree(w, 240, 280)), /acorn/);
});

test("forestry - rain hurries a sapling", () => {
  const w = grassAt(241, 281);
  commandPlantTree(w, 241, 281);
  plantTreeNow(w);
  w.weather.wet = 0.5;
  w.hour += TREE_HOURS * 0.75 + 0.01;
  tickSaplings(w);
  assert.equal(w.tiles[281]![241]!.kind, "tree");
});

test("forestry - skill picks oak, then redwood, and the grove remembers", () => {
  const w = grassAt(242, 282);
  w.player.skills.forestry = 8;
  commandPlantTree(w, 242, 282);
  plantTreeNow(w);
  assert.equal(saplingAt(w, 242, 282)?.resourceId, "oak");
  w.hour += TREE_HOURS + 0.01;
  tickSaplings(w);
  assert.equal(w.plantedTimber["242,282"], "oak");

  w.player.skills.forestry = 50;
  w.player.pack.acorn = 1;
  const tile = w.tiles[283]![243]!;
  tile.kind = "grass";
  const p = you(w)!;
  p.x = 243;
  p.z = 283;
  commandPlantTree(w, 243, 283);
  const note = plantTreeNow(w);
  assert.match(String(note), /redwood/);
  assert.equal(saplingAt(w, 243, 283)?.resourceId, "redwood");
  w.hour += TREE_HOURS + 0.01;
  tickSaplings(w);
  assert.equal(w.plantedTimber["243,283"], "redwood");
});
