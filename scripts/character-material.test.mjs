import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('living character materials explicitly restore properties changed by ghost state', () => {
  const source = fs.readFileSync(new URL('../src/components/game/people-meshes.tsx', import.meta.url), 'utf8');
  const mat = source.slice(source.indexOf('function Mat('), source.indexOf('function Hatchet('));
  const living = mat.slice(mat.lastIndexOf('return <meshStandardMaterial'));
  for (const contract of ['opacity={1}', 'transparent={false}', 'depthWrite={true}', 'emissive="#000000"', 'emissiveIntensity={1}', 'roughness={0.82}']) assert(living.includes(contract), contract);
  assert(mat.includes('opacity={0.58}'), 'ghost remains translucent');
  assert(mat.includes('depthWrite={false}'), 'ghost keeps original depth behavior');
});
