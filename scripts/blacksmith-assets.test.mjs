import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Box3, Vector3} from 'three';
const ids=['smith_anvil','smith_forge','smith_trough','smith_grindstone','smith_rack','smith_bellows'];
test('blacksmith exports have exact manifest membership, hashes, finite geometry and grounded bounded anchors',async()=>{
 const root='public/art/blacksmith/';
 const manifest=JSON.parse(fs.readFileSync(root+'manifest.json','utf8'));
 assert.deepEqual(Object.keys(manifest.assets).sort(),[...ids].sort());
 const hashes=[];
 for(const id of ids){
  const b=fs.readFileSync(root+id+'.glb'),m=manifest.assets[id];
  assert.equal(b.length,m.bytes);const hash=createHash('sha256').update(b).digest('hex');assert.equal(hash,m.sha256);hashes.push(hash);
  const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  gltf.scene.updateMatrixWorld(true);const bounds=new Box3().setFromObject(gltf.scene);
  assert.ok(Math.abs(bounds.min.y)<1e-5,id+' ground pivot');
  assert.ok(bounds.min.x>=-0.00001 && bounds.max.x<=1.00001,id+' footprint x');
  assert.ok(bounds.min.z>=-0.00001 && bounds.max.z<=1.00001,id+' footprint z');
  assert.ok(bounds.max.y>.3 && bounds.max.y<2,id+' height');
  bounds.min.toArray().concat(bounds.max.toArray()).forEach((v,i)=>assert.ok(Math.abs(v-m.bounds[i])<1e-5,id+' measured bounds'));
  let triangles=0;
  gltf.scene.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,ix=o.geometry.index;
   for(let i=0;i<p.count;i++)assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite));
   const n=ix?ix.count:p.count;for(let i=0;i<n;i+=3){const vs=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j).applyMatrix4(o.matrixWorld));assert.ok(vs[1].sub(vs[0]).cross(vs[2].sub(vs[0])).lengthSq()>1e-16,id+' nondegenerate');triangles++;}
  });assert.equal(triangles,m.triangles);assert.ok(triangles>50 && triangles<10000);
 }
 assert.equal(new Set(hashes).size,ids.length);
});
