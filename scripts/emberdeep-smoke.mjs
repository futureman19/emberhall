import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createWorld } from '../src/game/world.ts';
import { SAVE_KEY, writeSave } from '../src/game/save.ts';
import { EMBERDEEP_ENTRY, EMBERDEEP_EXIT, EMBERDEEP_ROOMS, clearEmberdeepRoom } from '../src/game/emberdeep.ts';
const [url = 'http://127.0.0.1:8082', label = 'dev'] = process.argv.slice(2);
const out = `screenshots/emberdeep/${label}`;
fs.mkdirSync(out, { recursive: true });
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) };
const world = createWorld(7); world.hour = 12; world.speed = 0;
const player = world.people.find(p => p.isPlayer);
player.x = EMBERDEEP_ENTRY.tx; player.z = EMBERDEEP_ENTRY.ty;
clearEmberdeepRoom(world, 'entrance');
writeSave(world);
const raw = storage.get(SAVE_KEY);
const report = { url, scope: 'Seed-7 paused save positioned at overworld entrance with entrance clear fixture. Native desktop clicks/emulated mobile taps for entry/exit; store-command walks and fixed simulation substeps for every accessible room. Sealed boss rejection; native save/reload. No physical-device or overworld expedition claim.', checks: [], errors: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist'] });
try {
 for (const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]) {
  const context = await browser.newContext({viewport,hasTouch:device==='mobile'});
  await context.routeWebSocket(/.*/,()=>{});
  const page = await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(url+'/?qa=1');
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:SAVE_KEY,raw});
  await page.reload();
  const resume=async()=>{
   await page.getByRole('button',{name:'Continue',exact:true}).click({timeout:60000});
   await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing',{}, {timeout:90000});
   await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(0);s.setPanel('none');s.closeCtx();});
  };
  const press=async name=>{const b=page.getByRole('button',{name,exact:true});if(device==='mobile')await b.tap();else await b.click();};
  const read=()=>page.evaluate(()=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer);return {x:p.x,z:p.z,path:p.path,state:w.emberdeep,region:window.__ember.useGame.getState().snap.region};});
  const walk=async(tx,ty)=>page.evaluate(({tx,ty})=>{
   const s=window.__ember.useGame.getState(),w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer);
   s.doVerb('walk',{kind:'tile',tx,ty});s.speed(1);
   for(let i=0;i<2400 && p.path.length;i++)s.tick(.05);
   s.speed(0);return {x:p.x,z:p.z,path:p.path.length,visited:w.emberdeep?.visited};
  },{tx,ty});
  await resume();
  await page.waitForTimeout(1500);
  await page.screenshot({path:`${out}/${device}-entrance.png`});
  await press('Enter the Emberdeep');
  await page.waitForFunction(()=>window.__ember.useGame.getState().snap.region.includes('Emberdeep'));
  let position=await read();assert.equal(position.x,EMBERDEEP_EXIT.tx);assert.equal(position.z,EMBERDEEP_EXIT.ty);
  await page.waitForTimeout(1000);
  await page.screenshot({path:`${out}/${device}-hall.png`});
  const rooms=[];
  for(const room of EMBERDEEP_ROOMS.filter(r=>r.id!=='furnace')) {
   position=await walk(room.tx,room.ty);
   assert(Math.hypot(position.x-room.tx,position.z-room.ty)<.3,JSON.stringify({room,position}));
   assert(position.visited.includes(room.id));rooms.push({room:room.id,...position});
  }
  await walk(1087,674);
  const before=await read();
  const blocked=await walk(1106,674);
  assert.equal(blocked.x,before.x);assert.equal(blocked.z,before.z);
  await page.waitForTimeout(800);
  await page.screenshot({path:`${out}/${device}-seal.png`});
  assert.equal(await page.evaluate(()=>window.__ember.useGame.getState().saveNow()),true);
  const saved=await read();
  await page.reload();await resume();
  const loaded=await read();
  assert.deepEqual(loaded.state,saved.state);assert.equal(loaded.x,saved.x);assert.equal(loaded.z,saved.z);
  assert.deepEqual(loaded.state.cleared,['entrance']);assert.equal(loaded.state.bossDoorOpen,false);
  // Follow the authored loop back instead of relying on a long A* budget.
  for(const room of [...EMBERDEEP_ROOMS.filter(r=>r.id!=='furnace')].reverse()) {
   const result=await walk(room.tx,room.ty);assert(Math.hypot(result.x-room.tx,result.z-room.ty)<.3);
  }
  await press('Leave the Emberdeep');
  await page.waitForFunction(()=>!window.__ember.useGame.getState().snap.region.includes('Emberdeep'));
  const exited=await read();assert.equal(exited.x,EMBERDEEP_ENTRY.tx);assert.equal(exited.z,EMBERDEEP_ENTRY.ty);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  report.checks.push({device,rooms,blocked,saved,loaded,exited});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
} catch(e) {report.passed=false;report.failure=e.stack;process.exitCode=1;}
finally {fs.writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
