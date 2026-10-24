import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createWorld } from '../src/game/world.ts';
import { encodeSave, SAVE_KEY } from '../src/game/save.ts';
import { ensureEmberdeepMonsters } from '../src/game/emberdeep-monsters.ts';
const [url='http://127.0.0.1:8080',label='dev']=process.argv.slice(2);
const out=`screenshots/slag-golem/${label}`;fs.mkdirSync(out,{recursive:true});
const w=createWorld(41);ensureEmberdeepMonsters(w);w.speed=0;
const p=w.people.find(p=>p.isPlayer);p.x=1038;p.z=676;
w.player.wear.main='sword';w.player.skills.swords=50;w.player.skills.anatomy=40;
const raw=encodeSave(w);
const report={url,scope:'Seeded dungeon save; native Continue click/tap; fixture repositioning beside natural anchor spawns and sword skills 50/anatomy40. Actual store hunt/loot commands and fixed simulation ticks. Desktop and emulated-touch renders, not physical-device QA.',checks:[],errors:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist']});
try {
 for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]) {
  const ctx=await browser.newContext({viewport,hasTouch:device==='mobile'});await ctx.routeWebSocket(/.*/,()=>{});
  // Keep combat hit/loot rolls repeatable; terrain remains the explicit seed-41 save.
  await ctx.addInitScript(() => { Math.random = () => .4; });
  const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  const assets=new Set();page.on('response',r=>{if(/fauna-(slag_golem|embercrawler|gloomwraith)\.glb/.test(r.url())&&r.ok())assets.add(r.url().split('/').pop());});
  await page.goto(url+'/?qa=1');await page.evaluate(({raw,key})=>localStorage.setItem(key,raw),{raw,key:SAVE_KEY});await page.reload();
  const resume=async()=>{const b=page.getByRole('button',{name:'Continue',exact:true});if(device==='mobile')await b.tap();else await b.click();await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing',{}, {timeout:90000});await page.waitForTimeout(1200);await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(0);s.setPanel('none');s.closeCtx();});};
  await resume();
  const cases=[];
  for(const kind of ['slag_golem']) {
   const prepare=await page.evaluate(kind=>{
    const {getWorld,useGame}=window.__ember,w=getWorld(),s=useGame.getState(),p=w.people.find(p=>p.isPlayer),c=w.fauna.find(c=>c.kind===kind&&c.task!=='dead');
    if(!c)throw Error('missing '+kind);
    p.x=c.x;p.z=c.z+1.4;p.path=[];p.hp=p.maxHp=80;w.player.intent.kind='none';w.player.invisUntil=0;
    // Continue briefly runs simulation before the fixture pauses it. Reset the
    // encounter clock so loader speed cannot decide which telegraph phase we inspect.
    c.monster=undefined;c.task='idle';c.path=[];
    s.speed(1);s.tick(.05);s.speed(0);
    return {id:c.id,kind,phase:c.monster?.phase,hp:p.hp};
   },kind);
   assert.equal(prepare.phase,'windup');
   await page.waitForTimeout(1400);await page.screenshot({path:`${out}/${device}-${kind}.png`});
   const fight=await page.evaluate(id=>{
    const {getWorld,useGame}=window.__ember,w=getWorld(),s=useGame.getState(),p=w.people.find(p=>p.isPlayer),c=w.fauna.find(c=>c.id===id);
    s.speed(1);for(let i=0;i<24;i++)s.tick(.05);s.speed(0);const bitten=p.hp;
    s.doVerb('hunt',{kind:'fauna',id:c.id,tx:Math.round(c.x),ty:Math.round(c.z)});
    s.speed(1);let ticks=0;for(;ticks<500&&c.task!=='dead'&&!w.player.ghost;ticks++)s.tick(.05);s.speed(0);
    const pile=w.piles.find(p=>p.label===`${c.kind} corpse`);const loot=pile?{...pile.items}:null;
    const before={...w.player.pack};
    if(pile){s.doVerb('loot',{kind:'pile',id:pile.id,tx:pile.tx,ty:pile.ty});s.speed(1);for(let i=0;i<100;i++)s.tick(.05);s.speed(0);}
    return {bitten,dead:c.task==='dead',ghost:w.player.ghost,ticks,loot,before,after:{...w.player.pack}};
   },prepare.id);
   assert(fight.bitten<80&&fight.bitten>0,JSON.stringify(fight));assert(fight.dead&&!fight.ghost, JSON.stringify(fight));assert(fight.loot);
   for(const [item,n]of Object.entries(fight.loot))assert(fight.after[item]>=fight.before[item]+n);
   cases.push({prepare,fight});
  }
  assert.equal(assets.size,1);
  const snapshot=()=>page.evaluate(()=>window.__ember.getWorld().fauna.filter(c=>c.id.startsWith('emberdeep:')).map(c=>({id:c.id,hp:c.hp,task:c.task})));
  const before=await snapshot();assert(before.some(c=>c.task==='dead')&&before.some(c=>c.task!=='dead'));
  assert.equal(await page.evaluate(()=>window.__ember.useGame.getState().saveNow()),true);
  await page.reload();await resume();assert.deepEqual(await snapshot(),before);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  report.checks.push({device,cases,assets:[...assets],saveLoad:true});await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;}
finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
