import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Group} from 'three';
import {extractCampfireGeometry, CAMPFIRE_BOUNDS} from './campfire-geometry.ts';
const bytes=readFileSync(new URL('../../../public/art/lanternwood/campfire.glb',import.meta.url));
const load=()=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
test('all two authored campfire parts parse inside original envelopes',async()=>{
 const {scene}=await load();const parts=extractCampfireGeometry(scene);
 assert.deepEqual(Object.keys(parts).sort(),Object.keys(CAMPFIRE_BOUNDS).sort());
 for(const g of Object.values(parts)){assert(g.attributes.position.count>0);assert(Array.from(g.attributes.normal.array).every(Number.isFinite));g.dispose();}
});
test('incomplete and transformed out-of-envelope kits fail closed',async()=>{
 assert.throws(()=>extractCampfireGeometry(new Group()),/Incomplete/);
 const {scene}=await load();scene.position.x=10;assert.throws(()=>extractCampfireGeometry(scene),/envelope/);
});
test('duplicate names fail closed',async()=>{
 const {scene}=await load();scene.add(scene.getObjectByName('campfire_stone')!.clone());assert.throws(()=>extractCampfireGeometry(scene),/Duplicate/);
});
