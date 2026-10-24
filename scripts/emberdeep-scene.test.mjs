import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../src/components/game/emberdeep-scene.tsx',import.meta.url),'utf8');
test('underground rendering clips the overworld and restores renderer ownership on exit',()=>{
 assert.match(source,/const previous = gl\.clippingPlanes/);
 assert.match(source,/gl\.clippingPlanes = \[/);
 assert.match(source,/gl\.clippingPlanes = previous/);
 assert.match(source,/new THREE\.Vector3\(1, 0, 0\), -EMBERDEEP_BOUNDS\.x0/);
 assert.match(source,/new THREE\.Vector3\(-1, 0, 0\), EMBERDEEP_BOUNDS\.x1/);
 assert.match(source,/new THREE\.Vector3\(0, 0, 1\), -EMBERDEEP_BOUNDS\.y0/);
 assert.match(source,/new THREE\.Vector3\(0, 0, -1\), EMBERDEEP_BOUNDS\.y1/);
});
test('cached offhand geometry stays an external mesh property, fallback resources remain declarative',()=>{
 assert.match(source,/geometry=\{handle \?\? undefined\}/);
 assert.match(source,/geometry=\{ember \?\? undefined\}/);
 assert.doesNotMatch(source,/handle\.dispose|ember\.dispose/);
});
