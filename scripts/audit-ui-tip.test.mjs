import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const tip = read("../src/components/ui/tip.tsx");
const paperdoll = read("../src/components/game/paperdoll.tsx");
const npcGump = read("../src/components/game/npc-gump.tsx");

test("tip shows on keyboard focus as well as hover and links with aria-describedby", () => {
  assert.match(tip, /onFocus/);
  assert.match(tip, /onBlur/);
  assert.match(tip, /useId/);
  assert.match(tip, /aria-describedby/);
  assert.match(tip, /role="tooltip"/);
  assert.match(tip, /Escape/);
});

test("tip does not swallow child events or change child semantics", () => {
  assert.doesNotMatch(tip, /preventDefault/);
  assert.match(tip, /cloneElement/);
});

test("paperdoll slots and rows expose item details to keyboard via Inspect", () => {
  assert.match(paperdoll, /InspectTip/);
  assert.match(paperdoll, /ItemTipContent/);
  assert.match(paperdoll, /aria-label=\{`Inspect \$\{label\}`\}/);
});

test("shop rows expose item details to keyboard via Inspect", () => {
  assert.match(npcGump, /InspectableRow/);
  assert.match(npcGump, /ItemTipContent/);
});
