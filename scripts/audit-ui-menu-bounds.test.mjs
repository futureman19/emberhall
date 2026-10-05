import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  clampMenuPosition,
  MENU_FALLBACK_HEIGHT,
  MENU_FALLBACK_WIDTH,
  MENU_VIEWPORT_MARGIN,
  menuMaxHeight,
} from "../src/components/game/menu-bounds.ts";

const desktop = { width: 1440, height: 960 };
const shortLandscape = { width: 740, height: 360 };

// The audit's longest case: owned living pet — six verbs + Cancel at 44px
// each, plus heading and padding (~344px total).
const longestMenu = { width: 200, height: 344 };
const shortestMenu = { width: 168, height: 96 };

test("menu clamps inside the bottom-right corner on a short landscape viewport", () => {
  const pos = clampMenuPosition({ x: 730, y: 350 }, longestMenu, shortLandscape);
  assert.ok(pos.x >= MENU_VIEWPORT_MARGIN);
  assert.ok(pos.y >= MENU_VIEWPORT_MARGIN);
  assert.ok(pos.x + longestMenu.width <= shortLandscape.width - MENU_VIEWPORT_MARGIN);
  assert.ok(pos.y + longestMenu.height <= shortLandscape.height - MENU_VIEWPORT_MARGIN);
});

test("menu clamps inside the top-left corner and keeps the click point when it fits", () => {
  assert.deepEqual(clampMenuPosition({ x: 0, y: 0 }, shortestMenu, desktop), {
    x: MENU_VIEWPORT_MARGIN,
    y: MENU_VIEWPORT_MARGIN,
  });
  assert.deepEqual(clampMenuPosition({ x: 400, y: 300 }, shortestMenu, desktop), { x: 400, y: 300 });
});

test("menu never overflows a viewport smaller than itself", () => {
  const tiny = { width: 150, height: 120 };
  const pos = clampMenuPosition({ x: 149, y: 119 }, longestMenu, tiny);
  assert.equal(pos.x, MENU_VIEWPORT_MARGIN);
  assert.equal(pos.y, MENU_VIEWPORT_MARGIN);
  assert.ok(menuMaxHeight(tiny) >= 96);
});

test("menu height budget leaves both margins on real viewports", () => {
  assert.equal(menuMaxHeight(desktop), desktop.height - MENU_VIEWPORT_MARGIN * 2);
  const shorter = { width: 740, height: 320 };
  assert.equal(menuMaxHeight(shorter), shorter.height - MENU_VIEWPORT_MARGIN * 2);
  assert.ok(longestMenu.height > menuMaxHeight(shorter), "longest pet menu must scroll on short landscape");
});

test("fallback bounds cover the unmeasured first frame", () => {
  assert.ok(MENU_FALLBACK_WIDTH >= 180);
  assert.ok(MENU_FALLBACK_HEIGHT >= 220);
});

test("context menu measures itself, scrolls its verbs and pins Cancel", () => {
  const source = readFileSync(new URL("../src/components/game/context-menu.tsx", import.meta.url), "utf8");
  const menu = source.split("export function PileGump()")[0];
  for (const token of [
    "clampMenuPosition",
    "menuMaxHeight",
    "getBoundingClientRect",
    "useLayoutEffect",
    "min-h-0 overflow-y-auto overscroll-contain",
    'role="menu"',
    "aria-label={`Actions for ${ctx.target.label}`}",
    "shrink-0 items-center border-t border-border",
  ]) {
    assert.ok(menu.includes(token), token);
  }
  // The old unmeasured reservation is gone.
  assert.ok(!menu.includes("window.innerWidth - 180"), "no fixed 180px width assumption");
  assert.ok(!menu.includes("window.innerHeight - 220"), "no fixed 220px height reservation");
});
