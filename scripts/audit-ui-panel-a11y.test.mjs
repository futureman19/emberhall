import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const a11y = read("../src/components/game/use-panel-a11y.ts");
const settings = read("../src/components/game/settings-gump.tsx");
const contextMenu = read("../src/components/game/context-menu.tsx");
const hud = read("../src/components/game/hud.tsx");
const actions = read("../src/components/game/actions-panel.tsx");

test("shared panel a11y hook enters focus, closes only its own layer on Escape, and restores focus", () => {
  assert.match(a11y, /document\.activeElement/);
  assert.match(a11y, /e\.key !== "Escape"/);
  assert.match(a11y, /e\.stopPropagation\(\)/);
  assert.match(a11y, /previous\.focus\(\)/);
  assert.match(a11y, /if \(!active\) return/);
});

test("settings dialog uses the hook with its open state and is labeled", () => {
  assert.match(settings, /usePanelA11y<HTMLDivElement>\(closeSettings, open\)/);
  assert.match(settings, /role="dialog"/);
  assert.match(settings, /aria-label/);
});

test("context menu and loot gump wire Escape/focus through the hook", () => {
  assert.match(contextMenu, /usePanelA11y<HTMLDivElement>\(close, Boolean\(ctx\)\)/);
  assert.match(contextMenu, /usePanelA11y<HTMLDivElement>\(closePile, Boolean\(pile\)\)/);
  assert.match(contextMenu, /role="menu"/);
  assert.match(contextMenu, /role="dialog"/);
});

test("side panel is a labeled region with Escape handling while open", () => {
  assert.match(hud, /usePanelA11y<HTMLDivElement>\(closePanel, panel !== "none"\)/);
  assert.match(hud, /role="region"/);
});

test("actions panel is a labeled dialog using the hook", () => {
  assert.match(actions, /usePanelA11y/);
  assert.match(actions, /role="dialog"/);
  assert.match(actions, /aria-label="Nearby actions"/);
});
