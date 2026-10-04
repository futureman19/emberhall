import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial} from 'three';
import {equipmentMaterial} from './equipment-material.ts';
test('reused metal material restores every live property after repeated fading',()=>{
 const surface={color:'#9a9286',metalness:.55,roughness:.32};
 const mat=new MeshStandardMaterial(equipmentMaterial(false,surface));
 const before=mat.toJSON();
 for(let i=0;i<3;i++){
  mat.setValues(equipmentMaterial(true,surface));assert.equal(mat.opacity,.58);assert.equal(mat.transparent,true);assert.equal(mat.depthWrite,false);assert.equal(mat.color.getHexString(),'ece6d8');
  mat.setValues(equipmentMaterial(false,surface));assert.deepEqual(mat.toJSON(),before);
 }
 mat.dispose();
});
test('torch keeps dim ghost emission and restores normal flame defaults',()=>{
 const surface={color:'#a85a42',emissive:'#a85a42',emissiveIntensity:.8,ghostIntensity:.2};
 assert.equal(equipmentMaterial(true,surface).emissiveIntensity,.2);
 assert.deepEqual(equipmentMaterial(false,surface),{color:'#a85a42',metalness:0,roughness:1,emissive:'#a85a42',emissiveIntensity:.8,opacity:1,transparent:false,depthWrite:true});
});
