// Bounded U2 flora render/input smoke. Disposable cleared plot; not full farming QA.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PerspectiveCamera,Vector3} from 'three';
import {SAVE_KEY} from '../src/game/save.ts';
const [url='http://127.0.0.1:8123',label='vis-u3-death-dev',mode='candidate']=process.argv.slice(2);
assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));assert.match(label,/^[a-z0-9-]+$/);
const out=path.resolve('art/verification/worldwide',label);fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(path.join(out,'results.json')));
const raw=fs.readFileSync('art/verification/worldwide/vis-u1-smoke-v1/disposable-save.json','utf8');
const result={mode,url,scope:'Shared stone and loot presentation in disposable cleared arena; native mine and pile-open input on mouse/touch. Not lifecycle/yield/save/natural habitat or performance acceptance.',cases:[],errors:[]};
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
try {
 for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]) {
  const context=await browser.newContext({viewport,hasTouch:device==='mobile',deviceScaleFactor:1});await context.routeWebSocket(/.*/,()=>{});
  if(mode==='fallback')await context.route('**/art/lanternwood/death.glb',r=>r.fulfill({status:503,body:'Deliberate local QA rejection'}));
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
  await page.addInitScript(({raw,key})=>localStorage.setItem(key,raw),{raw,key:SAVE_KEY});await page.goto(url+'/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.waitForFunction(()=>{if(!window.__emberCamera||window.__ember?.useGame.getState().phase!=='playing')return false;window.__ember.useGame.getState().speed(0);return true;});await page.waitForLoadState('networkidle');
  const before=await page.evaluate(()=>{
   const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);
   w.people=[p];w.fauna=[];w.buildings=[{id:'u2-fixture-house',kind:'hut',tx:64,ty:400,beds:[],ownerId:w.player.id}];w.piles=[];w.saplings=[];w.hour=12;p.x=255;p.z=304;p.story=0;p.path=[];p.hunger=0;p.energy=100;
   for(let z=282;z<=322;z++)for(let x=232;x<=278;x++){w.tiles[z][x].kind='dirt';w.tiles[z][x].h=4;}
   w.plots=[];w.herbs=[];
   for(const [tx,ty] of [[254,303],[256,301],[258,303]])w.tiles[ty][tx].kind='rock';
   w.piles=['drop','corpse','death'].map((source,i)=>({id:`u2-pile-${source}`,source,tx:254+i*2,ty:305,items:{log:2},gold:0,until:99,label:`QA ${source}`}));
   w.player.wear.main='pick';w.player.intent.kind='none';w.landRev++;s.select(null);s.closeCtx();s.setPanel('none');s.tick(.01);
   return {piles:structuredClone(w.piles),resourceNodes:structuredClone(w.resourceNodes)};
  });
  await page.waitForTimeout(1200);
  const row={device,before};
  if(mode!=='built') {
   row.rendered=await page.evaluate(async()=>{
    const text=await(await fetch('/src/components/game/world-scene.tsx')).text(),f=text.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/),fiber=await import(f[1]);const scene=fiber._roots.get(document.querySelector('canvas')).store.getState().scene;
    const names=[];scene.traverse(o=>{if(o.name.startsWith('authored-death-'))names.push(o.name);});return names.sort();
   });
   assert.equal(row.rendered.length,mode==='fallback'?0:3);
  }
  await page.screenshot({path:path.join(out,device+'-props.png')});
  // Use soil/frame, which retains the original plot handler and footprint.
  const view=await page.evaluate(()=>{const c=window.__emberCamera,r=document.querySelector('canvas').getBoundingClientRect();return {c:c.getCamera(),t:c.getTarget(),r:{x:r.x,y:r.y,width:r.width,height:r.height}};});
  const camera=new PerspectiveCamera(48,view.r.width/view.r.height,.2,480);camera.position.set(view.c.x,view.c.y,view.c.z);camera.lookAt(view.t.x,view.t.y,view.t.z);camera.updateMatrixWorld(true);
  const v=new Vector3(254,1.03,303).project(camera);const point={x:view.r.x+(v.x+1)*view.r.width/2,y:view.r.y+(1-v.y)*view.r.height/2};
  if(device==='mobile')await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
  row.input=await page.evaluate(()=>structuredClone(window.__ember.getWorld().player.intent));assert.equal(row.input.kind,'mine');assert.equal(row.input.tx,254);assert.equal(row.input.ty,303);
  const q=new Vector3(258,.81,305).project(camera);const lootPoint={x:view.r.x+(q.x+1)*view.r.width/2,y:view.r.y+(1-q.y)*view.r.height/2};
  if(device==='mobile')await page.touchscreen.tap(lootPoint.x,lootPoint.y);else await page.mouse.click(lootPoint.x,lootPoint.y);
  row.openPile=await page.evaluate(()=>window.__ember.useGame.getState().openPileId);assert.equal(row.openPile,'u2-pile-death');
  row.after=await page.evaluate(()=>{const w=window.__ember.getWorld();return {piles:structuredClone(w.piles),resourceNodes:structuredClone(w.resourceNodes)};});assert.deepEqual(row.after,before);
  await page.screenshot({path:path.join(out,device+'-pile-open.png')});
  result.cases.push(row);flush();await context.close();
 }
 const unexpected=result.errors.filter(e=>!(mode==='fallback'&&e.includes('503')));assert.deepEqual(unexpected,[]);
 result.passed=true;
} catch(e){result.passed=false;result.failure=e.stack;process.exitCode=1;}finally{flush();await browser.close();}
console.log(JSON.stringify({passed:result.passed,cases:result.cases.length,errors:result.errors,failure:result.failure,out}));
