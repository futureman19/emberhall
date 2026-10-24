import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createWorld } from '../src/game/world.ts';
import { encodeSave, SAVE_KEY } from '../src/game/save.ts';
import { dungeonSpawns, WARDEN_ID } from '../src/game/furnace-warden.ts';
import { EMBERDEEP_ROOMS } from '../src/game/emberdeep.ts';
const [url='http://127.0.0.1:8080',label='dev']=process.argv.slice(2);
const out=`screenshots/furnace-warden/${label}`;fs.mkdirSync(out,{recursive:true});
const w=createWorld(41);w.speed=0;
const p=w.people.find(p=>p.isPlayer);p.x=650;p.z=565;p.hp=p.maxHp=5000;
w.player.wear.main='sword';w.player.wear.off='torch';w.player.skills.swords=100;w.player.skills.anatomy=100;
w.weather.kind='clear';w.weather.wet=0;w.weather.untilHour=w.hour+100;
const raw=encodeSave(w),anchors=dungeonSpawns(w);
const report={url,scope:'Seed-41 save at entrance, funded sword/torch and skills100, HP5000, pinned RNG .4, paused between fixed real simulation ticks. Native desktop clicks/emulated phone taps for Continue and stairs; actual walk/hunt/loot store handlers for full dungeon traversal and combat, not native terrain picking or physical phone QA. No monster HP/death or clear flags fabricated.',checks:[],errors:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist']});
try{for(const [device,viewport]of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
 const ctx=await browser.newContext({viewport,hasTouch:device==='mobile'});await ctx.routeWebSocket(/.*/,()=>{});
 await ctx.addInitScript(()=>{Math.random=()=>.4;window.__audioEvents=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const src=this.src;return play.call(this).then(()=>window.__audioEvents.push(src));};});
 const page=await ctx.newPage();const assets=new Set();page.on('response',r=>{if(r.url().endsWith('/fauna-furnace_warden.glb')&&r.ok())assets.add(r.url());});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(url+'/?qa=1');await page.evaluate(({raw,key})=>localStorage.setItem(key,raw),{raw,key:SAVE_KEY});await page.reload();
 const press=async name=>{const b=page.getByRole('button',{name,exact:true});if(device==='mobile')await b.tap();else await b.click();};
 const resume=async()=>{await press('Continue');await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing',{}, {timeout:90000});await page.waitForTimeout(1000);await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(0);s.setPanel('none');s.closeCtx();});};
 const walk=async(tx,ty)=>{
  const r=await page.evaluate(({tx,ty})=>{const {getWorld,useGame}=window.__ember,w=getWorld(),s=useGame.getState(),p=w.people.find(p=>p.isPlayer);s.doVerb('walk',{kind:'tile',tx,ty});s.speed(1);for(let i=0;i<3000&&p.path.length;i++)s.tick(.05);s.speed(0);return {x:p.x,z:p.z,ghost:w.player.ghost};},{tx,ty});
  assert(Math.hypot(r.x-tx,r.z-ty)<.4,JSON.stringify({walk:[tx,ty],result:r}));return r;
 };
 const fight=async(id,stopAtHalf=false)=>page.evaluate(({id,stopAtHalf})=>{
  const {getWorld,useGame}=window.__ember,w=getWorld(),s=useGame.getState(),c=w.fauna.find(c=>c.id===id);
  if(!c)throw Error('missing '+id);s.doVerb('hunt',{kind:'fauna',id,tx:Math.round(c.x),ty:Math.round(c.z)});s.speed(1);let ticks=0;
  for(;ticks<5000&&c.hp>0&&!w.player.ghost;ticks++){s.tick(.05);if(stopAtHalf&&c.hp<=c.maxHp/2)break;}
  s.speed(0);return {id,hp:c.hp,maxHp:c.maxHp,task:c.task,ghost:w.player.ghost,ticks,door:w.emberdeep.bossDoorOpen};
 },{id,stopAtHalf});
 await resume();await press('Enter the Emberdeep');await page.waitForTimeout(800);
 const kills=[];
 for(const room of EMBERDEEP_ROOMS.filter(r=>r.id!=='furnace')){
  await walk(room.tx,room.ty);
  for(const a of anchors.filter(a=>a.roomId===room.id)){
   const result=await fight(a.id);assert.equal(result.task,'dead',JSON.stringify(result));assert.equal(result.ghost,false);kills.push(result);
  }
 }
 const open=await page.evaluate(()=>window.__ember.getWorld().emberdeep);assert.equal(open.bossDoorOpen,true);
 await walk(1100,674);
 const sealed=await page.evaluate(()=>window.__ember.getWorld().emberdeep);assert.equal(sealed.bossEncounter,'fighting');assert.equal(sealed.bossDoorOpen,false);
 await page.waitForTimeout(1000);assert.equal(assets.size,1,'Warden authored geometry must load');await page.screenshot({path:`${out}/${device}-warden.png`});
 const half=await fight(WARDEN_ID,true);assert(half.hp>0&&half.hp<=half.maxHp/2,JSON.stringify(half));
 // Cancel the hero's hunt and let the actual boss clock reach phase-two windup.
 const telegraph=await page.evaluate(id=>{const {getWorld,useGame}=window.__ember,w=getWorld(),s=useGame.getState(),p=w.people.find(p=>p.isPlayer),c=w.fauna.find(c=>c.id===id);w.player.intent={kind:'none',tx:0,ty:0,targetId:null,spell:null};p.path=[];s.speed(1);let ticks=0;for(;ticks<200;ticks++){s.tick(.05);if(c.monster?.phase==='windup'&&Math.hypot(c.monster.targetX-c.x,c.monster.targetZ-c.z)<.01)break;}s.speed(0);return {ticks,phase:c.monster?.phase,target:c.monster,hp:c.hp};},WARDEN_ID);
 assert.equal(telegraph.phase,'windup');assert(telegraph.ticks<200,JSON.stringify(telegraph));await page.waitForTimeout(500);await page.screenshot({path:`${out}/${device}-slam-ring.png`});
 const killed=await fight(WARDEN_ID);assert.equal(killed.task,'dead',JSON.stringify(killed));assert.equal(killed.ghost,false);
 // One final simulation boundary resolves the first-clear state and persistent pile.
 const loot=await page.evaluate(()=>{const {getWorld,useGame}=window.__ember,w=getWorld(),s=useGame.getState();s.speed(1);s.tick(.05);s.speed(0);const pile=w.piles.find(p=>p.items.furnace_heart===1);if(!pile)throw Error('heart pile missing');s.doVerb('loot',{kind:'pile',id:pile.id,tx:pile.tx,ty:pile.ty});s.speed(1);for(let i=0;i<500;i++)s.tick(.05);s.speed(0);return {heart:w.player.pack.furnace_heart,state:w.emberdeep};});
 assert.equal(loot.heart,1);assert.equal(loot.state.bossDefeated,true);assert.equal(loot.state.bossDoorOpen,true);
 await page.waitForTimeout(600);await page.screenshot({path:`${out}/${device}-victory.png`});
 assert.equal(await page.evaluate(()=>window.__ember.useGame.getState().saveNow()),true);await page.reload();await resume();
 const persisted=await page.evaluate(()=>{const w=window.__ember.getWorld();return {heart:w.player.pack.furnace_heart,state:w.emberdeep,piles:w.piles.filter(p=>p.items.furnace_heart).length};});
 assert.equal(persisted.heart,1);assert.equal(persisted.state.bossDefeated,true);assert.equal(persisted.piles,0);
 for(const room of [...EMBERDEEP_ROOMS.filter(r=>r.id!=='furnace')].reverse())await walk(room.tx,room.ty);
 await press('Leave the Emberdeep');await page.waitForTimeout(600);
 const exit=await page.evaluate(()=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer);return {x:p.x,z:p.z,heart:w.player.pack.furnace_heart};});assert.equal(exit.x,650);assert.equal(exit.z,565);assert.equal(exit.heart,1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 report.checks.push({device,kills,open,sealed,half,telegraph,killed,loot,persisted,exit});await ctx.close();
}assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;}
finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors,failure:report.failure},null,2));
