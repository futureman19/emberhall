import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Group} from 'three';
import {extractDeathGeometry, DEATH_BOUNDS} from './death-geometry.ts';
const bytes=readFileSync(new URL('../../../public/art/lanternwood/death.glb',import.meta.url));
const load=()=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
test('all three authored death parts parse inside original envelopes',async()=>{
 const {scene}=await load();const parts=extractDeathGeometry(scene);
 assert.deepEqual(Object.keys(parts).sort(),Object.keys(DEATH_BOUNDS).sort());
 for(const g of Object.values(parts)){assert(g.attributes.position.count>0);assert(Array.from(g.attributes.normal.array).every(Number.isFinite));g.dispose();}
});
test('incomplete and transformed out-of-envelope kits fail closed',async()=>{
 assert.throws(()=>extractDeathGeometry(new Group()),/Incomplete/);
 const {scene}=await load();scene.position.x=10;assert.throws(()=>extractDeathGeometry(scene),/envelope/);
});
test('duplicate names fail closed',async()=>{
 const {scene}=await load();scene.add(scene.getObjectByName('death_tunic')!.clone());assert.throws(()=>extractDeathGeometry(scene),/Duplicate/);
});
test('death keeps original proxy dimensions and non-pickable decoration',()=>{
 const s=readFileSync(new URL('./pile-meshes.tsx',import.meta.url),'utf8');
 for(const dims of ['0.4, 0.72, 0.26','0.28, 0.26, 0.24','0.48, 0.78, 0.1'])assert(s.includes(`args={[${dims}]}`));
 assert(s.includes('ringGeometry args={[0.28, 0.42, 12]}'));
 for(const name of ['tunic','head','shroud'])assert(s.includes(`name="authored-death-${name}"`));
 const body=s.slice(s.indexOf('function DeathBody'),s.indexOf('export function Piles'));
 assert.equal((body.match(/raycast={noArtRaycast}/g)||[]).length,3);
 assert.equal((body.match(/colorWrite={!parts} depthWrite={!parts}/g)||[]).length,3);
});
