// Bounded ABBA diagnostic: current civic visuals held fixed; only Phase1 furnishing/sign GLBs differ.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url=process.argv[2]??'http://127.0.0.1:8093';assert(['localhost','127.0.0.1'].includes(new URL(url).hostname));
const label=process.argv[3]??'hall-abba';assert.match(label,/^[a-z0-9-]+$/);const out='art/verification/civic/'+label+'.json';assert(!fs.existsSync(out),'Preserve previous results');
const result={scope:'Current civic renderer in both arms, mobile hall interior, fixed fixture/noon/clear. Off aborts only new Phase1 props/signs. CPU render submission is NOT GPU execution time. Diagnostic does not waive original failed gates.',order:label.includes('baab')?['on','off','off','on']:['off','on','on','off'],frames:300,settleMs:8500,runs:[],errors:[]};
const flush=()=>fs.writeFileSync(out,JSON.stringify(result,null,2));
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
const watchdog=setTimeout(()=>browser.close(),180000);
try {
 for(const arm of result.order){
  const ctx=await browser.newContext({viewport:{width:390,height:844}});await ctx.routeWebSocket(/.*/,()=>{});
  if(arm==='off')await ctx.route(/\/art\/lanternwood\/(?:interior-[^/]+|notice|board)\.glb$/,r=>r.abort());
  const page=await ctx.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>result.errors.push(e.message));
  await page.addInitScript(s=>localStorage.setItem('emberhall-save-v4',s),fs.readFileSync('public/art/phase1-review-save.json','utf8'));
  await page.goto(url+'/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing');await page.waitForLoadState('networkidle');
  await page.evaluate(async()=>{const src=await(await fetch('/src/components/game/world-scene.tsx')).text(),m=src.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/),f=await import(m[1]);window.__perf=f._roots.get(document.querySelector('canvas')).store.getState();const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);p.x=256;p.z=290;p.path=[];w.hour=12;Object.assign(w.weather,{kind:'clear',cloud:.06,wet:0,wind:.12,untilHour:99999,douseHour:0});s.speed(0);s.tick(0)});
  await page.waitForTimeout(8500);
  const sample=await page.evaluate(()=>new Promise(resolve=>{const s=window.__perf,g=s.gl,old=g.render,submissions=[],times=[];let last;g.render=function(...args){const start=performance.now();try{return old.apply(this,args)}finally{submissions.push(performance.now()-start)}};function frame(t){if(last!==undefined)times.push(t-last);last=t;if(times.length<300)return requestAnimationFrame(frame);g.render=old;const p=(a,q)=>[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*q)];let interior=false;s.scene.traverse(o=>{if(o.name==='blender-interior-hall')interior=true});const raw=g.getContext(),ext=raw.getExtension('WEBGL_debug_renderer_info');resolve({interior,frames:times.length,median:p(times,.5),p95:p(times,.95),renderSubmissionMedian:p(submissions,.5),renderSubmissionP95:p(submissions,.95),over25:times.filter(t=>t>25).length,drawCalls:g.info.render.calls,triangles:g.info.render.triangles,geometries:g.info.memory.geometries,renderer:ext?raw.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',times,submissions})}requestAnimationFrame(frame)}));
  assert.equal(sample.interior,arm==='on');result.runs.push({arm,...sample});flush();await ctx.close();
 }
 result.passed=result.errors.length===0;
} catch(e){result.failure=e.message;result.passed=false;process.exitCode=1}
finally{clearTimeout(watchdog);flush();await browser.close()}
console.log(JSON.stringify({passed:result.passed,runs:result.runs.map(({arm,p95,renderSubmissionP95,over25})=>({arm,p95,renderSubmissionP95,over25})),failure:result.failure}));
