import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { horizonSurfaceY } from '../src/components/game/horizon-water.ts';
import { groundY } from '../src/game/height.ts';

function world(kind, h = 2) {
  return { tiles: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ kind, h }))) };
}

test('flat water stays level across the entire horizon distance range', () => {
  for (const h of [-2, 0, 2, 8]) {
    const w = world('water', h);
    for (const distance of [38, 50, 64, 110, 200, Math.hypot(200, 200)]) {
      assert.equal(horizonSurfaceY(w, 4.25, 5.75, distance), groundY(w, 4.25, 5.75) - 0.08);
    }
  }
});

test('dry land retains the existing horizon relief and depth bias exactly', () => {
  for (const kind of ['grass', 'sand', 'marsh', 'rock', 'pit', 'snow']) {
    const w = world(kind);
    for (const distance of [0, 50, 64, 110, 200]) {
      assert.equal(horizonSurfaceY(w, 4.25, 5.75, distance), groundY(w, 4.25, 5.75) * (1 + Math.max(0, distance - 50) / 320 * 0.5) - 0.08);
    }
  }
});

test('shore lift interpolates continuously with the same four ground samples', () => {
  const w = world('sand');
  for (const row of w.tiles) for (let x = 5; x < row.length; x++) row[x].kind = 'water';
  for (const x of [4, 4.001, 4.25, 4.5, 4.75, 4.999, 5]) {
    const wet = x - 4;
    const expected = groundY(w, x, 5.25) * (1 + 150 / 320 * 0.5 * (1 - wet)) - 0.08;
    assert.ok(Math.abs(horizonSurfaceY(w, x, 5.25, 200) - expected) < 1e-12);
  }
  const diagonal = world('sand');
  diagonal.tiles[5][5].kind = 'water';
  assert.equal(horizonSurfaceY(diagonal, 4.5, 4.5, 200), groundY(diagonal, 4.5, 4.5) * (1 + 150 / 320 * 0.5 * 0.75) - 0.08);
});

test('render helper does not mutate terrain and handles map-edge samples', () => {
  const w = world('water');
  const before = JSON.stringify(w);
  for (const [x, z] of [[-0.5, 4], [15.5, 15.5], [600, 600]]) assert.ok(Number.isFinite(horizonSurfaceY(w, x, z, 200)));
  assert.equal(JSON.stringify(w), before);
});

test('horizon renderer uses the water-aware surface without changing its hole or grid', () => {
  const source = readFileSync('src/components/game/terrain.tsx', 'utf8');
  assert.match(source, /hole \|\| off \? -8 : horizonSurfaceY\(w, wx, wz, dist\)/);
  assert.ok(source.includes('const HORIZON = 400;'));
  assert.ok(source.includes('const HSEGS = 50;'));
  assert.ok(source.includes('const hole = dist < VIEW / 2 - 26;'));
});
