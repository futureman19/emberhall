import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const actions = read("../src/components/game/actions-panel.tsx");
const targets = read("../src/components/game/actions-targets.ts");
const hud = read("../src/components/game/hud.tsx");

test("actions targets come from existing snapshot entities and tile scans only", () => {
  assert.match(targets, /snap\.people/);
  assert.match(targets, /snap\.fauna/);
  assert.match(targets, /snap\.piles/);
  assert.match(targets, /snap\.herbs/);
  assert.match(targets, /snap\.plots/);
  assert.match(targets, /getWorld\(\)/);
  for (const kind of ['"tree"', '"rock"', '"water"']) {
    assert.ok(targets.includes(kind), `expected resource tile kind ${kind}`);
  }
});

test("actions panel runs existing store commands and verb resolution — no new command API", () => {
  assert.match(actions, /verbsFor\(entry\.target\)/);
  assert.match(actions, /doVerb\(v\.verb, target\)/);
  assert.doesNotMatch(actions, /useGame\.setState\(\{/);
});

test("keyboard shortcut is the period key, ignores typing contexts and key repeat", () => {
  assert.match(hud, /e\.key !== "\."/);
  assert.match(hud, /e\.repeat/);
  assert.match(hud, /tagName === "INPUT"/);
  assert.match(hud, /tagName === "TEXTAREA"/);
  assert.match(hud, /isContentEditable/);
});

test("dock exposes the actions toggle with state", () => {
  assert.match(hud, /aria-label="Nearby actions — keyboard: period"/);
  assert.match(hud, /aria-expanded=\{actionsOpen\}/);
});

test("vitals are meters with numeric values", () => {
  assert.match(hud, /role="meter"/);
  assert.match(hud, /aria-label="Health"/);
  assert.match(hud, /aria-label="Mana"/);
  assert.match(hud, /aria-valuenow=\{/);
  assert.match(hud, /aria-valuemax=\{/);
});

test("reading tabs follow the tabs pattern with arrow-key movement and panels", () => {
  assert.match(hud, /role="tablist"/);
  assert.match(hud, /role="tab"/);
  assert.match(hud, /role="tabpanel"/);
  assert.match(hud, /aria-controls=\{`reading-panel-\$\{t\.id\}`\}/);
  assert.match(hud, /aria-labelledby=\{`reading-tab-\$\{tab\}`\}/);
  assert.match(hud, /"ArrowRight"/);
  assert.match(hud, /"ArrowLeft"/);
  assert.match(hud, /tabIndex=\{tab === t\.id \? 0 : -1\}/);
});
