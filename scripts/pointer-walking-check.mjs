import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PerspectiveCamera,Vector3} from 'three';
const out='art/verification/civic/pointer-walking';fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(out+'/results.json'));
const result={scope:'Actual mouse/touch input; repositioned player in unchanged review-save terrain. Camera projection uses source fov48. No performance acceptance.',checks:[],errors:[]};
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
const state=()=>page.evaluate(()=>{const p=window.__ember.getWorld().people.find(p=>p.isPlayer);return {x:p.x,z:p.z,path:p.path}});
const before=await state(),cam=await page.evaluate(()=>({p:window.__emberCamera.getCamera(),t:window.__emberCamera.getTarget()}));
const camera=new PerspectiveCamera(48,viewport.width/viewport.height,.2,480);camera.position.set(cam.p.x,cam.p.y,cam.p.z);camera.lookAt(cam.t.x,cam.t.y,cam.t.z);camera.updateMatrixWorld();const v=new Vector3(before.x+1,0,before.z+2).project(camera);const point={x:(v.x+1)*viewport.width/2,y:(1-v.y)*viewport.height/2};
await page.screenshot({path:out+'/'+device+'-before.png'});
if(device==='mobile')await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
const intent=await state();await page.evaluate(()=>window.__ember.useGame.getState().speed(1));await page.waitForTimeout(2500);await page.evaluate(()=>window.__ember.useGame.getState().speed(0));const after=await state();await page.screenshot({path:out+'/'+device+'-after.png'});
result.checks.push({device,point,before,intent,after,passed:intent.path.length>0&&Math.hypot(after.x-before.x,after.z-before.z)>.2});save();await context.close();
}
result.passed=result.checks.length===2&&result.checks.every(x=>x.passed)&&result.errors.length===0;if(!result.passed)process.exitCode=1;
}catch(e){result.failure=e.message;process.exitCode=1}finally{save();await browser.close();console.log(JSON.stringify(result))}
