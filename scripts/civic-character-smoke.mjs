// Local same-fixture civic visual baseline/candidate, not a physical-phone benchmark.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const [url='http://127.0.0.1:8093', label='baseline']=process.argv.slice(2);
assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));
assert.match(label,/^[a-z0-9-]+$/i);
const out=path.resolve('art/verification/civic',label);fs.mkdirSync(out,{recursive:true});
assert(!fs.existsSync(path.join(out,'results.json')),'Keep previous evidence');
const result={url,label,checks:[],samples:[],errors:[],screenshots:[]};
const save=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
const check=(name,ok,data={})=>{result.checks.push({name,ok:!!ok,...data});save();assert(ok,name)};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
const watchdog=setTimeout(()=>browser.close(),150000);
try {
 const context=await browser.newContext();await context.routeWebSocket(/.*/,()=>{});
 const page=await context.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>result.errors.push(e.message));
 const fixture=fs.readFileSync('public/art/phase1-review-save.json','utf8');
 await page.addInitScript(s=>localStorage.setItem('emberhall-save-v4',s),fixture);
 await page.goto(url+'/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing');
 await page.waitForLoadState('networkidle');
 await page.evaluate(async()=>{const src=await(await fetch('/src/components/game/world-scene.tsx')).text();const match=src.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);const f=await import(match[1]);window.__civic=f._roots.get(document.querySelector('canvas')).store.getState();window.__ember.useGame.getState().speed(0)});
 for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]) {
  await page.setViewportSize(viewport);
  for(const role of ['banker','provisioner','healer']) {
   const original=await page.evaluate(role=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer),n=w.people.find(p=>p.role===role&&p.home&&Math.hypot(p.home.tx-256,p.home.ty-292)<18);p.x=n.x;p.z=n.z+2;p.path=[];w.hour=12;s.speed(0);s.select(null);s.tick(0);return JSON.parse(JSON.stringify(n))},role);
   await page.waitForTimeout(900);
   const inspect=await page.evaluate(id=>{const w=window.__ember.getWorld(),n=w.people.find(p=>p.id===id),state=window.__civic;const groups=[];state.scene.traverse(o=>{if(o.name==='emberhall-npc-figure'&&Math.hypot(o.position.x-n.x,o.position.z-n.z)<.01)groups.push(o)});if(groups.length!==1)return {found:false,count:groups.length};const g=groups[0],meshes=[];g.traverse(o=>{if(o.isMesh)meshes.push({type:o.geometry.type,vertices:o.geometry.attributes.position.count,color:o.material.color?.getHexString()})});const pos=g.position.clone();pos.y+=.8;pos.project(state.camera);return {found:true,yaw:g.rotation.y,facing:n.facing,meshes,point:{x:(pos.x+1)*innerWidth/2,y:(1-pos.y)*innerHeight/2},unchanged:JSON.stringify(n)}},original.id);
   check(device+'-'+role+'-rendered',inspect.found,inspect);
   check(device+'-'+role+'-record-preserved',inspect.unchanged===JSON.stringify(original));
   await page.screenshot({path:path.join(out,device+'-'+role+'.png')});result.screenshots.push(device+'-'+role+'.png');
   const sample=await page.evaluate(()=>new Promise(resolve=>{const times=[];let last;function step(t){if(last!==undefined)times.push(t-last);last=t;if(times.length<180)return requestAnimationFrame(step);const sorted=[...times].sort((a,b)=>a-b),gl=window.__civic.gl;resolve({frames:times.length,median:sorted[90],p95:sorted[171],times,drawCalls:gl.info.render.calls,triangles:gl.info.render.triangles,geometries:gl.info.memory.geometries})}requestAnimationFrame(step)}));
   result.samples.push({device,role,...sample});save();
   if(label.startsWith('candidate')) {
    check(device+'-'+role+'-authored-body',inspect.meshes.some(m=>m.type!=='BoxGeometry'&&m.vertices>24));
    check(device+'-'+role+'-front-yaw',Math.abs(Math.sin(inspect.yaw-inspect.facing-Math.PI))<1e-6&&Math.cos(inspect.yaw-inspect.facing-Math.PI)>.999);
    const action=await page.evaluate(async id=>{const w=window.__ember.getWorld(),n=w.people.find(p=>p.id===id),before=JSON.stringify(n),inventory=JSON.stringify(w.player.pack);window.__ember.useGame.getState().talk(id);const {getNpcInteractionFx}=await import('/src/game/npc-interaction-animation.ts');const fx=getNpcInteractionFx(w);return {kind:fx?.kind,target:fx?.targetId,npcUnchanged:before===JSON.stringify(n),packUnchanged:inventory===JSON.stringify(w.player.pack)}},original.id);
    check(device+'-'+role+'-real-talk',action.target===original.id&&action.kind===(role==='healer'?'heal':'talk')&&action.npcUnchanged&&action.packUnchanged,action);
   }
  }
 }
 check('no-page-errors',result.errors.length===0);result.passed=true;
} catch(e){result.passed=false;result.failure=e.message;process.exitCode=1}
finally{clearTimeout(watchdog);save();await browser.close()}
console.log(JSON.stringify({passed:result.passed,checks:result.checks.length,samples:result.samples.length,failure:result.failure}));
