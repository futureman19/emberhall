import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createWorld } from '../src/game/world.ts';
import { encodeSave, SAVE_KEY } from '../src/game/save.ts';
const [url='http://127.0.0.1:8082',label='dev']=process.argv.slice(2);
const out=`screenshots/embercrawler/${label}`;fs.mkdirSync(out,{recursive:true});
const w=createWorld(41);w.speed=0;const p=w.people.find(p=>p.isPlayer);p.x=1024;p.z=674;
w.player.wear.main='sword';w.player.skills.swords=70;w.player.skills.anatomy=50;
const raw=encodeSave(w),report={url,scope:'Seeded paused dungeon save; native Continue click/tap, fixture repositioning next to natural crawler. Actual fixed simulation ticks and store hunt/loot commands; emulated touch, not phone hardware.',checks:[],errors:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist']});
try {
 for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]) {
  const ctx=await browser.newContext({viewport,hasTouch:device==='mobile'});await ctx.routeWebSocket(/.*/,()=>{});
  const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  let asset=false;page.on('response',r=>{if(r.url().endsWith('fauna-embercrawler.glb')&&r.ok())asset=true;});
  await page.goto(url+'/?qa=1');await page.evaluate(({raw,key})=>localStorage.setItem(key,raw),{raw,key:SAVE_KEY});await page.reload();
  const resume=async()=>{const b=page.getByRole('button',{name:'Continue',exact:true});if(device==='mobile')await b.tap();else await b.click();await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing',{}, {timeout:90000});await page.waitForTimeout(1200);await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(0);s.setPanel('none');s.closeCtx();});};
  await resume();
  const prepare=await page.evaluate(()=>{
    const {getWorld,useGame}=window.__ember,w=getWorld(),s=useGame.getState(),p=w.people.find(p=>p.isPlayer),c=w.fauna.find(c=>c.kind==='embercrawler'&&c.home.tx===1023);
    if(!c)throw Error('missing corridor crawler');
    c.x=c.home.tx;c.z=c.home.ty;c.task='wander';c.path=[];delete c.crawler;
    p.x=c.x+1.4;p.z=c.z;p.path=[];p.hp=p.maxHp=100;w.player.intent.kind='none';w.player.invisUntil=0;
    s.speed(1);s.tick(.05);s.speed(0);return {id:c.id,phase:c.crawler?.phase,x:c.x,z:c.z};
  });assert.equal(prepare.phase,'windup');
  await page.waitForTimeout(1500);assert(asset);await page.screenshot({path:`${out}/${device}-windup.png`});
  const attack=await page.evaluate(id=>{
    const {getWorld,useGame}=window.__ember,w=getWorld(),s=useGame.getState(),p=w.people.find(p=>p.isPlayer),c=w.fauna.find(c=>c.id===id);
    const phases=[];s.speed(1);for(let i=0;i<18;i++){s.tick(.05);phases.push({phase:c.crawler?.phase,x:c.x,z:c.z,hp:p.hp});}s.speed(0);return phases;
  },prepare.id);
  assert(attack.some(x=>x.phase==='lunge'));assert(attack.some(x=>x.phase==='retreat'));assert(attack.at(-1).hp<100);
  assert(attack.some(x=>Math.hypot(x.x-prepare.x,x.z-prepare.z)>.1));
  await page.screenshot({path:`${out}/${device}-retreat.png`});
  await page.evaluate(()=>window.__ember.useGame.getState().speed(1));
  await page.waitForTimeout(250);await page.screenshot({path:`${out}/${device}-moving.png`});
  await page.evaluate(()=>window.__ember.useGame.getState().speed(0));
  const fight=await page.evaluate(id=>{
    const {getWorld,useGame}=window.__ember,w=getWorld(),s=useGame.getState(),p=w.people.find(p=>p.isPlayer),c=w.fauna.find(c=>c.id===id);
    s.doVerb('hunt',{kind:'fauna',id:c.id,tx:Math.round(c.x),ty:Math.round(c.z)});s.speed(1);
    let ticks=0;for(;ticks<600&&c.task!=='dead'&&!w.player.ghost;ticks++)s.tick(.05);s.speed(0);
    const pile=w.piles.find(p=>p.label===`${c.kind} corpse`),before=w.player.pack.ash;
    if(pile){s.doVerb('loot',{kind:'pile',id:pile.id,tx:pile.tx,ty:pile.ty});s.speed(1);for(let i=0;i<100;i++)s.tick(.05);s.speed(0);}
    return {dead:c.task==='dead',ghost:w.player.ghost,ticks,before,after:w.player.pack.ash,hp:p.hp};
  },prepare.id);assert(fight.dead&&!fight.ghost,JSON.stringify(fight));assert(fight.after>fight.before);
  const snapshot=()=>page.evaluate(()=>window.__ember.getWorld().fauna.filter(c=>c.kind==='embercrawler').map(c=>({id:c.id,hp:c.hp,task:c.task,crawler:c.crawler})));
  const before=await snapshot();assert.equal(await page.evaluate(()=>window.__ember.useGame.getState().saveNow()),true);
  await page.reload();await resume();assert.deepEqual(await snapshot(),before);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  report.checks.push({device,prepare,attack,fight,asset,saveLoad:true});fs.writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;}
finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
