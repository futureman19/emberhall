import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createWorld } from '../src/game/world.ts';
import { SAVE_KEY, writeSave } from '../src/game/save.ts';
import { ensureGloomwraiths } from '../src/game/gloomwraith.ts';
const [url='http://127.0.0.1:8084',label='dev']=process.argv.slice(2);
const out=`screenshots/gloomwraith/${label}`;fs.mkdirSync(out,{recursive:true});
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
const w=createWorld(42);w.speed=0;ensureGloomwraiths(w);
const p=w.people.find(p=>p.isPlayer),c=w.fauna.find(c=>c.kind==='gloomwraith');
p.x=c.x+3;p.z=c.z;p.hp=100;w.player.wear={};w.player.invisUntil=0;
c.gloom={clock:3,phase:'windup',time:0,targetX:p.x,targetZ:p.z};writeSave(w);
const raw=storage.get(SAVE_KEY);const report={url,scope:'Paused seeded save in Silent Forge; native Continue desktop click / emulated mobile tap. Real simulation bolt, torch suppression and save reload; fixtures supply equipment and position.',errors:[],checks:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist']});
try { for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]) {
 const context=await browser.newContext({viewport,hasTouch:device==='mobile'});await context.routeWebSocket(/.*/,()=>{});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(url+'/?qa=1');await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:SAVE_KEY,raw});await page.reload();
 const resume=async()=>{const b=page.getByRole('button',{name:'Continue',exact:true});if(device==='mobile')await b.tap({timeout:60000});else await b.click({timeout:60000});await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing',{}, {timeout:90000});await page.evaluate(()=>window.__ember.useGame.getState().speed(0));};
 await resume();await page.waitForTimeout(1800);
 await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.setPanel('none');s.closeCtx();});await page.waitForTimeout(400);
 await page.screenshot({path:`${out}/${device}-wraith.png`});
 const damage=await page.evaluate(()=>{
  const {getWorld,useGame}=window.__ember;const w=getWorld(),p=w.people.find(p=>p.isPlayer),c=w.fauna.find(c=>c.kind==='gloomwraith');
  const damages=[];for(const torch of [false,true]) {p.x=c.x+3;p.z=c.z;p.hp=100;w.player.wear=torch?{main:'torch'}:{};w.player.blessUntil=0;w.player.ironwoodUntil=0;c.gloom={clock:3,phase:'windup',time:0,targetX:p.x,targetZ:p.z};useGame.getState().speed(1);for(let i=0;i<23;i++)useGame.getState().tick(.05);useGame.getState().speed(0);damages.push(100-p.hp);}
  return {damages,count:w.fauna.filter(c=>c.kind==='gloomwraith').length,state:c.gloom};
 });
 assert.deepEqual(damage.damages,[11,4]);assert.equal(damage.count,2);
 await page.screenshot({path:`${out}/${device}-torch.png`});
 assert.equal(await page.evaluate(()=>window.__ember.useGame.getState().saveNow()),true);
 await page.reload();await resume();
 const reloaded=await page.evaluate(()=>{const w=window.__ember.getWorld();return {count:w.fauna.filter(c=>c.kind==='gloomwraith').length,torch:w.player.wear.main};});
 assert.equal(reloaded.count,2);assert.equal(reloaded.torch,'torch');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 report.checks.push({device,damage,reloaded});await context.close();
 }assert.deepEqual(report.errors,[]);report.passed=true;
} catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;}
finally {fs.writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
