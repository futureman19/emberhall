// Exact failed seed, canonical save/load, native input, unchanged hydrated terrain.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { PerspectiveCamera, Vector3 } from 'three';
import { createWorld } from '../src/game/world.ts';
import { setWorld } from '../src/game/live.ts';
import { writeSave, loadSave, SAVE_KEY } from '../src/game/save.ts';
import { groundY } from '../src/game/height.ts';
import { astar, lineWalkable } from '../src/game/pathfinding.ts';
const [url='http://127.0.0.1:8123',label='city-route-dev-v1']=process.argv.slice(2);
assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));assert.match(label,/^[a-z0-9-]+$/);
const out=path.resolve('art/verification/worldwide',label);assert(!fs.existsSync(path.join(out,'results.json')));fs.mkdirSync(out,{recursive:true});
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const report={url,seed:2469134,scope:'Fresh exact-seed world via canonical save/load. Body starts at plaza; other actors cleared after hydration for input isolation. Normal mouse/touch ground waypoints to road140328, then native mini-map Kingsford return (its existing48000 cap/place snap). No tile repaint. Ground return v1 hit an occluding tree; retained, not waived as a ground-click pass. Not natural AI, arbitrary terrain connectivity, full new-player onboarding or physical-phone acceptance.',checks:[],cases:[],errors:[]};
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
const check=(name,ok,data={})=>{report.checks.push({name,ok:!!ok,...data});flush();assert(ok,name);};
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
const random=Math.random;let fresh;try{Math.random=()=>report.seed/1e9;fresh=createWorld();}finally{Math.random=random;}
check('fresh-world-exact-seed',fresh.seed===report.seed);
setWorld(fresh);const body=fresh.people.find(p=>p.isPlayer);body.x=176;body.z=336;body.path=[];body.hunger=0;body.energy=100;fresh.hour=12;writeSave(fresh);
const raw=storage.get(SAVE_KEY);check('canonical-save-written',!!raw);fs.writeFileSync(path.join(out,'disposable-save.json'),raw);
const loaded=loadSave();check('canonical-load-valid',loaded?.seed===report.seed);setWorld(loaded);
function region(w){const tiles=[];for(let z=320;z<=344;z++)for(let x=132;x<=180;x++)tiles.push({x,z,...w.tiles[z][x]});return tiles;}
const expectedTiles=region(loaded),expectedHash=hash(expectedTiles);report.expectedTerrainHash=expectedHash;
check('loaded-road-identity',loaded.tiles[328][140].kind==='road');check('loaded-old-target-isolated',loaded.tiles[336][140].h===7&&astar(loaded,176,336,140,336,4000)===null);
check('loaded-real-road-reachable',!!astar(loaded,176,336,140,328,4000));
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});const watchdog=setTimeout(()=>browser.close(),240000);
async function state(page){return page.evaluate(()=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer),s=window.__ember.useGame.getState();return {x:p.x,z:p.z,path:structuredClone(p.path),intent:structuredClone(w.player.intent),ctx:s.ctx,toast:s.toast};});}
async function tick(page){await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(1);try{for(let i=0;i<4;i++)s.tick(.05);}finally{s.speed(0);}});await page.waitForTimeout(40);}
async function screen(page,x,z){const v=await page.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {c:window.__emberCamera.getCamera(),t:window.__emberCamera.getTarget(),r:{x:r.x,y:r.y,width:r.width,height:r.height}};});const c=new PerspectiveCamera(48,v.r.width/v.r.height,.2,480);c.position.set(v.c.x,v.c.y,v.c.z);c.lookAt(v.t.x,v.t.y,v.t.z);c.updateMatrixWorld(true);const p=new Vector3(x,groundY(loaded,x,z),z).project(c);return {x:v.r.x+(p.x+1)*v.r.width/2,y:v.r.y+(1-p.y)*v.r.height/2};}
try{
 for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,hasTouch:device==='mobile',deviceScaleFactor:1});await context.routeWebSocket(/.*/,()=>{});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push({device,type:'page',text:e.message}));page.on('console',m=>{if(m.type()==='error')report.errors.push({device,type:'console',text:m.text()});});
  await page.addInitScript(({raw,key})=>localStorage.setItem(key,raw),{raw,key:SAVE_KEY});await page.goto(url+'/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>{if(window.__ember?.useGame.getState().phase!=='playing'||!window.__emberCamera)return false;window.__ember.useGame.getState().speed(0);return true;});await page.waitForLoadState('networkidle');
  await page.evaluate(()=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);w.people=[p];w.fauna=[];p.x=176;p.z=336;p.path=[];p.hunger=0;p.energy=100;w.hour=12;w.player.intent.kind='none';s.select(null);s.setPanel('none');s.closeCtx();s.tick(.1);});
  async function stable(){return page.evaluate(()=>{const w=window.__ember.getWorld(),tiles=[];for(let z=320;z<=344;z++)for(let x=132;x<=180;x++)tiles.push({x,z,...w.tiles[z][x]});return {seed:w.seed,tiles,buildings:structuredClone(w.buildings)};});}
  const row={device,legs:[],before:await stable()};report.active=row;check(device+'-exact-hydrated-terrain',row.before.seed===report.seed&&hash(row.before.tiles)===expectedHash);await page.waitForTimeout(650);await page.screenshot({path:path.join(out,device+'-plaza.png')});
  const legs=[['out',170,336],['out',164,336],['out',158,336],['out',154,336],['out',148,334],['out',144,331],['out',140,328],['map-return',176,336]];
  for(const [direction,x,z] of legs){
   const from=await state(page),point=direction==='map-return'?await page.evaluate(({x,z})=>{const r=document.querySelector('[data-vale-map=mini]').getBoundingClientRect();return {x:r.left+r.width*x/512,y:r.top+r.height*z/512};},{x,z}):await screen(page,x,z),leg={direction,target:{x,z},from,point,track:[]};row.legs.push(leg);const prefix=device+'-'+direction+'-'+x+'-'+z;
   const hit=await page.evaluate(p=>{const e=document.elementFromPoint(p.x,p.y);return {tag:e?.tagName,map:e?.closest('[data-vale-map]')?.getAttribute('data-vale-map'),text:e?.textContent?.slice(0,100)};},point);check(prefix+'-visible-input-target',direction==='map-return'?hit.map==='mini':hit.tag==='CANVAS',{point,hit});
   if(device==='mobile')await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
   leg.command=await state(page);check(prefix+'-real-walk',leg.command.intent.kind==='walk'&&leg.command.intent.tx===x&&leg.command.intent.ty===z&&leg.command.path.length>0,{command:leg.command});
   const nodes=[{x:Math.round(from.x),y:Math.round(from.z)},...leg.command.path.map(p=>({x:p.tx,y:p.ty}))];check(prefix+'-legal-route',nodes.slice(1).every((b,i)=>lineWalkable(loaded,nodes[i].x,nodes[i].y,b.x,b.y)),{nodes});
   for(let i=0;i<240;i++){await tick(page);const p=await state(page);leg.track.push(p);if(i===1&&x===148&&direction==='out'){await page.screenshot({path:path.join(out,device+'-gate-moving.png')});check(device+'-moving-gate-sample',p.path.length>0&&Math.hypot(p.x-from.x,p.z-from.z)>.05);}if(Math.hypot(p.x-x,p.z-z)<.05&&p.path.length===0)break;}
   leg.arrived=await state(page);check(prefix+'-arrived',Math.hypot(leg.arrived.x-x,leg.arrived.z-z)<.05&&leg.arrived.path.length===0,{arrived:leg.arrived});
   if(x===140)await page.screenshot({path:path.join(out,device+'-real-road.png')});
  }
  row.after=await stable();check(device+'-terrain-buildings-preserved',hash(row.after.tiles)===expectedHash&&hash(row.after.buildings)===hash(row.before.buildings));await page.screenshot({path:path.join(out,device+'-returned.png')});report.cases.push(row);flush();await context.close();
 }
 check('exact-two-devices',report.cases.length===2&&new Set(report.cases.map(r=>r.device)).size===2);check('no-console-page-errors',report.errors.length===0,{errors:report.errors});report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;try{for(const c of browser.contexts())for(const p of c.pages())if(!p.isClosed())await p.screenshot({path:path.join(out,'failure.png')});}catch{ /* Preserve first failure. */ }}finally{clearTimeout(watchdog);flush();await browser.close();}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,cases:report.cases.length,failure:report.failure,out}));
