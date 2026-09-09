import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {extractToolGeometry, TOOL_BOUNDS} from '../src/components/game/tool-geometry.ts';

test('all eight real tool parts fit original geometry envelopes and budgets',async()=>{
 const bytes=fs.readFileSync('public/art/lanternwood/tools-silhouette.glb');assert(bytes.length<150000);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const parts=extractToolGeometry(gltf.scene);assert.equal(Object.keys(parts).length,8);
 for(const [key,size]of Object.entries(TOOL_BOUNDS)){
 const g=parts[key as keyof typeof TOOL_BOUNDS];assert(g,key);g.computeBoundingBox();const b=g.boundingBox!;
 for(let a=0;a<3;a++){assert(b.min.getComponent(a)>=-size[a]/2-1e-5,key+' min');assert(b.max.getComponent(a)<=size[a]/2+1e-5,key+' max')}
 assert((g.index?.count??g.attributes.position.count)/3<1500);assert.equal(g.userData.toolPart,key);
 for(const n of g.attributes.position.array)assert(Number.isFinite(n));
 }
});
test('partial or malformed optional tools are rejected instead of half-rendered',()=>{
 assert.throws(()=>extractToolGeometry({updateMatrixWorld(){},traverse(){}} as never));
});
