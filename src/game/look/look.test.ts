// The looking glass keeps its promises:
//  - the catalog speaks only the vale's colors
//  - resolve never invents: absent look -> exactly today's hard-coded figure
//  - partial recipes fill from defaults, never from nothing
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LOOK, GARB_TINTS, HAIR_COLORS, HAIR_STYLES, SKIN_TONES } from "./catalog.ts";
import { resolveLook } from "./resolve.ts";
import { LOOK_SCHEMA } from "./types.ts";

const HEX = /^#[0-9a-f]{6}$/;

test("catalog: unique ids, valid hexes, no orphan styles", () => {
  for (const set of [SKIN_TONES, HAIR_COLORS, GARB_TINTS]) {
    const ids = set.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate swatch id");
    for (const s of set) assert.match(s.hex, HEX, `bad hex ${s.hex}`);
    for (const s of set) assert.ok(s.label.length > 0, "swatch needs a label");
  }
  const styleIds = HAIR_STYLES.map((s) => s.id);
  assert.equal(new Set(styleIds).size, styleIds.length, "duplicate style id");
  assert.ok(styleIds.includes(DEFAULT_LOOK.hairStyle), "default style must exist");
});

test("parity: no stored look resolves to today's hard-coded figure", () => {
  // people-meshes.tsx: SKIN #c9c3b6, HAIR #3a322c, player chest #a85a42.
  assert.deepEqual(resolveLook(undefined), {
    skin: "#c9c3b6",
    hairStyle: "crop",
    hairColor: "#3a322c",
    garb: "#a85a42",
  });
  assert.deepEqual(resolveLook(null), resolveLook(undefined));
  assert.deepEqual(resolveLook({ schema: LOOK_SCHEMA }), resolveLook(undefined));
});

test("partial recipes fill from defaults; bad values fall back", () => {
  const r = resolveLook({ schema: LOOK_SCHEMA, skin: "#96795D", garb: "not-a-color", hairStyle: "long" });
  assert.equal(r.skin, "#96795d");
  assert.equal(r.garb, DEFAULT_LOOK.garb);
  assert.equal(r.hairStyle, "long");
  assert.equal(r.hairColor, DEFAULT_LOOK.hairColor);
  // @ts-expect-error intentionally bogus style id
  assert.equal(resolveLook({ schema: LOOK_SCHEMA, hairStyle: "mohawk" }).hairStyle, DEFAULT_LOOK.hairStyle);
});

test("round-trip: every catalog choice survives resolve", () => {
  for (const skin of SKIN_TONES) {
    for (const hair of HAIR_COLORS) {
      const r = resolveLook({ schema: LOOK_SCHEMA, skin: skin.hex, hairColor: hair.hex });
      assert.equal(r.skin, skin.hex);
      assert.equal(r.hairColor, hair.hex);
    }
  }
  for (const g of GARB_TINTS) {
    assert.equal(resolveLook({ schema: LOOK_SCHEMA, garb: g.hex }).garb, g.hex);
  }
  for (const s of HAIR_STYLES) {
    assert.equal(resolveLook({ schema: LOOK_SCHEMA, hairStyle: s.id }).hairStyle, s.id);
  }
});
