import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  defaultMinimapLayout,
  hasSavedMinimapLayout,
  loadMinimapLayout,
  MINIMAP_STORAGE_KEY,
  minimapStorage,
  saveMinimapLayout,
} from "../src/components/game/minimap-layout.ts";

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("throwing getItem degrades to the default map, not an exception", () => {
  const throwing = {
    getItem() {
      throw new DOMException("denied", "SecurityError");
    },
  };
  assert.equal(hasSavedMinimapLayout(throwing), false);
  const layout = loadMinimapLayout(throwing);
  assert.equal(layout.size, 160);
  assert.equal(layout.minimized, false);
});

test("throwing localStorage getter yields null storage", () => {
  const realWindow = globalThis.window;
  globalThis.window = Object.create(null, {
    localStorage: {
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    },
  });
  try {
    assert.equal(minimapStorage(), null);
  } finally {
    globalThis.window = realWindow;
  }
});

test("absent window yields null storage", () => {
  const realWindow = globalThis.window;
  delete globalThis.window;
  try {
    assert.equal(minimapStorage(), null);
  } finally {
    globalThis.window = realWindow;
  }
});

test("malformed saved layout still falls back, valid layout still loads", () => {
  const storage = memoryStorage();
  storage.values.set(MINIMAP_STORAGE_KEY, "{not json");
  assert.equal(hasSavedMinimapLayout(storage), true);
  assert.deepEqual(loadMinimapLayout(storage), { x: 12, y: 12, size: 160, minimized: false });
  storage.values.set(MINIMAP_STORAGE_KEY, JSON.stringify({ x: 40, y: 50, size: 200, minimized: true }));
  assert.deepEqual(loadMinimapLayout(storage), { x: 40, y: 50, size: 200, minimized: true });
});

test("quota failure on save never throws", () => {
  const full = {
    setItem() {
      throw new DOMException("full", "QuotaExceededError");
    },
  };
  assert.doesNotThrow(() => saveMinimapLayout(full, defaultMinimapLayout({ width: 800, height: 600 })));
});

test("minimap component reads and writes storage only through the guarded helpers", () => {
  const source = readFileSync(new URL("../src/components/game/movable-minimap.tsx", import.meta.url), "utf8");
  assert.ok(!source.includes("localStorage.getItem"), "no raw localStorage read before the guard");
  assert.ok(!source.includes("localStorage,"), "no raw localStorage passed to helpers");
  assert.ok(source.includes("minimapStorage()"));
  assert.ok(source.includes("hasSavedMinimapLayout(storage)"));
});
