import assert from "node:assert/strict";
import test from "node:test";
import {
  MINIMAP_DOCK_KEY,
  dockStorage,
  loadCollapsed,
  saveCollapsed,
} from "./minimap-dock.ts";

type MemoryStorage = Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> };

function memoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

test("loadCollapsed falls back when nothing is stored", () => {
  assert.equal(loadCollapsed(memoryStorage(), true), true);
  assert.equal(loadCollapsed(memoryStorage(), false), false);
});

test("save then load round-trips the collapsed flag", () => {
  const storage = memoryStorage();
  saveCollapsed(storage, true);
  assert.equal(storage.data.get(MINIMAP_DOCK_KEY), "1");
  assert.equal(loadCollapsed(storage, false), true);
  saveCollapsed(storage, false);
  assert.equal(loadCollapsed(storage, true), false);
});

test("garbage in storage falls back instead of crashing", () => {
  assert.equal(loadCollapsed(memoryStorage({ [MINIMAP_DOCK_KEY]: "yes" }), true), true);
  assert.equal(loadCollapsed(memoryStorage({ [MINIMAP_DOCK_KEY]: "{\"x\":1}" }), false), false);
  assert.equal(loadCollapsed(memoryStorage({ [MINIMAP_DOCK_KEY]: "" }), true), true);
});

test("a throwing store never breaks the HUD", () => {
  const broken: MemoryStorage = {
    data: new Map(),
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("SecurityError");
    },
  };
  assert.equal(loadCollapsed(broken, false), false);
  assert.doesNotThrow(() => saveCollapsed(broken, true));
});

test("dockStorage is null without a window (node tests)", () => {
  assert.equal(dockStorage(), null);
});
