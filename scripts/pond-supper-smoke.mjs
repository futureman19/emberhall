import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createWorld } from '../src/game/world.ts';
import { SAVE_KEY, writeSave } from '../src/game/save.ts';
const [url = 'http://127.0.0.1:8080', label = 'dev'] = process.argv.slice(2);
const out = `screenshots/pond-supper/${label}`;
fs.mkdirSync(out, { recursive: true });
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) };
const world = createWorld(7); world.hour = 12; world.speed = 0;
writeSave(world);
const raw = storage.get(SAVE_KEY);
const report = { url, scope: 'Seed-7 terrain, altered only by normal wood harvesting; handler-issued chop/walk/fish and fixed simulation substeps; native Pack/build/roast/eat clicks or mobile taps. Controlled success RNG for harvesting/catch/cook; hunger set to 40 for eat measurement. No native terrain picking claim.', checks: [], errors: [] };
const browser = await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist']});
try {
 for (const [device, viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]) {
  const context = await browser.newContext({viewport,hasTouch:device==='mobile'});
  await context.routeWebSocket(/.*/,()=>{});
  const page = await context.newPage();
  page.on('pageerror', e=>report.errors.push(e.message));
  page.on('console', m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(url+'/?qa=1');
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:SAVE_KEY,raw});
  await page.reload();
  await page.getByRole('button',{name:'Continue',exact:true}).click({timeout:60000});
  await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing',{}, {timeout:90000});
  const arrival = await page.evaluate(()=>{
   const s=window.__ember.useGame.getState(),w=window.__ember.getWorld();s.speed(0);s.setPanel('none');s.closeCtx();
   const gathered=[];
   s.speed(1);
   const originalRandom=Math.random;
   try {
    Math.random=()=>0;
    for(let attempt=0;attempt<4;attempt++) {
     if(Object.values(w.player.resources.stacks).reduce((a,b)=>a+b,0)>=3)break;
     const player=w.people.find(p=>p.isPlayer),trees=[];
     for(let z=280;z<315;z++)for(let x=235;x<275;x++)if(w.tiles[z][x].kind==='tree')trees.push({x,z,d:Math.hypot(player.x-x,player.z-z)});
     trees.sort((a,b)=>a.d-b.d);const tree=trees[0];
     s.doVerb('chop',{kind:'tile',tx:tree.x,ty:tree.z});for(let i=0;i<800;i++)s.tick(.05);
     gathered.push({tree,resources:{...w.player.resources.stacks}});
    }
   } finally {Math.random=originalRandom;}
   window.__gathered=gathered;
   const pond=[];for(let z=280;z<=315;z++)for(let x=235;x<=275;x++)if(w.tiles[z][x].kind==='water')pond.push({x,z});
   const bank=pond.reduce((a,b)=>b.z<a.z?b:a);window.__supperTarget=bank;
   s.speed(1);s.doVerb('walk',{kind:'tile',tx:bank.x,ty:bank.z-1});for(let i=0;i<600;i++)s.tick(.05);s.speed(0);
   const p=w.people.find(p=>p.isPlayer);return {x:p.x,z:p.z,bank,gathered};
  });
  assert(Math.hypot(arrival.x-arrival.bank.x,arrival.z-arrival.bank.z+1)<1);
  await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.equip('fishing_rod');const b=window.__supperTarget;s.doVerb('fish',{kind:'tile',tx:b.x,ty:b.z});s.speed(1);for(let i=0;i<80 && window.__ember.getWorld().people.find(p=>p.isPlayer).path.length;i++)s.tick(.05);s.speed(0);});
  for(const [stage,steps,text] of [['cast',0,'Casting'],['wait',16,'Waiting'],['bite',30,'reeling']]) {
   await page.evaluate(steps=>{const s=window.__ember.useGame.getState();s.speed(1);for(let i=0;i<steps;i++)s.tick(.05);s.speed(0);},steps);
   assert.match(await page.getByTestId('fishing-status').innerText(),new RegExp(text));
   await page.screenshot({path:`${out}/${device}-${stage}.png`});
  }
  await page.evaluate(()=>{const old=Math.random;try{Math.random=()=>0;const s=window.__ember.useGame.getState();s.speed(1);for(let i=0;i<20;i++)s.tick(.05);s.speed(0);}finally{Math.random=old;}});
  assert.equal(await page.getByTestId('fishing-status').count(),0);
  const packButton=page.getByRole('button',{name:'You — pack, paperdoll, skills',exact:true});
  if(device==='mobile')await packButton.tap();else await packButton.click();
  await page.getByTestId('pond-supper').waitFor();
  await page.waitForTimeout(700);
  await page.screenshot({path:`${out}/${device}-catch.png`});
  assert.equal(await page.evaluate(()=>window.__ember.useGame.getState().saveNow()),true);
  await page.reload();
  await page.getByRole('button',{name:'Continue',exact:true}).click({timeout:60000});
  await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing');
  const catchReload=await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(0);s.setPanel('none');const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer);return {raw:w.player.pack.raw_fish,x:p.x,z:p.z};});
  assert.equal(catchReload.raw,1);assert.equal(catchReload.x,arrival.x);assert.equal(catchReload.z,arrival.z);
  if(device==='mobile')await packButton.tap();else await packButton.click();
  await page.getByTestId('pond-supper').waitFor();
  await page.waitForTimeout(700);
  // Use the existing campfire recipe; starter resources remain unchanged.
  await page.evaluate(()=>{window.__savedRandom=Math.random;Math.random=()=>0;});
  const buildButton=page.getByRole('button',{name:'Build campfire · 3 wood',exact:true});
  if(device==='mobile')await buildButton.tap();else await buildButton.click();
  const fire=await page.evaluate(()=>{Math.random=window.__savedRandom;return {toast:window.__ember.useGame.getState().toast,fires:window.__ember.getWorld().campfires};});
  await page.evaluate(()=>{window.__savedRandom=Math.random;Math.random=()=>0;});
  report.checks.push({device,arrival,fire});
  assert(fire.fires.length>0, JSON.stringify(fire));
  if(device==='mobile')await page.getByRole('button',{name:'Roast fish',exact:true}).tap();else await page.getByRole('button',{name:'Roast fish',exact:true}).click();
  await page.evaluate(()=>{Math.random=window.__savedRandom;});
  await page.getByRole('button',{name:'Eat cooked fish',exact:true}).waitFor();
  await page.screenshot({path:`${out}/${device}-cooked.png`});
  const before=await page.evaluate(()=>{const w=window.__ember.getWorld();const p=w.people.find(p=>p.isPlayer);p.hunger=40;return {raw:w.player.pack.raw_fish,cooked:w.player.pack.cooked_fish,hunger:p.hunger};});
  if(device==='mobile')await page.getByRole('button',{name:'Eat cooked fish',exact:true}).tap();else await page.getByRole('button',{name:'Eat cooked fish',exact:true}).click();
  const after=await page.evaluate(()=>{const w=window.__ember.getWorld();return {raw:w.player.pack.raw_fish,cooked:w.player.pack.cooked_fish,hunger:w.people.find(p=>p.isPlayer).hunger};});
  assert.equal(after.cooked,before.cooked-1);assert.equal(after.hunger,78);
  await page.screenshot({path:`${out}/${device}-eaten.png`});
  await page.evaluate(()=>window.__ember.useGame.getState().saveNow());
  await page.reload();
  await page.getByRole('button',{name:'Continue',exact:true}).click({timeout:60000});
  await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing');
  const loaded=await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(0);const w=window.__ember.getWorld();return {raw:w.player.pack.raw_fish,cooked:w.player.pack.cooked_fish,hunger:w.people.find(p=>p.isPlayer).hunger};});
  assert.equal(loaded.raw,after.raw);assert.equal(loaded.cooked,after.cooked);assert(Math.abs(loaded.hunger-after.hunger)<0.1, "Reload may advance one simulation tick");
  report.checks.push({device,arrival,catchReload,fire,before,after,loaded});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
} catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;}finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
