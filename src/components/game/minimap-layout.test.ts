import assert from "node:assert/strict";
import test from "node:test";
import {
  clampMinimapLayout,
  DEFAULT_MINIMAP_SIZE,
  loadMinimapLayout,
  MAX_MINIMAP_SIZE,
  MIN_MINIMAP_SIZE,
  saveMinimapLayout,
  type MinimapLayout,
} from "./minimap-layout.ts";

const viewport = { width: 800, height: 600 };

test("clamps minimap size and position inside the viewport", () => {
  assert.deepEqual(
    clampMinimapLayout({ x: 790, y: 590, size: 999, minimized: false }, viewport),
    {
      x: 800 - MAX_MINIMAP_SIZE - 12,
      y: 600 - MAX_MINIMAP_SIZE - 12,
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
    { x: 744, y: 544, size: 240, minimized: true },
  );
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
