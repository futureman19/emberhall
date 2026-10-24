import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './world.ts';
import { emberdeepState, emberdeepBlocked } from './emberdeep.ts';
import { updateFurnace, tickWarden, wardenPhase, WARDEN_ID, WARDEN_STATS, dungeonSpawns } from './furnace-warden.ts';
import { ensureExpansionFauna } from './ecology.ts';
import { encodeSave, loadSave, SAVE_KEY } from './save.ts';
import { commandHunt, tickPlayer } from './player.ts';
import { takeFromPile } from './piles.ts';
import { isEmberdeepState } from './emberdeep.ts';
function fixture(){const w=createWorld(41);ensureExpansionFauna(w);const p=w.people.find(p=>p.isPlayer)!;p.hp=p.maxHp=500;w.player.invisUntil=0;return {w,p};}
function clear(w:ReturnType<typeof createWorld>){for(const a of dungeonSpawns(w)){const c=w.fauna.find(c=>c.id===a.id)!;assert.ok(c,a.id);c.task='dead';c.hp=0;}updateFurnace(w);}
test('all species must die before door unlocks; seal confines gate, not arena',()=>{const {w,p}=fixture();updateFurnace(w);assert.equal(emberdeepState(w).bossDoorOpen,false);for(const c of w.fauna)if(c.kind==='slag_golem'){c.hp=0;c.task='dead';}updateFurnace(w);assert.equal(emberdeepState(w).bossDoorOpen,false);clear(w);assert.equal(emberdeepState(w).bossDoorOpen,true);p.x=1100;p.z=674;updateFurnace(w);assert.equal(emberdeepState(w).bossDoorOpen,false);assert.equal(emberdeepBlocked(w,1100,674),false);assert.equal(emberdeepBlocked(w,1089,674),true);assert.equal(w.fauna.filter(c=>c.id===WARDEN_ID).length,1);});
test('half HP enrages; faster phase two slam is telegraphed and dodgeable',()=>{const {w,p}=fixture();clear(w);p.x=1106;p.z=677;updateFurnace(w);const c=w.fauna.find(c=>c.id===WARDEN_ID)!;assert.equal(wardenPhase(c),1);c.hp=c.maxHp/2;assert.equal(wardenPhase(c),2);assert.ok(WARDEN_STATS[2].speed>WARDEN_STATS[1].speed);tickWarden(w,c,.01);assert.equal(c.monster?.phase,'windup');assert.equal(p.hp,500);p.x+=10;for(let i=0;i<30;i++)tickWarden(w,c,.05);assert.equal(p.hp,500);});
test('player death releases seal; reentry creates fresh full-HP boss once',()=>{const {w,p}=fixture();clear(w);p.x=1100;p.z=674;updateFurnace(w);const c=w.fauna.find(c=>c.id===WARDEN_ID)!;c.hp=1;p.hp=0;updateFurnace(w);assert.equal(emberdeepState(w).bossDoorOpen,true);p.hp=500;updateFurnace(w);assert.equal(w.fauna.some(c=>c.id===WARDEN_ID),false);p.x=1073;updateFurnace(w);p.x=1100;updateFurnace(w);const fresh=w.fauna.find(c=>c.id===WARDEN_ID)!;assert.equal(fresh.hp,fresh.maxHp);updateFurnace(w);assert.equal(w.fauna.find(c=>c.id===WARDEN_ID),fresh);});
test('first victory persists and produces exactly one collectible heart',()=>{const {w,p}=fixture();clear(w);p.x=1100;p.z=674;updateFurnace(w);const c=w.fauna.find(c=>c.id===WARDEN_ID)!;c.hp=0;c.task='dead';updateFurnace(w);assert.equal(emberdeepState(w).bossDefeated,true);assert.equal(emberdeepState(w).bossDoorOpen,true);const hearts=()=>w.piles.reduce((n,p)=>n+(p.items.furnace_heart??0),0);assert.equal(hearts(),1);updateFurnace(w);assert.equal(hearts(),1);});
function roundTrip(w:ReturnType<typeof createWorld>) {
 const raw=encodeSave(w),old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>key===SAVE_KEY?raw:null}});
 try { const loaded=loadSave();assert.ok(loaded);return loaded; }
 finally {if(old)Object.defineProperty(globalThis,'localStorage',old);else Reflect.deleteProperty(globalThis,'localStorage');}
}
test('real combat, pending loot and collected reward survive save/load without duplication',()=>{
 const {w,p}=fixture();clear(w);p.x=1106;p.z=675;updateFurnace(w);
 w.player.wear.main='sword';w.player.skills.swords=100;w.player.skills.anatomy=100;
 const c=w.fauna.find(c=>c.id===WARDEN_ID)!;
 const active=roundTrip(w);updateFurnace(active);assert.equal(active.emberdeep?.bossEncounter,'fighting');assert.equal(emberdeepBlocked(active,1106,674),false);
 const random=Math.random;Math.random=()=>.4;
 try {commandHunt(w,c.id);for(let i=0;i<8000&&c.hp>0;i++)tickPlayer(w,.05);}finally{Math.random=random;}
 assert.equal(c.task,'dead');updateFurnace(w);
 const pending=roundTrip(w);updateFurnace(pending);
 const pile=pending.piles.find(p=>p.items.furnace_heart===1)!;assert.ok(pile);takeFromPile(pending,pile.id);
 assert.equal(pending.player.pack.furnace_heart,1);
 const loaded=roundTrip(pending);updateFurnace(loaded);assert.equal(loaded.player.pack.furnace_heart,1);
 assert.equal(loaded.piles.some(p=>p.items.furnace_heart),false);assert.equal(loaded.emberdeep?.bossDefeated,true);
});
test('boss spawning publishes a new fauna collection for subscribed renderers',()=>{
 const {w,p}=fixture();clear(w);const before=w.fauna;p.x=1100;p.z=674;updateFurnace(w);
 assert.notEqual(w.fauna,before);
 assert.equal(w.fauna.filter(c=>c.id===WARDEN_ID).length,1);
});
test('malformed boss persistence is rejected',()=>{
 const base={version:1,visited:[],cleared:[],bossDoorOpen:false};
 assert.equal(isEmberdeepState({...base,bossDefeated:'yes'}),false);
 assert.equal(isEmberdeepState({...base,bossEncounter:'oops'}),false);
});
