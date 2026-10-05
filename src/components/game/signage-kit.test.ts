import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signageKitName } from './signage-kit.ts';

test('signage selects only built notice and board kinds worldwide', () => {
  for (const kind of ['notice', 'board']) {
    assert.equal(signageKitName(kind, 263, 291), kind);
    assert.equal(signageKitName(kind, 274, 292), kind);
    assert.equal(signageKitName(kind, 274.01, 292), kind);
    assert.equal(signageKitName(kind, 0, 0), kind);
    assert.equal(signageKitName(kind, NaN, 292), null);
  }
  for (const kind of ['hall', 'shop', 'bank', 'market', 'farm', 'unknown']) {
    assert.equal(signageKitName(kind, 256, 292), null);
  }
});

test('signage does not alter original board/notice footprint or invent an interaction', () => {
  const generators = fs.readFileSync(new URL('../../game/placeables/legacy-buildings.ts', import.meta.url), 'utf8');
  const source = fs.readFileSync(new URL('./building-meshes.tsx', import.meta.url), 'utf8');
  const notice = generators.slice(generators.indexOf('function makeNotice()'), generators.indexOf('function makeFarm()'));
  const board = generators.slice(generators.indexOf('function makeBoard()'), generators.indexOf('/** The King'));
  assert.match(notice, /x0: -1, x1: 1, z0: 0, z1: 2, enterable: false/);
  assert.match(board, /x0: -3, x1: 3, z0: 0, z1: 2, enterable: false/);
  assert.match(source, /if \(!stationOf\(b.kind\)\) return;/);
  const ghost = source.slice(source.indexOf('function GhostAt('));
  assert.doesNotMatch(ghost, /signageKitName|useArtistKit/);
});
