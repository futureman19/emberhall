// Existing settlement census with projected target markers; not entry QA.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PerspectiveCamera,Vector3} from 'three';
import {SAVE_KEY} from '../src/game/save.ts';
const [url='http://127.0.0.1:8123',label='vis-u4-settlement',mode='candidate']=process.argv.slice(2);
assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));assert.match(label,/^[a-z0-9-]+$/);
const out=path.resolve('art/verification/worldwide',label);fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(path.join(out,'results.json')));
const raw=fs.readFileSync('art/verification/worldwide/vis-u1-smoke-v1/disposable-save.json','utf8');
const result={mode,url,scope:'Existing bank/forge/tavern entrance visual census, no terrain edits. Fixture viewpoints only.',cases:[],errors:[]};
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
try {
 for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]) {
  const context=await browser.newContext({viewport,hasTouch:device==='mobile',deviceScaleFactor:1});await context.routeWebSocket(/.*/,()=>{});
  if(mode==='original-sign')await context.route('**/art/lanternwood/forge.glb',route=>route.fulfill({status:200,contentType:'model/gltf-binary',body:fs.readFileSync('art/verification/worldwide/VIS-U4-sign/forge.glb')}));
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
  await page.addInitScript(({raw,key})=>localStorage.setItem(key,raw),{raw,key:SAVE_KEY});await page.goto(url+'/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.waitForFunction(()=>{if(!window.__emberCamera||window.__ember?.useGame.getState().phase!=='playing')return false;window.__ember.useGame.getState().speed(0);return true;});await page.waitForLoadState('networkidle');
  for(const kind of ['bank','forge','tavern']) {
   const row={device,kind};
   row.fixture=await page.evaluate(kind=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);const b=w.buildings.find(b=>b.kind===kind);if(!b)return null;p.x=b.tx;p.z=b.ty+5;p.path=[];p.story=0;w.hour=12;w.player.intent.kind='none';s.setPanel('none');s.closeCtx();s.select(null);s.tick(.01);return {id:b.id,tx:b.tx,ty:b.ty,y:w.tiles[b.ty][b.tx].h*.2};},kind);
   if(!row.fixture){row.status='absent in saved world';result.cases.push(row);flush();continue;}
   await page.waitForTimeout(1800);await page.screenshot({path:path.join(out,device+'-'+kind+'-outside.png')});
   const view=await page.evaluate(()=>{const c=window.__emberCamera,r=document.querySelector('canvas').getBoundingClientRect();return {eye:c.getCamera(),target:c.getTarget(),width:r.width,height:r.height};});
   const camera=new PerspectiveCamera(48,view.width/view.height,.2,480);camera.position.set(view.eye.x,view.eye.y,view.eye.z);camera.lookAt(view.target.x,view.target.y,view.target.z);camera.updateMatrixWorld(true);
   const v=new Vector3(row.fixture.tx,row.fixture.y+1,row.fixture.ty).project(camera);
   row.marker={x:(v.x+1)*view.width/2,y:(1-v.y)*view.height/2};
   await page.evaluate(({marker,kind})=>{document.getElementById('qa-target-marker')?.remove();const d=document.createElement('div');d.id='qa-target-marker';d.textContent='QA '+kind+' centre';d.style.cssText=`position:fixed;left:${marker.x}px;top:${marker.y}px;border:2px solid cyan;color:cyan;background:#000b;font:12px monospace;padding:4px;z-index:99999;pointer-events:none`;document.body.append(d);},{marker:row.marker,kind});
   await page.screenshot({path:path.join(out,device+'-'+kind+'-marked.png')});
   await page.evaluate(()=>document.getElementById('qa-target-marker')?.remove());
   row.status='captured existing settlement; fixture-positioned viewpoint, not entry acceptance';result.cases.push(row);flush();
  }
  await context.close();
 }
 const unexpected=result.errors.filter(e=>!(mode==='fallback'&&e.includes('503')));assert.deepEqual(unexpected,[]);
 result.passed=true;
} catch(e){result.passed=false;result.failure=e.stack;process.exitCode=1;}finally{flush();await browser.close();}
console.log(JSON.stringify({passed:result.passed,cases:result.cases.length,errors:result.errors,failure:result.failure,out}));
