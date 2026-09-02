import assert from "node:assert/strict";
import test from "node:test";
import { commandChop, you } from "./player.ts";
import { isGhostwoodTree } from "./forestry.ts";
import { GHOSTWOOD_LUMBERJACK, timberGradeLabel, RESOURCE_IDS, RESOURCE_CATALOG } from "./resources/catalog.ts";
import { createWorld } from "./world.ts";

test("timber - eight woods sit in the catalog", () => {
  const woods = RESOURCE_IDS.filter((id) => RESOURCE_CATALOG[id].kind === "timber");
  assert.deepEqual(woods, ["oak", "pine", "willow", "birch", "ash", "redwood", "yew", "ghostwood"]);
  assert.equal(timberGradeLabel("pristine"), "hardened");
  assert.equal(timberGradeLabel("rough"), "rough");
});

test("ghostwood - the living do not see it; a skilled ghost can cut it", () => {
  const w = createWorld();
  const p = you(w)!;
  w.tiles[p.z]![p.x]!.kind = "tree";
  w.plantedTimber[`${Math.round(p.x)},${Math.round(p.z)}`] = "ghostwood";
  const tx = Math.round(p.x);
  const ty = Math.round(p.z);
  assert.equal(isGhostwoodTree(w, tx, ty), true);
  w.player.wear.main = "hatchet";
  assert.equal(commandChop(w, tx, ty), "You see no tree.");

  w.player.ghost = true;
  p.ghost = true;
  w.player.skills.lumberjack = 20;
  assert.equal(commandChop(w, tx, ty), "A ghost cannot.");

  w.player.skills.lumberjack = GHOSTWOOD_LUMBERJACK;
  assert.equal(commandChop(w, tx, ty), null);
  assert.equal(w.player.intent.kind, "chop");
});
