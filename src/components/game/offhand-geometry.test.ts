import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Group} from 'three';
import {extractOffhandGeometry, OFFHAND_BOUNDS} from './offhand-geometry.ts';
const bytes=readFileSync(new URL('../../../public/art/lanternwood/offhands.glb',import.meta.url));
const load=()=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
test('all eight authored offhand parts parse inside original envelopes',async()=>{
 const {scene}=await load();const parts=extractOffhandGeometry(scene);
 assert.deepEqual(Object.keys(parts).sort(),Object.keys(OFFHAND_BOUNDS).sort());
 for(const g of Object.values(parts)){assert(g.attributes.position.count>0);assert(Array.from(g.attributes.normal.array).every(Number.isFinite));g.dispose();}
});
test('incomplete and transformed out-of-envelope kits fail closed',async()=>{
 assert.throws(()=>extractOffhandGeometry(new Group()),/Incomplete/);
 const {scene}=await load();scene.position.x=10;assert.throws(()=>extractOffhandGeometry(scene),/envelope/);
});
test('duplicate names fail closed',async()=>{
 const {scene}=await load();scene.add(scene.getObjectByName('torch_handle')!.clone());assert.throws(()=>extractOffhandGeometry(scene),/Duplicate/);
});
test('all geometry wrappers retain primitive fallback and runtime material ownership',()=>{
 const source=readFileSync(new URL('./people-meshes.tsx',import.meta.url),'utf8');
 assert.equal((source.match(/<AuthoredOffhandGeometry/g) ?? []).length,6);
 const wrapper=readFileSync(new URL('./authored-offhand.tsx',import.meta.url),'utf8');assert(wrapper.includes(': children'));assert(!wrapper.includes('Material'));
});

test('bow export centers compose at original mesh anchors',async()=>{
 const {scene}=await load();const parts=extractOffhandGeometry(scene);
 for(const [key,anchor] of [['bow_limb',0],['bow_string',.08]] as const){
  const raw=scene.getObjectByName(key)!;raw.updateWorldMatrix(true,false);
  const source=raw as import('three').Mesh;
  const expected=source.geometry.clone().applyMatrix4(source.matrixWorld).translate(.035,.28,0);
  const actual=parts[key].clone().translate(anchor,.28,0);
  const a=actual.attributes.position.array,b=expected.attributes.position.array;assert.equal(a.length,b.length);
  for(let i=0;i<a.length;i++)assert(Math.abs(a[i]-b[i])<1e-6);
  actual.dispose();expected.dispose();
 }
});
