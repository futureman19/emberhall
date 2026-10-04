import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/components/game/lighting.tsx', import.meta.url), 'utf8');
const density = Number(source.match(/fog\.current\.density = pit \? ([\d.]+)/)?.[1]);

test('underground fog retains scene contrast at the unchanged tactical camera depth', () => {
  // Live Greybarrow mouth -> pit capture: player ground view depth 34.60447.
  // Three FogExp2 transmittance is exp(-(density * viewDepth)^2).
  for (const depth of [30, 34.604471590606636, 40]) {
    const contrast = Math.exp(-((density * depth) ** 2));
    assert.ok(contrast > 0.5, `only ${contrast} scene contrast at depth ${depth}`);
  }
  assert.ok(density > 0.007, 'retain denser underground atmosphere than clear surface');
});

test('surface fog and approved daylight override remain unchanged', () => {
  assert.match(source, /fog\.current\.density = pit \? [\d.]+ : 0\.007 \+ cloud \* 0\.005 \+ rain \* 0\.008;/);
  const debug = readFileSync(new URL('../src/game/debug.ts', import.meta.url), 'utf8');
  assert.match(debug, /DEV_DAYLIGHT\s*=\s*true/);
});
