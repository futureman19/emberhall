import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out='art/verification/civic/route-destination-diagnostic';fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(out+'/results.json'));
const result={scope:'Sampled normal-speed QA useTile route256,298 to262,304, unchanged terrain, repositioned start. Screenshots perturb timing; no performance or continuous visibility claim.',checks:[],errors:[]};
const save=()=>fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2));
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
try {
for(const device of ['desktop','mobile']) {
const viewport=device==='desktop'?{width:1440,height:960}:{width:390,height:844};
const context=await browser.newContext({viewport,hasTouch:device==='mobile'});await context.routeWebSocket(/.*/,()=>{});
const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|GLSL|THREE/.test(m.text()))result.errors.push(m.text())});
await page.addInitScript(s=>localStorage.setItem('emberhall-save-v4',s),fs.readFileSync('public/art/phase1-review-save.json','utf8'));
await page.goto('https://emberhall-vale-1hq8nnatn-andrews-projects-ffe8a9fd.vercel.app/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__emberCamera&&window.__ember?.useGame.getState().phase==='playing');
await page.evaluate(()=>{const s=window.__ember.useGame.getState(),p=window.__ember.getWorld().people.find(p=>p.isPlayer);s.speed(0);p.x=256;p.z=298;p.path=[];s.setPanel('none');s.select(null);s.tick(0)});await page.waitForTimeout(8500);
const state=()=>page.evaluate(()=>{const p=window.__ember.getWorld().people.find(p=>p.isPlayer);const w=window.__ember.getWorld(),s=window.__ember.useGame.getState();return {x:p.x,z:p.z,path:p.path,destination:w.tiles[304]?.[262],mode:{buildKind:s.buildKind,tillArmed:s.tillArmed,armedSpell:w.player.armedSpell},messages:Object.fromEntries(Object.entries(s).filter(([k,v])=>/flash|toast|message/i.test(k)&&typeof v!=='function')),plots:w.plots.filter(p=>Math.hypot(p.tx-262,p.ty-304)<4),buildings:w.buildings.filter(b=>Math.hypot(b.tx-262,b.ty-304)<12)}});
const before=await state();await page.evaluate(()=>window.__ember.useGame.getState().useTile(262,304));const intent=await state();
const samples=[];await page.evaluate(()=>window.__ember.useGame.getState().speed(1));
for(let i=0;i<1;i++){await page.waitForTimeout(400);const position=await state();const file=device+'-'+i+'.png';await page.screenshot({path:out+'/'+file});samples.push({position,file});}
await page.evaluate(()=>window.__ember.useGame.getState().speed(0));const after=await state();
result.checks.push({device,before,intent,after,samples,passed:intent.path.length>0&&Math.hypot(after.x-262,after.z-304)<.25});save();await context.close();
}
result.passed=result.checks.length===2&&result.checks.every(x=>x.passed)&&result.errors.length===0;if(!result.passed)process.exitCode=1;
}catch(e){result.failure=e.message;process.exitCode=1}finally{save();await browser.close();console.log(JSON.stringify(result))}
