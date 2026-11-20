import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld } from './world.ts';
import { spawn, tickEcology } from './ecology.ts';
import { commandHunt, tickPlayer } from './player.ts';
import { ensureEmberdeepMonsters, updateEmberdeepClears } from './emberdeep-monsters.ts';
import { encodeSave, loadSave, SAVE_KEY } from './save.ts';

test('real sword combat applies basalt armor and kills through the ordinary loot path', () => {
 const w=createWorld(41), p=w.people.find(p=>p.isPlayer)!;
 p.x=1038;p.z=674;p.hp=p.maxHp=100;
 w.player.wear.main='sword';w.player.skills.swords=50;w.player.skills.anatomy=40;
 const random=Math.random;Math.random=()=>.4;
 try {
  const damage:number[]=[];
  for(const kind of ['wolf','slag_golem'] as const){
   const c=spawn(w,kind,p.x,p.z+1);w.fauna=[c];
   commandHunt(w,c.id);
   let i=0;while(c.hp===c.maxHp&&i++<40)tickPlayer(w,.05);
   damage.push(c.maxHp-c.hp);
   while(c.hp>0&&i++<400)tickPlayer(w,.05);
   assert.equal(c.task,'dead');
   if (kind === 'slag_golem') assert.ok(w.piles.some(p=>p.label===`${kind} corpse`));
  }
  assert.equal(damage[1],Math.max(1,damage[0]!-4));
 }finally{Math.random=random;}
});
test('dead anchors and live telegraph state survive tile-free saves without duplicate spawns',()=>{
 const w=createWorld(41);ensureEmberdeepMonsters(w);
 const monsters=w.fauna.filter(c=>c.kind==='slag_golem');
 monsters[0]!.hp=0;monsters[0]!.task='dead';monsters[0]!.corpseUntil=w.hour+8;
 monsters[1]!.monster={phase:'recover',time:.4,targetX:1038,targetZ:674};
 updateEmberdeepClears(w);
 const raw=encodeSave(w),old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>k===SAVE_KEY?raw:null}});
 try{
  const loaded=loadSave()!;assert.ok(loaded);ensureEmberdeepMonsters(loaded);
  assert.deepEqual(loaded.fauna.filter(c=>c.kind==='slag_golem'),monsters);
  loaded.hour+=10;tickEcology(loaded,.01);
  assert.ok(loaded.fauna.some(c=>c.id===monsters[0]!.id&&c.task==='dead'));
 }finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else Reflect.deleteProperty(globalThis,'localStorage');}
});
