import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Group} from 'three';
import {extractWeaponGeometry, WEAPON_BOUNDS} from './weapon-geometry.ts';
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
