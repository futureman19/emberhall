import assert from "node:assert/strict";
import test from "node:test";
import { thinHorizonTrees } from "./horizon-tree-density.ts";

const trees = Array.from({ length: 20 }, (_, index) => ({ index }));
const scatteredScore = (_tree: { index: number }, index: number) => ((index * 7) % 20) / 20;

test("full density preserves every tree in traversal order", () => {
  assert.deepEqual(thinHorizonTrees(trees, 0, scatteredScore), trees);
});

test("15% and 30% reductions remove the exact requested share", () => {
  assert.equal(thinHorizonTrees(trees, 15, scatteredScore).length, 17);
  assert.equal(thinHorizonTrees(trees, 30, scatteredScore).length, 14);
});

test("density reduction thins throughout the stock instead of truncating its tail", () => {
  const selected = thinHorizonTrees(trees, 30, scatteredScore).map((tree) => tree.index);
  assert.ok(selected.includes(19), "late horizon candidates remain eligible");
  assert.ok(selected.some((index, position) => index !== position), "selection contains distributed gaps");
  assert.notDeepEqual(selected, trees.slice(0, 14).map((tree) => tree.index));
});

test("the same scored stock always produces the same selection", () => {
  assert.deepEqual(thinHorizonTrees(trees, 30, scatteredScore), thinHorizonTrees(trees, 30, scatteredScore));
});
