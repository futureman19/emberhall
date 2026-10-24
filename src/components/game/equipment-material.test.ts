import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial} from 'three';
import {equipmentMaterial, exactWeaponSurfaces} from './equipment-material.ts';
import { RESOURCE_CATALOG } from '../../game/resources/catalog.ts';
import type { RareItem } from '../../game/types.ts';
for (const base of ['dagger', 'spear', 'war_axe'] as const) {
 test(`${base} uses its exact metal, timber, grade finish and permitted gem`, () => {
  const item = { base, formId: base, components: [
   { role: 'edge', resourceId: 'copper_ore', form: 'ingot', grade: 'pristine', amount: 2 },
   { role: 'hilt', resourceId: 'redwood', form: 'board', grade: 'sound', amount: 1 },
  ], inlays: [{ resourceId: 'ruby', clarity: 'cut' }] } as RareItem;
  const surfaces = exactWeaponSurfaces(base, item);
  assert.equal(surfaces.edge.color, RESOURCE_CATALOG.copper_ore.visual.primary);
  assert.equal(surfaces.hilt.color, RESOURCE_CATALOG.redwood.visual.primary);
  assert.equal(surfaces.gem?.color, RESOURCE_CATALOG.ruby.visual.primary);
  assert.ok(surfaces.edge.roughness! < exactWeaponSurfaces(base).edge.roughness!);
  assert.equal(exactWeaponSurfaces(base, { ...item, inlays: [{ resourceId: 'sapphire', clarity: 'perfect' }] }).gem, null);
  assert.equal(exactWeaponSurfaces(base, { ...item, base: 'sword' }).gem, null);
  for (const surface of [surfaces.edge, surfaces.hilt, surfaces.gem!]) {
   const ghost = equipmentMaterial(true, surface);
   assert.equal(ghost.depthWrite, false); assert.equal(ghost.opacity, .58);
   assert.equal(equipmentMaterial(false, surface).color, surface.color);
  }
 });
}
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
