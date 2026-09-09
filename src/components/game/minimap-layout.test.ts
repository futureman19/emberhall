import assert from "node:assert/strict";
import test from "node:test";
import {
  clampMinimapLayout,
  defaultMinimapLayout,
  DEFAULT_MINIMAP_SIZE,
  loadMinimapLayout,
  MAX_MINIMAP_SIZE,
  MIN_MINIMAP_SIZE,
  MINIMAP_BOTTOM_CHROME,
  saveMinimapLayout,
  type MinimapLayout,
} from "./minimap-layout.ts";

const viewport = { width: 800, height: 600 };
const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 960 };

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function dockRect(view: { width: number; height: number }) {
  const width = 198;
  const height = 54;
  return { x: (view.width - width) / 2, y: view.height - 12 - height, width, height };
}

function mapRect(layout: MinimapLayout) {
  return { x: layout.x, y: layout.y, width: layout.size, height: layout.size };
}

test("clamps minimap size and position inside the viewport", () => {
  assert.deepEqual(
    clampMinimapLayout({ x: 790, y: 590, size: 999, minimized: false }, viewport),
    {
      x: 800 - MAX_MINIMAP_SIZE - 12,
      y: 600 - MAX_MINIMAP_SIZE - MINIMAP_BOTTOM_CHROME,
      size: MAX_MINIMAP_SIZE,
      minimized: false,
    },
  );

  assert.deepEqual(
    clampMinimapLayout({ x: -50, y: -20, size: 1, minimized: false }, viewport),
    { x: 12, y: 12, size: MIN_MINIMAP_SIZE, minimized: false },
  );
});

test("a minimized map uses icon bounds without losing its chosen size", () => {
  assert.deepEqual(
    clampMinimapLayout({ x: 790, y: 590, size: 240, minimized: true }, viewport),
    { x: 744, y: 600 - 44 - MINIMAP_BOTTOM_CHROME, size: 240, minimized: true },
  );
});

test("mobile clamp keeps a grown map off the bottom dock", () => {
  const layout = clampMinimapLayout({ x: 200, y: 700, size: 220, minimized: false }, mobile);
  assert.equal(layout.size, 220);
  assert.equal(layout.y + layout.size, mobile.height - MINIMAP_BOTTOM_CHROME);
  assert.equal(overlaps(mapRect(layout), dockRect(mobile)), false);
});

test("mobile default layout does not cover the bottom dock", () => {
  const layout = defaultMinimapLayout(mobile);
  assert.equal(layout.size, DEFAULT_MINIMAP_SIZE);
  assert.equal(overlaps(mapRect(layout), dockRect(mobile)), false);
});

test("desktop default layout stays in the prior bottom-right slot", () => {
  const layout = defaultMinimapLayout(desktop);
  assert.deepEqual(layout, {
    x: 1440 - DEFAULT_MINIMAP_SIZE - 12,
    y: 960 - DEFAULT_MINIMAP_SIZE - MINIMAP_BOTTOM_CHROME,
    size: DEFAULT_MINIMAP_SIZE,
    minimized: false,
  });
  assert.equal(overlaps(mapRect(layout), dockRect(desktop)), false);
});

test("loads valid persisted layout and rejects malformed values", () => {
  const valid: MinimapLayout = { x: 120, y: 80, size: 220, minimized: true };
  const storage = new Map<string, string>();
  const adapter = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  };

  saveMinimapLayout(adapter, valid);
  assert.deepEqual(loadMinimapLayout(adapter), valid);

  storage.set("emberhall-minimap-layout-v1", JSON.stringify({ x: "bad", size: Infinity }));
  assert.deepEqual(loadMinimapLayout(adapter), {
    x: 12,
    y: 12,
    size: DEFAULT_MINIMAP_SIZE,
    minimized: false,
  });
});
