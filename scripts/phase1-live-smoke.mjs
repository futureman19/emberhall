import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PerspectiveCamera,Vector3} from 'three';
const url=process.argv[2];assert(url);
const label=process.argv[3]??'live';assert.match(label,/^[a-zA-Z0-9_-]+$/);
const root=new URL('../',import.meta.url),out=new URL(`art/verification/phase1/${label}/`,root);fs.mkdirSync(out,{recursive:true});
const fixture=JSON.parse(fs.readFileSync(new URL('public/art/phase1-review-save.json',root),'utf8'));
const local=JSON.parse(fs.readFileSync(new URL('art/verification/phase1/candidate/results.json',root),'utf8'));
const result={url,method:'Live UI and simulation; per-building exterior positioning is explicit diagnostic setup, subsequent entry/exit is real useTile walking. Pointer coordinates projected using deployed camera probe and locally verified original voxel centres. Cutaway screenshots require visual review; no live scene-graph claim.',checks:[],errors:[],screenshots:[]};
const flush=()=>fs.writeFileSync(new URL('results.json',out),JSON.stringify(result,null,2));
const check=(name,ok,data={})=>{result.checks.push({name,ok,...data});flush();assert(ok,name)};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
try{
const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage();page.setDefaultTimeout(15000);
page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|GLSL|THREE/.test(m.text()))result.errors.push(m.text())});
await page.addInitScript(s=>localStorage.setItem('emberhall-save-v4',s),JSON.stringify(fixture));await page.goto(url+'/?qa=1',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__emberCamera&&window.__ember?.useGame.getState().phase==='playing');await page.waitForLoadState('networkidle');
const state=()=>page.evaluate(()=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);return {position:[p.x,p.z],path:p.path,selected:w.people.find(p=>p.id===s.selectedId)?.name,openCraft:s.openCraft,gold:w.gold,vault:w.player.vault,pack:structuredClone(w.player.pack),chest:structuredClone(w.player.chest),stacks:structuredClone(w.player.resources.stacks)}});
const clear=()=>page.evaluate(()=>{const s=window.__ember.useGame.getState();s.select(null);s.closeCraft();s.setPanel('none');s.speed(0);s.flash('')});
const ticks=async()=>{await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(1);for(let i=0;i<240;i++)s.tick(.05);s.speed(0)});await page.waitForTimeout(600)};
const walk=async(name,p)=>{await clear();await page.evaluate(p=>window.__ember.useGame.getState().useTile(...p),p);await ticks();const s=await state();check(name,Math.hypot(s.position[0]-p[0],s.position[1]-p[1])<.35,{state:s})};
const snap=async name=>{const c=await context.newCDPSession(page),shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(new URL(name+'.png',out),Buffer.from(shot.data,'base64'));await c.detach();result.screenshots.push(name+'.png');flush()};
const project=async points=>{const live=await page.evaluate(()=>({p:window.__emberCamera.getCamera(),t:window.__emberCamera.getTarget(),w:innerWidth,h:innerHeight}));const p0=local.projections[0].camera.projection;const cam=new PerspectiveCamera(2*Math.atan(1/p0[5])*180/Math.PI,live.w/live.h,.1,2000);cam.position.set(live.p.x,live.p.y,live.p.z);cam.lookAt(live.t.x,live.t.y,live.t.z);cam.updateMatrixWorld();return points.map(p=>{const v=new Vector3(...p).project(cam);return {x:(v.x+1)*live.w/2,y:(1-v.y)*live.h/2}}).filter(p=>p.x>12&&p.x<live.w-12&&p.y>65&&p.y<live.h-12)};
for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
 await page.setViewportSize(viewport);
 for(const kind of ['hall','dormitory','kitchen','yard','market','forge','tavern','notice','board','farm','bank']){
  const building=fixture.buildings.find(b=>b.kind===kind&&Math.hypot(b.tx-256,b.ty-292)<=18);assert(building);

  const outside=local.checks.find(c=>c.name===device+'-'+kind+'-outside').target;
  await clear();await page.evaluate(p=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),q=w.people.find(q=>q.isPlayer);q.x=p[0];q.z=p[1];q.path=[];w.hour=12;s.speed(0);s.tick(0)},outside);await page.waitForTimeout(650);await snap(device+'-'+kind+'-outside');
  if(!['notice','board'].includes(kind)){await walk(device+'-'+kind+'-entry',[building.tx,building.ty]);await snap(device+'-'+kind+'-inside');await walk(device+'-'+kind+'-exit',outside);await snap(device+'-'+kind+'-restored');}
  await clear();const source=local.projections.find(p=>p.name===device+'-'+kind);assert(source);const pts=await project(source.points.map(p=>p.world));assert(pts.length);
  const before=await state();let after;const station=['hall','yard','forge','kitchen'].includes(kind);
  for(const point of pts.slice(0,15)){await clear();await page.mouse.click(point.x,point.y);await page.waitForTimeout(350);after=await state();if(station?!!after.openCraft:kind==='bank'?/Pell/.test(after.selected??''):true)break;}
  check(device+'-'+kind+'-existing-station-contract',station?!!after.openCraft:kind==='bank'?/Pell/.test(after.selected??''):!after.openCraft);
  if(station||kind==='bank')await snap(device+'-'+kind+'-interaction');
  check(device+'-'+kind+'-pointer-preserves-player-resources',JSON.stringify(before.stacks)===JSON.stringify(after.stacks)&&JSON.stringify(before.pack)===JSON.stringify(after.pack));
 }
}
await page.setViewportSize({width:1440,height:960});await clear();await page.evaluate(()=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer);p.x=256;p.z=298;p.path=[];window.__ember.useGame.getState().tick(0)});await page.waitForTimeout(650);const b=await state(),points=await project([[b.position[0]+1,0,b.position[1]+2]]);await page.mouse.click(points[0].x,points[0].y);const intent=await state();await ticks();const a=await state();check('actual-terrain-click-walk',intent.path.length>0&&Math.hypot(a.position[0]-b.position[0],a.position[1]-b.position[1])>.2,{before:b,intent,after:a});check('no-page-shader-errors',result.errors.length===0);result.passed=true;
}catch(e){result.failure=String(e);process.exitCode=1}finally{flush();await browser.close();console.log(JSON.stringify({passed:result.passed,failure:result.failure,checks:result.checks.map(c=>({name:c.name,ok:c.ok}))}))}
