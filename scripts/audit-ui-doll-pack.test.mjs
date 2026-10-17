import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// Direland dressing contract: an animated doll with icon gear slots, wired
// straight into a 5×9 dark backpack grid beneath it — symbols, not words.

test("backpack is a fixed five-column dark grid filled to at least 45 cells", () => {
  const doll = read("src/components/game/paperdoll.tsx");
  assert.match(doll, /grid-cols-5/, "pack grid is five columns");
  assert.match(doll, /45/, "grid fills to the 45-cell backpack");
});

test("doll and backpack are one connected block, backpack underneath", () => {
  const doll = read("src/components/game/paperdoll.tsx");
  const block = doll.split('data-testid="doll-pack"')[1];
  assert.ok(block, "a single doll-pack container exists");
  const dollAt = block.indexOf("LivingDoll");
  const packAt = block.indexOf('data-testid="pack-grid"');
  assert.ok(dollAt > -1 && packAt > dollAt, "the backpack grid renders below the living doll inside the block");
});

test("every wear slot has an icon glyph — empty slots show the symbol, not the word", () => {
  const catalog = read("src/components/game/item-icon-catalog.ts");
  assert.match(catalog, /SLOT_ICON_KIND/);
  for (const slot of ["head", "neck", "chest", "cloak", "finger", "main", "off", "hands", "legs", "feet"])
    assert.match(catalog, new RegExp(`${slot}: "`), `slot glyph for ${slot}`);
  const doll = read("src/components/game/paperdoll.tsx");
  assert.match(doll, /SLOT_ICON_KIND/);
  assert.match(doll, /GlyphIcon/);
});

test("word headings and helper prose leave the dressing block", () => {
  const doll = read("src/components/game/paperdoll.tsx");
  assert.doesNotMatch(doll, />Paperdoll</);
  assert.doesNotMatch(doll, />Pack</);
  assert.doesNotMatch(doll, /Tap a pack cell/);
});

test("accessibility keeps the words: icon actions still speak", () => {
  const doll = read("src/components/game/paperdoll.tsx");
  assert.match(doll, /aria-label=\{pinned \? `Unpin/);
  assert.match(doll, /`\$\{label\}: \$\{name\}`/, "equipped cells name both slot and item before selection");
  const controls = read("src/components/game/equipment-controls.tsx");
  assert.match(controls, /"Stow" : "Equip"/, "selected equipment has an explicit action verb");
  assert.match(controls, /role="menuitem"/, "context actions are keyboard-accessible menu items");
});
