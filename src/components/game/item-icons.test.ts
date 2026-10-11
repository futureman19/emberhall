import assert from "node:assert/strict";
import test from "node:test";
import { ITEM_META } from "../../game/catalog.ts";
import { RESOURCE_CATALOG } from "../../game/resources/catalog.ts";
import type { ItemId } from "../../game/types.ts";
import {
  GRADE_RING,
  ICON_PATHS,
  ITEM_ICON_KIND,
  RESOURCE_ICON_KIND,
  type IconKind,
} from "./item-icon-catalog.ts";

const PATH_TEXT = /^[Mm0-9\s.,CcLlHhVvZzAaSs-]+$/;

test("item icons - every ItemId maps to a drawn icon kind", () => {
  for (const id of Object.keys(ITEM_META) as ItemId[]) {
    const kind = ITEM_ICON_KIND[id];
    assert.ok(kind, `${id} has no icon kind`);
    assert.ok(ICON_PATHS[kind], `${id} maps to unknown kind ${kind}`);
  }
});

test("item icons - every kind has valid bold path data", () => {
  for (const [kind, glyph] of Object.entries(ICON_PATHS)) {
    assert.ok(glyph.body.trim().startsWith("M"), `${kind} body path must start with M`);
    assert.match(glyph.body, PATH_TEXT, `${kind} body has invalid path characters`);
    if (glyph.accent) assert.match(glyph.accent, PATH_TEXT, `${kind} accent has invalid path characters`);
  }
});

test("item icons - no orphan kinds (every glyph serves an item or resource family)", () => {
  const used = new Set<IconKind>([...Object.values(ITEM_ICON_KIND), ...Object.values(RESOURCE_ICON_KIND)]);
  for (const kind of Object.keys(ICON_PATHS) as IconKind[]) {
    assert.ok(used.has(kind), `icon kind ${kind} is drawn but nothing uses it`);
  }
});

test("resource icons - every catalog family maps to a drawn resource icon", () => {
  for (const [id, definition] of Object.entries(RESOURCE_CATALOG)) {
    const kind = RESOURCE_ICON_KIND[definition.kind as keyof typeof RESOURCE_ICON_KIND];
    assert.ok(kind, `resource ${id} (kind ${definition.kind}) has no icon`);
    assert.ok(ICON_PATHS[kind], `resource ${id} maps to unknown icon kind ${kind}`);
  }
});

test("resource icons - grade ring covers every material quality incl. gem clarity", () => {
  assert.deepEqual(Object.keys(GRADE_RING).sort(), ["choice", "cracked", "cut", "flawed", "flawless", "perfect", "pristine", "rough", "sound"]);
});
