// Native HUD campfire regression. Disposable state; never inject a fire or force snap.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {SAVE_KEY} from '../src/game/save.ts';
const [url='http://127.0.0.1:8135',label='u4-live',mode='candidate',device='desktop']=process.argv.slice(2);
assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));assert.match(label,/^[a-z0-9-]+$/);
const out=path.resolve('art/verification/worldwide',label);fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(path.join(out,'results.json')));
const result={mode,device,requests:[],errors:[],checks:[]};
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
const check=(name,ok,data={})=>{result.checks.push({name,ok,...data});flush();assert(ok,name);};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
try{
 const context=await browser.newContext({viewport:device==='mobile'?{width:390,height:844}:{width:1440,height:960},hasTouch:device==='mobile'});
 await context.routeWebSocket(/.*/,()=>{});
 if(mode==='fallback')await context.route('**/art/lanternwood/campfire.glb',route=>route.fulfill({status:503,body:'Intentional rejected campfire'}));
 const page=await context.newPage();page.on('request',q=>{if(q.url().includes('/campfire.glb'))result.requests.push(q.url());});page.on('pageerror',e=>result.errors.push(e.message));
 const raw=fs.readFileSync('art/verification/worldwide/vis-u1-smoke-v1/disposable-save.json','utf8');
 await page.addInitScript(({raw,key})=>localStorage.setItem(key,raw),{raw,key:SAVE_KEY});await page.goto(url+'/?qa=1');
 const press=async locator=>device==='mobile'?locator.tap():locator.click();
 await press(page.getByRole('button',{name:'Continue',exact:true}));
 await page.waitForFunction(()=>{if(window.__ember?.useGame.getState().phase!=='playing')return false;window.__ember.useGame.getState().speed(0);return true;});await page.waitForLoadState('networkidle');
 // Only fixture supplies pack materials; preserve natural terrain and current player location.
 const start=await page.evaluate(()=>{const w=window.__ember.getWorld();w.player.pack.log=6;return {fires:w.campfires.length};});check('fixture starts without fires',start.fires===0,start);
 await press(page.getByRole('button',{name:'Work',exact:true}));
 await press(page.locator('li').filter({hasText:'Build a campfire'}).getByRole('button',{name:'Make',exact:true}));
 await page.waitForTimeout(2200);
 result.after=await page.evaluate(()=>{const w=window.__ember.getWorld();return {fires:structuredClone(w.campfires),logs:w.player.pack.log,speed:w.speed};});
 check('HUD consumes three logs and creates one fire while paused',result.after.fires.length===1&&result.after.logs===3&&result.after.speed===0,result.after);
 await page.screenshot({path:path.join(out,'after-make.png')});
 const census=()=>page.evaluate(async()=>{const t=await(await fetch('/src/components/game/world-scene.tsx')).text();const f=t.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);const fiber=await import(f[1]);const scene=fiber._roots.get(document.querySelector('canvas')).store.getState().scene;let parts=0,lights=0,flames=0;scene.traverse(o=>{if(o.geometry?.userData.campfirePart)parts++;if(o.isPointLight&&o.color.getHexString()==='ff9440'&&o.distance===5.2)lights++;if(o.isMesh&&['ff9a3c','ffd76a'].includes(o.material?.color?.getHexString()))flames++;});return {parts,lights,flames};});
 result.render=await census();check('native placement requests actual campfire asset',result.requests.length>0,{requests:result.requests});
 check('native fire renders authored or rejected primitive parts plus flame/light',result.render.parts===(mode==='fallback'?0:8)&&result.render.lights===1&&result.render.flames===2,result.render);
 await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(3);for(let i=0;i<400;i++)s.tick(.1);s.speed(0);});await page.waitForTimeout(500);
 result.expired=await census();const remaining=await page.evaluate(()=>window.__ember.getWorld().campfires.length);
 check('real tick expiry removes record and all rendered fire parts',remaining===0&&Object.values(result.expired).every(n=>n===0),result.expired);
 check('no page errors',result.errors.length===0);result.passed=true;
}catch(e){result.passed=false;result.failure=e.stack;process.exitCode=1;}finally{flush();await browser.close();}
console.log(JSON.stringify(result));
