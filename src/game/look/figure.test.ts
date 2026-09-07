import assert from "node:assert/strict";
import { test } from "node:test";
import { FIGURE, HAIR, SLOT_ANCHOR } from "./figure.ts";
import { PART_GRID } from "./parts.ts";

function top(y: number, h: number) {
  return y + h / 2;
}
function bot(y: number, h: number) {
  return y - h / 2;
}

test("chibi: feet rest on the dirt, stack has no gaps", () => {
  assert.ok(Math.abs(bot(FIGURE.foot.y, FIGURE.foot.size[1])) < 0.001);
  assert.ok(Math.abs(top(FIGURE.foot.y, FIGURE.foot.size[1]) - bot(FIGURE.leg.y, FIGURE.leg.size[1])) < 0.02);
  assert.ok(Math.abs(top(FIGURE.leg.y, FIGURE.leg.size[1]) - bot(FIGURE.torso.y, FIGURE.torso.size[1])) < 0.02);
  assert.ok(Math.abs(top(FIGURE.torso.y, FIGURE.torso.size[1]) - bot(FIGURE.head.y, FIGURE.head.size[1])) < 0.02);
});

test("chibi: head is the big blank, legs are stubs", () => {
  assert.ok(FIGURE.head.size[1] > FIGURE.leg.size[1], "head taller than a leg");
  assert.ok(FIGURE.head.size[0] >= FIGURE.torso.size[0] - 0.02, "head nearly as wide as the torso");
  assert.ok(FIGURE.leg.size[1] < 0.28, "stubby legs");
  assert.ok(HAIR.cap.size[0] >= FIGURE.head.size[0], "hair puffs past the skull");
});

test("anchors: every slot sits on the figure, voxels fit the grid", () => {
  const headTop = top(FIGURE.head.y, FIGURE.head.size[1]);
  assert.ok(Math.abs(SLOT_ANCHOR.hair.at[1] - headTop) < 0.05);
  for (const slot of Object.keys(SLOT_ANCHOR) as (keyof typeof SLOT_ANCHOR)[]) {
    const { at, voxel } = SLOT_ANCHOR[slot];
    assert.equal(at.length, 3);
    const span = voxel * PART_GRID;
    assert.ok(span > 0.2 && span < 0.4, `${slot} span ${span}`);
  }
});
