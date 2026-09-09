import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const [url='http://127.0.0.1:8093',label='hud-local']=process.argv.slice(2);assert.match(label,/^[a-zA-Z0-9_-]+$/);
const root=new URL('../',import.meta.url),out=new URL(`art/verification/phase1/${label}/`,root);fs.mkdirSync(out,{recursive:true});
const fixture=fs.readFileSync(new URL('public/art/phase1-review-save.json',root),'utf8');
const result={url,cases:[],checks:[],errors:[]};
const flush=()=>fs.writeFileSync(new URL('results.json',out),JSON.stringify(result,null,2));
const check=(name,ok)=>{result.checks.push({name,ok});flush();assert(ok,name)};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
try{
for(const [device,viewport,layout] of [
 ['desktop',{width:1440,height:960},null],
 ['mobile',{width:390,height:844},{x:200,y:700,size:220,minimized:false}],
 ['landscape',{width:844,height:390},{x:340,y:700,size:320,minimized:false}],
]){
 const context=await browser.newContext({viewport});await context.routeWebSocket(/.*/,()=>{});const page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>result.errors.push(e.message));
 await page.addInitScript(({fixture,layout})=>{if(!localStorage.getItem('emberhall-save-v4'))localStorage.setItem('emberhall-save-v4',fixture);if(layout&&!localStorage.getItem('emberhall-minimap-layout-v1'))localStorage.setItem('emberhall-minimap-layout-v1',JSON.stringify(layout))},{fixture,layout});
 const start=async()=>{await page.goto(url,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing');await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(0);s.setPanel('none');s.closeCraft();s.flash('')});await page.getByTestId('movable-minimap').waitFor();await page.waitForTimeout(500)};
 const measure=async(name)=>{const data=await page.evaluate(()=>{const rect=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}};return {map:rect(document.querySelector('[data-testid="movable-minimap"]')),dock:rect(document.querySelector('[data-testid="bottom-dock"]')),buttons:['Guide','Hold','Spellbook','Work'].map(n=>({name:n,...rect(document.querySelector(`[aria-label="${n}"]`))})),stored:JSON.parse(localStorage.getItem('emberhall-minimap-layout-v1'))}});const a=data.map,b=data.dock;check(`${device}-${name}-dock-clear`,!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y));check(`${device}-${name}-44px-buttons`,data.buttons.every(b=>b.width>=44&&b.height>=44));result.cases.push({device,name,...data});flush();return data};
 await start();const initial=await measure('loaded');if(device==='desktop')check('desktop-default-slot-preserved',initial.map.x===1268&&initial.map.y===720&&initial.map.width===160);if(device==='landscape')check('landscape-size-fits',initial.map.width===298);
 await page.getByRole('button',{name:'Minimize mini-map',exact:true}).click();await page.getByTestId('minimap-restore').waitFor();check(`${device}-minimize`,await page.getByTestId('movable-minimap').count()===0);
 await page.getByTestId('minimap-restore').click();await page.getByTestId('movable-minimap').waitFor();await measure('restored');
 const surface=await page.getByTestId('minimap-drag-surface').boundingBox();assert(surface);const before=await page.evaluate(()=>window.__ember.getWorld().people.find(p=>p.isPlayer).path);
 await page.mouse.move(surface.x+30,surface.y+30);await page.mouse.down();await page.mouse.move(surface.x+45,surface.y+50,{steps:8});await page.mouse.up();await page.waitForTimeout(350);await measure('dragged');
 check(`${device}-drag-no-walk-intent`,JSON.stringify(before)===JSON.stringify(await page.evaluate(()=>window.__ember.getWorld().people.find(p=>p.isPlayer).path)));
 const saved=await page.evaluate(()=>localStorage.getItem('emberhall-minimap-layout-v1'));await start();check(`${device}-layout-persists`,saved===await page.evaluate(()=>localStorage.getItem('emberhall-minimap-layout-v1')));await measure('reloaded');
 const c=await context.newCDPSession(page),shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(new URL(`${device}.png`,out),Buffer.from(shot.data,'base64'));await c.detach();await context.close();
}
check('no-page-errors',result.errors.length===0);result.passed=true;
}catch(e){result.failure=String(e);process.exitCode=1}finally{flush();await browser.close();console.log(JSON.stringify({passed:result.passed,failure:result.failure,checks:result.checks.length,cases:result.cases.length}))}
