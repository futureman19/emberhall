import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PerspectiveCamera,Vector3} from 'three';
const url=process.argv[2];assert(url);
const root=new URL('../',import.meta.url),out=new URL('art/verification/hospitality/live/',root);fs.mkdirSync(out,{recursive:true});
const fixture=JSON.parse(fs.readFileSync(new URL('public/art/hospitality-review-save.json',root),'utf8'));
const local=JSON.parse(fs.readFileSync(new URL('art/verification/hospitality/optimized/results.json',root),'utf8'));
const result={url,method:'Live UI and simulation; pointer coordinates projected using deployed camera probe and locally verified original voxel centres. Cutaway screenshots require visual review; no live scene-graph claim.',checks:[],errors:[],screenshots:[]};
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
const pick=async(device,kind)=>{await clear();const source=local.projections.find(p=>p.name===device+'-'+kind);assert(source);const points=await project(source.points.map(p=>p.world));let ok=false;for(const p of points.slice(0,15)){await page.mouse.click(p.x,p.y);await page.waitForTimeout(350);if((await state()).openCraft){ok=true;break}}check(device+'-'+kind+'-actual-pointer',ok)};
for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
 await page.setViewportSize(viewport);
 for(const kind of ['kitchen','tavern','market']){
  const building=fixture.buildings.find(b=>b.kind===kind&&b.id.startsWith('qa-hospitality-'));assert(building);
  await walk(device+'-'+kind+'-court',[256,298]);
  const outside=local.checks.find(c=>c.name===device+'-'+kind+'-outside').target;
  await walk(device+'-'+kind+'-outside',outside);await snap(device+'-'+kind+'-outside');
  await walk(device+'-'+kind+'-entry',[building.tx,building.ty]);await snap(device+'-'+kind+'-inside');
  await walk(device+'-'+kind+'-exit',outside);await snap(device+'-'+kind+'-restored');
  if(kind!=='kitchen'){await clear();const source=local.projections.find(p=>p.name===device+'-'+kind);const pts=await project(source.points.map(p=>p.world));assert(pts.length);await page.mouse.click(pts[0].x,pts[0].y);await page.waitForTimeout(350);check(device+'-'+kind+'-no-spurious-crafting',!(await state()).openCraft);}
 }
 const approach=local.checks.find(c=>c.name===device+'-kitchen-cook-approach').target;await walk(device+'-cook-approach',approach);await pick(device,'kitchen');
 const row=page.locator('li').filter({has:page.getByText('Roast meat',{exact:true})}),make=row.getByRole('button',{name:'Make',exact:true});await make.scrollIntoViewIfNeeded();check(device+'-cooking-enabled',await make.isEnabled());let success=false;const attempts=[];
 for(let i=0;i<3&&!success;i++){const before=await state();await make.click();await ticks();const after=await state();attempts.push({before,after});success=after.pack.meat===before.pack.meat-1&&after.pack.cooked_meat===before.pack.cooked_meat+1;}
 check(device+'-real-cooking-success',success,{attempts,random:'Actual runtime RNG; at most three normal Make clicks, no injected roll'});await snap(device+'-kitchen-cooking');
}
await page.setViewportSize({width:1440,height:960});await walk('pointer-walk-start',[256,298]);const b=await state(),points=await project([[b.position[0]+1,0,b.position[1]+2]]);await page.mouse.click(points[0].x,points[0].y);const intent=await state();await ticks();const a=await state();check('actual-terrain-click-walk',intent.path.length>0&&Math.hypot(a.position[0]-b.position[0],a.position[1]-b.position[1])>.2,{before:b,intent,after:a});check('no-page-shader-errors',result.errors.length===0);result.passed=true;
}catch(e){result.failure=String(e);process.exitCode=1}finally{flush();await browser.close();console.log(JSON.stringify({passed:result.passed,failure:result.failure,checks:result.checks.map(c=>({name:c.name,ok:c.ok}))}))}
