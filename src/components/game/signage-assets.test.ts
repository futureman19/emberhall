import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('notice and board real GLTFLoader assets satisfy footprint, palette, pivot and budgets', () => {
  const result = spawnSync(process.execPath, ['scripts/measure-signage.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const measured = JSON.parse(result.stdout);
  const manifest = JSON.parse(readFileSync('public/art/lanternwood/signage-manifest.json', 'utf8'));
  assert.deepEqual(measured, manifest);
  assert.deepEqual(Object.keys(measured.assets).sort(), ['board', 'notice']);
});
