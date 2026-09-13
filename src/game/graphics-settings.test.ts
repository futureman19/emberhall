import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_GRAPHICS_SETTINGS,
  GRAPHICS_STORAGE_KEY,
  loadGraphicsSettings,
  saveGraphicsSettings,
  type GraphicsSettings,
} from "./graphics-settings.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

test("graphics settings default to full quality and full effects", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadGraphicsSettings(storage), DEFAULT_GRAPHICS_SETTINGS);
  assert.equal(DEFAULT_GRAPHICS_SETTINGS.reducedEffects, false);
});

test("graphics settings persist shadows, supported tree reductions and reduced effects", () => {
  const storage = memoryStorage();
  for (const horizonTreeReduction of [0, 15, 30] as const) {
    const settings: GraphicsSettings = {
      shadows: horizonTreeReduction !== 30,
      horizonTreeReduction,
      reducedEffects: horizonTreeReduction === 15,
    };
    saveGraphicsSettings(storage, settings);
    assert.deepEqual(loadGraphicsSettings(storage), settings);
  }
});

test("graphics settings saved before reduced effects existed load with effects on", () => {
  const storage = memoryStorage();
  storage.values.set(GRAPHICS_STORAGE_KEY, JSON.stringify({ shadows: false, horizonTreeReduction: 15 }));
  assert.deepEqual(loadGraphicsSettings(storage), {
    shadows: false,
    horizonTreeReduction: 15,
    reducedEffects: false,
  });
});

test("graphics settings reject malformed and unsupported values", () => {
  const storage = memoryStorage();
  for (const value of [
    "not json",
    JSON.stringify({ shadows: "yes", horizonTreeReduction: 15 }),
    JSON.stringify({ shadows: false, horizonTreeReduction: 25 }),
    JSON.stringify({ shadows: false, horizonTreeReduction: 30, extra: true }),
    JSON.stringify({ shadows: false, horizonTreeReduction: 30, reducedEffects: "yes" }),
  ]) {
    storage.values.set(GRAPHICS_STORAGE_KEY, value);
    assert.deepEqual(loadGraphicsSettings(storage), DEFAULT_GRAPHICS_SETTINGS);
  }
});
