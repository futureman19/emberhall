import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Group} from 'three';
import {extractWeaponGeometry, WEAPON_BOUNDS, createExactWeaponGeometry} from './weapon-geometry.ts';
for (const [form, height] of [['dagger', 0.42], ['spear', 1.4], ['war_axe', 0.8]] as const) {
 test(`parametric ${form} has finite edge and hilt, a centered grip and distinct envelope`, () => {
  const parts = createExactWeaponGeometry(form);
  assert.deepEqual(Object.keys(parts), ['hilt', 'edge']);
  let top = -Infinity;
  let bottom = Infinity;
  for (const geometry of Object.values(parts)) {
   assert.ok(geometry.attributes.position.count > 0);
   assert.ok(Array.from(geometry.attributes.position.array).every(Number.isFinite));
   assert.ok(Array.from(geometry.attributes.normal.array).every(Number.isFinite));
   geometry.computeBoundingBox();
   top = Math.max(top, geometry.boundingBox!.max.y);
   bottom = Math.min(bottom, geometry.boundingBox!.min.y);
   geometry.dispose();
  }
  assert.ok(Math.abs(top - bottom - height) < 1e-5);
  assert.ok(parts.hilt.boundingBox!.min.y < 0 && parts.hilt.boundingBox!.max.y > 0);
 });
}

const bytes=readFileSync(new URL('../../../public/art/lanternwood/weapons.glb',import.meta.url));
const load=()=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
test('all eleven authored melee parts parse inside original envelopes',async()=>{
 const {scene}=await load();const parts=extractWeaponGeometry(scene);
 assert.deepEqual(Object.keys(parts).sort(),Object.keys(WEAPON_BOUNDS).sort());
 for(const g of Object.values(parts)){assert(g.attributes.position.count>0);assert(Array.from(g.attributes.normal.array).every(Number.isFinite));g.dispose();}
});
test('incomplete and transformed out-of-envelope kits fail closed',async()=>{
 assert.throws(()=>extractWeaponGeometry(new Group()),/Incomplete/);
 const {scene}=await load();scene.position.x=10;assert.throws(()=>extractWeaponGeometry(scene),/envelope/);
});
test('duplicate names fail closed',async()=>{
 const {scene}=await load();scene.add(scene.getObjectByName('knife_handle')!.clone());assert.throws(()=>extractWeaponGeometry(scene),/Duplicate/);
});
test('all geometry wrappers retain primitive fallback and runtime material ownership',()=>{
 const source=readFileSync(new URL('./people-meshes.tsx',import.meta.url),'utf8');
 for(const part of Object.keys(WEAPON_BOUNDS))assert(source.includes(`<AuthoredWeaponGeometry part="${part}"><boxGeometry`));
 const wrapper=readFileSync(new URL('./authored-weapon.tsx',import.meta.url),'utf8');assert(wrapper.includes(': children'));assert(!wrapper.includes('Material'));
});
