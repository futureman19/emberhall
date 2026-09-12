import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {COURT} from '../../game/atlas.ts';
import {BUILD_SIZE} from '../../game/building-size.ts';
import {hospitalityKitName,retainHospitalityInteriorVoxel} from './hospitality-kit.ts';

test('hospitality art routes only three existing built kinds worldwide',()=>{
 for(const kind of ['kitchen','tavern','market']){
  assert.equal(hospitalityKitName(kind,COURT.tx,COURT.ty),kind);
  assert.equal(hospitalityKitName(kind,COURT.tx+18,COURT.ty),kind);
  assert.equal(hospitalityKitName(kind,COURT.tx+19,COURT.ty),kind);
  assert.equal(hospitalityKitName(kind,176,320),kind);
 }
 for(const kind of ['bank','forge','hall','shop','hut','dormitory'])assert.equal(hospitalityKitName(kind,COURT.tx,COURT.ty),null);
});
test('hospitality retains original interior content, not duplicate market pillars or roofs',()=>{
 for(const kind of ['kitchen','tavern','market']){
  assert(retainHospitalityInteriorVoxel(kind,{x:0,y:0,z:0}));
  assert(!retainHospitalityInteriorVoxel(kind,{x:0,y:4,z:0,cut:true}));
  assert(!retainHospitalityInteriorVoxel(kind,{x:BUILD_SIZE[kind as keyof typeof BUILD_SIZE].x0,y:1,z:0}));
 }
 assert(retainHospitalityInteriorVoxel('market',{x:2,y:1,z:1}));
 assert(!retainHospitalityInteriorVoxel('market',{x:3,y:1,z:2}));
 assert(!retainHospitalityInteriorVoxel('bank',{x:0,y:0,z:0}));
});
test('hospitality original footprint and entry contracts stay fixed',()=>{
 assert.deepEqual(BUILD_SIZE.kitchen,{x0:-3,x1:3,z0:-3,z1:3});
 for(const k of ['tavern','market'] as const)assert.deepEqual(BUILD_SIZE[k],{x0:-4,x1:4,z0:-3,z1:3});
 const s=readFileSync(new URL('./building-meshes.tsx',import.meta.url),'utf8');
 assert.match(s,/function makeKitchen\(\)[\s\S]*?door: \{ x: 0, w: 2, h: 2 \}/);
 assert.match(s,/function makeTavern\(\)[\s\S]*?door: \{ x: -1, w: 2, h: 3 \}/);
});
