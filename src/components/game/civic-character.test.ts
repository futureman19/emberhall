import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { civicCharacterArt, civicVisualYaw } from './civic-character.ts';

test('only three starting civic roles inherit approved authored proportions', () => {
  for (const role of ['banker', 'provisioner', 'healer']) {
    assert.equal(civicCharacterArt({ role, home: { tx: 258, ty: 293 }, isPlayer: false }), true);
    assert.equal(civicCharacterArt({ role, home: { tx: 178, ty: 339 }, isPlayer: false }), false);
    assert.equal(civicCharacterArt({ role, home: null, isPlayer: false }), false);
  }
  assert.equal(civicCharacterArt({ role: 'guard', home: { tx: 258, ty: 293 }, isPlayer: false }), false);
  assert.equal(civicCharacterArt({ role: null, home: null, isPlayer: true }), true);
});

test('authored negative-Z front uses one PI correction; original NPC yaw untouched', () => {
  for (const facing of [0, Math.PI/2, Math.PI, -Math.PI/2]) {
    assert.equal(civicVisualYaw(facing, true), facing + Math.PI);
    assert.equal(civicVisualYaw(facing, false), facing);
  }
});

test('integration keeps original animation anchors and applies matched initial/live yaw', () => {
  const source = fs.readFileSync(new URL('./people-meshes.tsx', import.meta.url), 'utf8');
  assert.match(source, /const authored = civicCharacterArt\(p\)/);
  assert.match(source, /civicVisualYaw\(live.facing, authored\) \+ pose.turn/);
  assert.match(source, /civicVisualYaw\(p.facing, authored\)/);
  assert.doesNotMatch(source, /authored=\{p.isPlayer\}/);
  assert.match(source, /ref=\{left\}/);
  assert.match(source, /ref=\{right\}/);
});
