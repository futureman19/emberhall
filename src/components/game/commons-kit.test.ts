import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COURT} from '../../game/atlas.ts';
import {BUILD_SIZE} from '../../game/building-size.ts';
import {commonsKitName,keepCommonsExteriorOnEntry,retainCommonsInteriorVoxel} from './commons-kit.ts';

test('commons route existing dormitory, yard and farm worldwide',()=>{
 for(const k of ['dormitory','yard','farm']){
  assert.equal(commonsKitName(k,COURT.tx,COURT.ty),k);
  assert.equal(commonsKitName(k,COURT.tx+18,COURT.ty),k);
  assert.equal(commonsKitName(k,COURT.tx+19,COURT.ty),k);
  assert.equal(commonsKitName(k,NaN,COURT.ty),null);
 }
 for(const k of ['hall','bank','forge','tavern','kitchen','market','hut','unknown']) assert.equal(commonsKitName(k,COURT.tx,COURT.ty),null);
});
test('open farm/yard kits stay present on entry, rooms retain cutaways',()=>{
 for(const k of ['yard','farm'])assert.equal(keepCommonsExteriorOnEntry(k),true);
 for(const k of ['dormitory','bank','forge','kitchen','tavern','market','hall',null])assert.equal(keepCommonsExteriorOnEntry(k),false);
});
test('retain original dorm floor, yard target and all farm soil beds only',()=>{
 assert(retainCommonsInteriorVoxel('dormitory',{x:0,y:0,z:0,t:'plank'}));
 assert(!retainCommonsInteriorVoxel('dormitory',{x:6,y:1,z:0,t:'timber'}));
 assert(!retainCommonsInteriorVoxel('dormitory',{x:0,y:4,z:0,t:'thatch',cut:true}));
 assert(retainCommonsInteriorVoxel('yard',{x:0,y:2,z:0,t:'stone'}));
 assert(!retainCommonsInteriorVoxel('yard',{x:5,y:1,z:0,t:'timber'}));
 for(const [x,z] of [[-5,-5],[4,4],[0,4]])assert(retainCommonsInteriorVoxel('farm',{x,y:0,z,t:'soil'}));
 assert(!retainCommonsInteriorVoxel('farm',{x:0,y:1,z:-5,t:'timber'}));
 assert(!retainCommonsInteriorVoxel('bank',{x:0,y:0,z:0,t:'stone'}));
});
test('source-specific dorm door and open yard/farm entrances stay unchanged',()=>{
 const s=readFileSync(new URL('./building-meshes.tsx',import.meta.url),'utf8');
 const dorm=s.slice(s.indexOf('function makeDorm()'),s.indexOf('function makeKitchen()'));
 assert.match(dorm,/door:\s*\{\s*x:\s*-1,\s*w:\s*2,\s*h:\s*2\s*\}/);
 const yard=s.slice(s.indexOf('function makeYard()'),s.indexOf('function makeMarket()'));
 const farm=s.slice(s.indexOf('function makeFarm()'),s.indexOf('function makeBoard()'));
 for(const f of [yard,farm])assert.match(f,/const gate = z === 5 && x >= -1 && x <= 1/);
 assert.deepEqual(BUILD_SIZE.dormitory,{x0:-6,x1:6,z0:-3,z1:3});
 for(const k of ['yard','farm'] as const)assert.deepEqual(BUILD_SIZE[k],{x0:-5,x1:5,z0:-5,z1:5});
});
