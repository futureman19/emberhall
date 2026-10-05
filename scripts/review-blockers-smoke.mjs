import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const url=process.argv[2], label=process.argv[3];
assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));
const out=path.resolve('art/verification/review-fixes',label);fs.mkdirSync(out,{recursive:true});
const report={url,checks:[],errors:[],screenshots:[]};
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
const check=(name,ok,data={})=>{report.checks.push({name,ok:!!ok,...data});flush();assert(ok,name);};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist']});
const watchdog=setTimeout(()=>browser.close(),240000);
try {
 for(const fixture of ['clean','regrowth']) {
  const context=await browser.newContext({viewport:{width:1440,height:960}});
  await context.routeWebSocket(/.*/,()=>{});
  await context.route('**/*',route=>route.request().method()==='GET'?route.continue():route.abort());
  await context.addInitScript(raw=>localStorage.setItem('emberhall-save-v4',raw),fs.readFileSync(`art/verification/review-fixes/${fixture}-save.json`,'utf8'));
  const page=await context.newPage();page.setDefaultTimeout(60000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(url+'/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing');
  await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(0);s.setPanel('none');window.__ember.useGame.setState({introOpen:false});});
  const initial=await page.evaluate(()=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer);p.x=256;p.z=293;p.path=[];return {tile:w.tiles[268][423],map:w.tiles.length};});
  check(fixture+'-canonical-hydration',initial.map===1145&&(fixture!=='regrowth'||initial.tile.kind==='rock'),initial);
  const map=page.locator('[data-vale-map="mini"]');await map.waitFor({state:'visible'});
  const bounds=await map.boundingBox();assert(bounds);
  await page.mouse.click(bounds.x+bounds.width*660/1145,bounds.y+bounds.height*560/1145);
  const walk=await page.evaluate(()=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer),s=window.__ember.useGame.getState();const route=p.path.map(q=>({...q})),before={x:p.x,z:p.z};s.speed(1);for(let i=0;i<30;i++)s.tick(.05);s.speed(0);return {route,before,after:{x:p.x,z:p.z},toast:s.toast};});
  check(fixture+'-native-chart-midpoint',walk.route.length>0&&Math.hypot(walk.after.x-walk.before.x,walk.after.z-walk.before.z)>0.1,walk);
  const shot=async name=>{const target=path.join(out,name+'.png');await page.screenshot({path:target});report.screenshots.push(target);flush();};
  await shot(fixture+'-desktop-walk');
  if(fixture==='regrowth') {
   // Same naturally hydrated obstruction; relocate only the actor near it to
   // exercise the follower through the detour without a ten-minute journey.
   const detour=await page.evaluate(()=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer),s=window.__ember.useGame.getState();p.x=422;p.z=268;p.path=[];w.fauna=[];s.useTile(424,268);const route=p.path.map(q=>({...q}));s.speed(1);for(let i=0;i<120;i++)s.tick(.05);s.speed(0);return {route,x:p.x,z:p.z,tile:w.tiles[268][423]};});
   check('hydrated-rock-detour-arrival',Math.hypot(detour.x-424,detour.z-268)<.1&&detour.tile.kind==='rock',detour);
  }
  const construction=await page.evaluate(()=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);p.path=[];p.x=940;p.z=560;const gold=w.gold,n=w.buildings.length;window.__ember.useGame.setState({buildKind:'farm'});s.useTile(945,560);const refused={toast:window.__ember.useGame.getState().toast,gold:w.gold,n:w.buildings.length,kind:w.tiles[560][947].kind};s.useTile(940,555);return {gold,n,refused,after:w.buildings.length,farm:w.buildings.find(b=>b.kind==='farm')};});
  check(fixture+'-ordinary-construction-api',construction.refused.gold===construction.gold&&construction.refused.n===construction.n&&construction.refused.kind==='step'&&construction.after===construction.n+1,construction);
  // Screenshot-only relocation onto the canonical deck; route evidence above
  // is native input and fixed-step movement, not inferred from this still.
  await page.evaluate(()=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer),s=window.__ember.useGame.getState();p.x=952;p.z=560;p.path=[];window.__ember.useGame.setState({buildKind:null,toast:null});s.tick(0);});
  await page.waitForTimeout(600);await shot(fixture+'-desktop-bridge');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await shot(fixture+'-mobile-bridge');
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,canvas:document.querySelector('canvas')?.getBoundingClientRect().toJSON()}));
  check(fixture+'-mobile-no-horizontal-overflow',layout.scroll<=layout.width,layout);
  await context.close();
 }
 check('no-page-or-console-errors',report.errors.length===0,{errors:report.errors});
} finally {clearTimeout(watchdog);flush();await browser.close();}
console.log(JSON.stringify(report,null,2));
