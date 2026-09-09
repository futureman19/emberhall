import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Box3,Vector3} from 'three';
const bytes=fs.readFileSync('public/art/lanternwood/tools.glb');
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');scene.updateMatrixWorld(true);
const parts=[];scene.traverse(o=>{if(o.isMesh){const b=new Box3().setFromObject(o);parts.push({id:o.name,triangles:(o.geometry.index?.count??o.geometry.attributes.position.count)/3,min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(new Vector3()).toArray()})}});
fs.writeFileSync('public/art/lanternwood/tools-manifest.json',JSON.stringify({source:'art/blender/equipment.blend',script:'art/blender/build_equipment.py',pivot:'each part centered at original geometry anchor; original runtime mesh transforms retained',bytes:bytes.length,meshes:parts.length,triangles:parts.reduce((n,p)=>n+p.triangles,0),parts},null,2));
console.log(JSON.stringify({bytes:bytes.length,parts:parts.length,triangles:parts.reduce((n,p)=>n+p.triangles,0)}));
