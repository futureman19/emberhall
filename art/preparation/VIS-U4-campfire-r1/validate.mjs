import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const base=new URL('./',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base),'utf8'));
const bytes=fs.readFileSync(new URL('campfire.glb',base));
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
scene.updateMatrixWorld(true);
const source=fs.readFileSync(new URL('../../../src/components/game/campfire-meshes.tsx',base),'utf8');
const results=[];
for(const part of manifest.parts){
 const mesh=scene.getObjectByName(part.name);assert(mesh?.isMesh,part.name);
 const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);g.computeBoundingBox();
 for(const key of ['position','normal'])assert(Array.from(g.getAttribute(key).array).every(Number.isFinite),part.name+'/'+key);
 for(let i=0;i<3;i++)assert(g.boundingBox.min.getComponent(i)>=-part.bounds[i]/2-1e-5&&g.boundingBox.max.getComponent(i)<=part.bounds[i]/2+1e-5,part.name+' bounds '+i);
 if(part.name==='campfire_log')assert(source.includes('args={[0.05, 0.05, 0.5, 6]}'));else assert(source.includes('args={[0.09, 0]}'));
 results.push({name:part.name,min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray(),vertices:g.getAttribute('position').count});g.dispose();
}
assert.equal(results.length,new Set(results.map(x=>x.name)).size);
assert.equal(new Set(manifest.parts.map(p=>p.weapon)).size,manifest.weapons.length);
const report={passed:true,weapons:manifest.weapons.length,parts:results.length,scope:'Actual GLTFLoader vertices and original per-part envelopes; not runtime attachment/animation proof',results};
fs.writeFileSync(new URL('validation.json',base),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
