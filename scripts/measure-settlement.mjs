// Independent runtime-loader measurement. Run after Blender regeneration.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const root=new URL('../',import.meta.url);
const manifestUrl=new URL('public/art/lanternwood/settlement-manifest.json',root);
const manifest=JSON.parse(readFileSync(manifestUrl,'utf8'));
assert.equal(readFileSync(new URL('art/blender/settlement-kit.blend',root)).toString('ascii',0,7),'BLENDER');
for(const name of ['bank','forge']) {
 const data=readFileSync(new URL(`public/art/lanternwood/${name}.glb`,root));
 assert.equal(data.toString('ascii',0,4),'glTF');
 assert.equal(data.readUInt32LE(8),data.length);
 const {scene}=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 scene.updateMatrixWorld(true);
 let triangles=0,vertices=0,meshes=0,emissive=false;
 const materials=new Set();
 scene.traverse(o=>{
  assert.ok(!o.isLight,'No dynamic lights');
  if(!o.isMesh)return;
  meshes++;
  const p=o.geometry.getAttribute('position');
  assert.ok(o.geometry.getAttribute('normal'));
  for(const v of p.array) assert.ok(Number.isFinite(v));
  vertices+=p.count; triangles+=(o.geometry.index?.count??p.count)/3;
  for(const m of Array.isArray(o.material)?o.material:[o.material]) {
   materials.add(m.name); if(m.emissive && (m.emissive.r+m.emissive.g+m.emissive.b)>0 && m.emissiveIntensity>0)emissive=true;
  }
 });
 const b=new THREE.Box3().setFromObject(scene);
 assert.ok(b.min.y>=-.03 && b.min.y<=.06 && b.max.y>2 && b.max.y<4.7);
 assert.ok(b.min.x>=-2 && b.max.x<=2.5 && b.min.z>=-2 && b.max.z<=2.5);
 assert.ok(triangles<=12000 && vertices<=30000 && meshes<=10 && materials.size<=10 && data.length<=600000);
 for(const word of ['chestnut','timber','stone'])assert.ok([...materials].some(n=>n.includes(word)));
 assert.ok(emissive);
 for(const x of name==='bank'?[-.35,0,.35]:[-.8,0,.8]) {
  const r=new THREE.Raycaster(new THREE.Vector3(x,1,name==='bank'?2:2.4),new THREE.Vector3(0,0,-1),0,1.2);
  assert.equal(r.intersectObject(scene,true).length,0,`${name} entrance ${x}`);
 }
 const ray=new THREE.Raycaster(new THREE.Vector3(.25,5,0),new THREE.Vector3(0,-1,0));
 assert.ok(ray.intersectObject(scene,true).some(h=>h.point.y>2),`${name} upward roof`);
 Object.assign(manifest[name],{bytes:data.length,triangles,vertices,materialSlots:materials.size,meshes,boundsYUp:[b.min.toArray(),b.max.toArray()],measurement:'THREE.GLTFLoader actual GLB; finite geometry, front rays, roof ray, palette and cost assertions passed'});
 console.log(JSON.stringify({name,...manifest[name],parts:manifest[name].parts.length}));
}
writeFileSync(manifestUrl,JSON.stringify(manifest,null,2)+'\n');
console.log('SETTLEMENT_MEASUREMENT_PASS');
