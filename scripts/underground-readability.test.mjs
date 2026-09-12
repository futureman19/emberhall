import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/game/lighting.tsx', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const frozen = readFileSync(new URL('./fixtures/u6-lighting-frozen.txt', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const expressions = text => [
  text.match(/const ambI =\s*([^;]+);/)[1],
  text.match(/const dirI =\s*([^;]+);/)[1],
  text.match(/hemi\.current\.intensity = ([^;]+);/)[1],
];
const evaluate = (expression, pit, night, dusk, climate, woodlandFill = 0) =>
  Function('pit', 'night', 'dusk', 'climate', 'woodlandFill', `return (${expression})`)(pit, night, dusk, climate, woodlandFill);

test('pit fill retains the bounded visibility floor without changing nightSight-dependent branches', () => {
  // Numeric floor only: screenshot acceptance remains an independent gate.
  for (const night of [false, true]) for (const dusk of [false, true]) {
    const values = expressions(source).map(expression => evaluate(expression, true, night, dusk, 'taiga'));
    assert.deepEqual(values, [0.28, 0.6, 0.16]);
    assert.ok(values[0] >= 0.28 && values[1] >= 0.6 && values[2] >= 0.16);
    const clearDay = expressions(source).map(expression => evaluate(expression, false, false, false, 'grassland'));
    values.forEach((value, index) => assert.ok(value < clearDay[index], 'retain dark pit versus clear daylight'));
  }
});

test('every surface lighting expression is byte-identical after the pit literal', () => {
  const current = expressions(source), original = expressions(frozen);
  current.forEach((expression, index) => assert.equal(expression.replace(/pit \? [\d.]+/, 'pit ? FLOOR'), original[index].replace(/pit \? [\d.]+/, 'pit ? FLOOR')));
  for (const night of [false, true]) for (const dusk of [false, true]) {
    for (const climate of ['taiga', 'jungle', 'grassland']) for (const fill of [0, 0.5, 1]) {
      current.forEach((expression, index) => assert.equal(evaluate(expression, false, night, dusk, climate, fill), evaluate(original[index], false, night, dusk, climate, fill)));
    }
  }
});

test('full lighting source differs from frozen only in approved pit fog and three pit fill values', () => {
  const expected = frozen
    .replace('pit ? 0.1 : night', 'pit ? 0.28 : night')
    .replace('pit ? 0.12 : night', 'pit ? 0.6 : night')
    .replace('pit ? 0.04 : night', 'pit ? 0.16 : night')
    .replace('      fog.current.density = pit ? 0.14', '      // FogExp2 measures from the camera, not the player. At the fixed\n      // tactical view (~35 units), 0.14 erases even nearby cave geometry.\n      fog.current.density = pit ? 0.02');
  assert.equal(source, expected);
});
