import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Box3} from 'three';
const assets={};
for(const name of ['anvil','forge','trough','grindstone','rack','bellows']){
 const id='smith_'+name,b=fs.readFileSync('public/art/blacksmith/'+id+'.glb');
 const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const box=new Box3().setFromObject(g.scene);let triangles=0;
 g.scene.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
 assets[id]={url:'/art/blacksmith/'+id+'.glb',bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),bounds:[...box.min.toArray(),...box.max.toArray()],triangles};
}
fs.writeFileSync('public/art/blacksmith/manifest.json',JSON.stringify({schemaVersion:1,source:'art/blender/build_blacksmith.py',anchor:'Y-up ground; X/Z within [0,1]; rotate about (.25,0,.25) matching voxel cells',assets},null,2)+'\n');
console.log(JSON.stringify(assets,null,2));
