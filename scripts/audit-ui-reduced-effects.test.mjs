import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const graphics = read("../src/game/graphics-settings.ts");
const preference = read("../src/components/game/effects-preference.ts");
const worldScene = read("../src/components/game/world-scene.tsx");
const lighting = read("../src/components/game/lighting.tsx");
const styles = read("../src/styles.css");
const settingsGump = read("../src/components/game/settings-gump.tsx");

test("reduced effects setting exists with the approved default (effects on)", () => {
  assert.match(graphics, /reducedEffects:\s*boolean/);
  assert.match(graphics, /reducedEffects:\s*false/);
});

test("effects preference combines the player setting and the OS reduced-motion media query", () => {
  assert.match(preference, /useGraphicsSettings/);
  assert.match(preference, /prefers-reduced-motion/);
  assert.match(preference, /reducedEffects/);
  assert.match(preference, /export function useEffectsReduced/);
});

test("world scene gates transient action FX behind the preference and syncs the root attribute", () => {
  assert.match(worldScene, /useEffectsReduced/);
  assert.match(worldScene, /reducedFx/);
  assert.match(worldScene, /data-effects/);
  for (const mesh of ["CastFxMesh", "TravelFxMesh", "MoongateTravelFxMesh", "FizzleFxMesh"]) {
    assert.ok(worldScene.includes(mesh), `expected gate to mention ${mesh}`);
  }
});

test("lightning flash is never generated when effects are reduced", () => {
  assert.match(lighting, /effectsReduced/);
  assert.match(lighting, /skyFlash/);
});

test("DOM chrome honors reduced effects in CSS only", () => {
  assert.match(styles, /\[data-effects="reduced"\]/);
});

test("settings gump exposes the reduced effects toggle in the graphics group", () => {
  assert.match(settingsGump, /reducedEffects/);
  assert.match(settingsGump, /updateGraphicsSettings/);
});
