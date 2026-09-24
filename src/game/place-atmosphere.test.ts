import assert from "node:assert/strict";
import test from "node:test";
import { cemeteryHaze, inRuins, placeById } from "./atlas.ts";
import { ruinsExtraThorn, ruinsThornInstead } from "../components/game/flora-eligibility.ts";

test("Cairn of Ash and Greybarrow are ruins; the hall is not", () => {
  const cairn = placeById("cairnash");
  const barrow = placeById("greybarrow");
  const hall = placeById("emberhall");
  assert.equal(cairn.kind, "ruins");
  assert.equal(barrow.kind, "ruins");
  assert.equal(inRuins(cairn.tx, cairn.ty), true);
  assert.equal(inRuins(barrow.tx, barrow.ty), true);
  assert.equal(inRuins(hall.tx, hall.ty), false);
  assert.equal(inRuins(256, 292), false);
});

test("Greybarrow keeps a ground haze; Emberhall does not", () => {
  assert.ok(cemeteryHaze(110, 440) > 0.5);
  assert.equal(cemeteryHaze(256, 292), 0);
});

test("ruins turn ordinary flora into thorn and add extra bramble", () => {
  assert.equal(ruinsThornInstead(1), 0);
  assert.equal(ruinsThornInstead(3), 0);
  assert.equal(ruinsThornInstead(-1), -1);
  assert.equal(ruinsExtraThorn(false, 0.09), true);
  assert.equal(ruinsExtraThorn(false, 0.11), false);
  assert.equal(ruinsExtraThorn(true, 0.2), true);
  assert.equal(ruinsExtraThorn(true, 0.23), false);
});
