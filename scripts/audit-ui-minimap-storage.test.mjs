import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dockStorage,
  loadCollapsed,
  MINIMAP_DOCK_KEY,
  saveCollapsed,
} from "../src/components/game/chrome/minimap-dock.ts";

test("throwing getItem degrades to the fallback, not an exception", () => {
  const throwing = {
    getItem() {
      throw new DOMException("denied", "SecurityError");
    },
  };
  assert.equal(loadCollapsed(throwing, false), false);
  assert.equal(loadCollapsed(throwing, true), true);
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
    assert.equal(dockStorage(), null);
  } finally {
    globalThis.window = realWindow;
  }
});

test("absent window yields null storage", () => {
  const realWindow = globalThis.window;
  delete globalThis.window;
  try {
    assert.equal(dockStorage(), null);
  } finally {
    globalThis.window = realWindow;
  }
});

test("malformed saved flag falls back, valid flag loads", () => {
  const values = new Map([[MINIMAP_DOCK_KEY, "{not json"]]);
  const storage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  assert.equal(loadCollapsed(storage, true), true);
  storage.setItem(MINIMAP_DOCK_KEY, "1");
  assert.equal(loadCollapsed(storage, false), true);
});

test("quota failure on save never throws", () => {
  const full = {
    setItem() {
      throw new DOMException("full", "QuotaExceededError");
    },
  };
  assert.doesNotThrow(() => saveCollapsed(full, true));
});

test("minimap chrome reads and writes storage only through the guarded helpers", () => {
  for (const file of ["../src/components/game/chrome/docked-minimap.tsx", "../src/components/game/chrome/use-minimap-dock.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.ok(!source.includes("localStorage.getItem"), `${file}: no raw localStorage read before the guard`);
    assert.ok(!source.includes("localStorage,"), `${file}: no raw localStorage passed to helpers`);
  }
  const hook = readFileSync(new URL("../src/components/game/chrome/use-minimap-dock.ts", import.meta.url), "utf8");
  assert.ok(hook.includes("dockStorage()"));
});
