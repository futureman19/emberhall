import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Box3,Vector3} from 'three';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.join(root,'public/art/landscape-kit');
const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));
const ids=['rocky-peak','snowcap-peak','mountain-ridge','cliff-straight','cliff-corner','boulder-cluster','active-volcano','dormant-caldera','basalt-columns','lava-pool','swamp-patch','reed-cluster','swamp-tree','moss-rocks'];
assert.deepEqual(manifest.assets.map(a=>a.id),ids);
const results=[];
for(const a of manifest.assets){
 const buf=fs.readFileSync(path.join(out,a.file));const gltf=await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),'');
 gltf.scene.updateMatrixWorld(true);const box=new Box3().setFromObject(gltf.scene),size=box.getSize(new Vector3());
 assert(size.x>0&&size.y>0&&size.z>0,a.id+' positive bounds');assert(Math.abs(box.min.y)<1e-5,a.id+' ground');
 assert(box.min.x<=0&&box.max.x>=0&&box.min.z<=0&&box.max.z>=0,a.id+' pivot inside footprint');
 let triangles=0,drawPrimitives=0,vertices=0;const colors=new Set();let emission=0;
 gltf.scene.traverse(o=>{if(!o.isMesh)return;assert(o.position.length()<1e-6,a.id+' no lineup translation');const g=o.geometry;const p=g.attributes.position;vertices+=p.count;for(const k of ['position','normal','color']){assert(g.attributes[k],a.id+' '+k);for(const v of g.attributes[k].array)assert(Number.isFinite(v),a.id+' finite '+k);}triangles+=(g.index?.count??p.count)/3;drawPrimitives+=g.groups.length||1;const c=g.attributes.color;for(let i=0;i<c.count;i++)colors.add([c.getX(i),c.getY(i),c.getZ(i)].map(x=>x.toFixed(3)).join(','));if(o.material.emissive?.getHex()>0){emission++;assert(o.material.emissive.r>o.material.emissive.g*3,a.id+' warm emission, not white fallback');}});
 assert(colors.size>5,a.id+' palette variation');assert(triangles>20&&Number.isInteger(triangles));
 if(['active-volcano','lava-pool'].includes(a.id))assert(emission>0,a.id+' real emission');
 const measured={bytes:buf.length,sha256:createHash('sha256').update(buf).digest('hex'),bounds:{min:box.min.toArray(),max:box.max.toArray()},footprint:{width:size.x,depth:size.z},height:size.y,triangles,vertices,drawPrimitives,paletteColors:colors.size};
 if(process.argv.includes('--measure'))Object.assign(a,measured);else for(const [key,value]of Object.entries(measured))assert.deepEqual(a[key],value,a.id+' manifest '+key);
 results.push({id:a.id,passed:true,...measured});
}
if(process.argv.includes('--measure'))fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const report={passed:true,assetCount:results.length,totalBytes:results.reduce((n,r)=>n+r.bytes,0),totalTriangles:results.reduce((n,r)=>n+r.triangles,0),totalDrawPrimitives:results.reduce((n,r)=>n+r.drawPrimitives,0),loader:'Installed Three.js GLTFLoader; all binary geometry parsed',scope:'Asset structural checks only, NOT gameplay/performance acceptance',assets:results};
fs.writeFileSync(path.join(root,'art/verification/landscape-kit/geometry-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
