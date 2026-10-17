import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('fishing reuses the temporary ribbon for approach, cast, wait and bite', () => {
  const hud = fs.readFileSync('src/components/game/hud.tsx', 'utf8');
  for (const text of ['Walking to the bank', 'Casting the line', 'Waiting for a bite', 'A tug — reeling in', 'data-testid="fishing-status"']) assert.ok(hud.includes(text), text);
});
test('Pack exposes the catch and specific roast/eat actions', () => {
  const ui = fs.readFileSync('src/components/game/paperdoll.tsx', 'utf8');
  for (const text of ['data-testid="pond-supper"', 'Roast fish', 'eat("cooked_fish")', 'craft("roast_fish")', 'Build campfire · 3 wood', 'data-testid="pack-feedback"']) assert.ok(ui.includes(text), text);
});
