// Local controlled UI fixtures; real mouse/touch context and transfer input.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PerspectiveCamera, Vector3 } from 'three';
import { groundY } from '../src/game/height.ts';
import { HOUSE_KINDS } from '../src/game/house.ts';
import { stressHouseClearance, closedHouseClearance, competingHousePanels } from './worldwide-house-clearance-stress.mjs';
const [url='http://127.0.0.1:8123',label='house-clearance-before',mode='before']=process.argv.slice(2);
assert(['localhost','127.0.0.1'].includes(new URL(url).hostname));assert.match(label,/^[a-z0-9-]+$/);assert(['before','candidate','built'].includes(mode));
const out=path.resolve('art/verification/worldwide',label);fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(path.join(out,'results.json')));
const report={url,mode,scope:'UI-only controlled owned-house fixtures at existing terrain 254,308; supplied bandages and body relocation. Actual mouse/touch context, chest deposit/retrieval/Close. Desktop, portrait, narrow portrait, landscape. No actual construction, traversal, natural-world, performance or physical-phone claim.',checks:[],cases:[],errors:[]};
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
const check=(name,ok,data={})=>{report.checks.push({name,ok:!!ok,...data});flush();if(mode!=='before')assert(ok,name);};
const intersect=(a,b)=>a&&b&&a.width>0&&a.height>0&&a.x<b.right-.5&&a.right>b.x+.5&&a.y<b.bottom-.5&&a.bottom>b.y+.5;
async function project(page,x,z,y){const v=await page.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {camera:window.__emberCamera.getCamera(),target:window.__emberCamera.getTarget(),rect:{x:r.x,y:r.y,width:r.width,height:r.height}};});const c=new PerspectiveCamera(48,v.rect.width/v.rect.height,.2,480);c.position.set(v.camera.x,v.camera.y,v.camera.z);c.lookAt(v.target.x,v.target.y,v.target.z);c.updateMatrixWorld(true);const p=new Vector3(x,y,z).project(c);return {x:v.rect.x+(p.x+1)*v.rect.width/2,y:v.rect.y+(1-p.y)*v.rect.height/2};}
async function state(page,id){return page.evaluate(id=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState();return {house:structuredClone(w.buildings.find(b=>b.id===id)),pack:structuredClone(w.player.pack),bank:structuredClone(w.player.chest),gold:w.gold,hour:w.hour,tick:w.tickCount,ctx:structuredClone(s.ctx),openHouse:s.openHouseId,toast:s.toast};},id);}
async function bounds(page){return page.evaluate(()=>{
 const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const visibleRect=e=>{const r=rect(e);let {x,y,right,bottom}=r;for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=rect(p);if(/auto|scroll|hidden|clip/.test(s.overflowY)){y=Math.max(y,b.y);bottom=Math.min(bottom,b.bottom);}if(/auto|scroll|hidden|clip/.test(s.overflowX)){x=Math.max(x,b.x);right=Math.min(right,b.right);}}return {x,y,right,bottom,width:Math.max(0,right-x),height:Math.max(0,bottom-y)};};
 const panel=document.querySelector('[data-testid="house-chest"]'),buttons=[...panel.querySelectorAll('button')],close=buttons.find(b=>b.textContent.trim()==='Close');
 const controls=[document.querySelector('[aria-label="Open the vale map"]')?.parentElement,document.querySelector('[aria-label="You — pack, paperdoll, skills"]'),document.querySelector('[aria-label="Settings — sound, graphics and the Vault"]'),document.querySelector('[data-testid="bottom-dock"]'),document.querySelector('[aria-label="Resume time"]')?.parentElement].filter(Boolean);
 const r=rect(close),hit=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
 return {panel:rect(panel),header:rect(panel.querySelector('h2')||panel.querySelector('p')),content:rect(panel.querySelector('[data-testid="house-chest-content"]')),close:rect(close),closeHit:!!hit&&(hit===close||close.contains(hit)),controls:controls.map(e=>({name:e.getAttribute('aria-label')||e.getAttribute('data-testid')||'status HUD',...rect(e)})),minimap:rect(document.querySelector('[data-testid="movable-minimap"]')),status:[...document.querySelectorAll('[role="status"]')].map(e=>({text:e.textContent,inside:panel.contains(e),pointerEvents:getComputedStyle(e).pointerEvents,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,...rect(e)})),buttons:buttons.map(e=>({text:e.textContent,raw:rect(e),...visibleRect(e)})),width:innerWidth,height:innerHeight,scrollWidth:panel.scrollWidth,clientWidth:panel.clientWidth};
 });}
async function capture(page,prefix,phase,row){row[phase]={state:await state(page,row.id),bounds:await bounds(page)};await page.screenshot({path:path.join(out,prefix+'-'+phase+'.png')});flush();return row[phase];}
function clearance(prefix,b){check(prefix+'-panel-within-viewport',b.panel.x>=0&&b.panel.right<=b.width&&b.panel.y>=0&&b.panel.bottom<=b.height,{panel:b.panel});check(prefix+'-panel-clears-hud',b.controls.every(c=>!intersect(b.panel,c)),{controls:b.controls,panel:b.panel});check(prefix+'-close-visible-and-hittable',b.close.y>=0&&b.close.bottom<=b.height&&b.closeHit,{close:b.close});check(prefix+'-no-horizontal-overflow',b.scrollWidth<=b.clientWidth);check(prefix+'-feedback-clears-buttons',b.status.every(s=>b.buttons.filter(btn=>btn.y>=b.panel.y&&btn.bottom<=b.panel.bottom).every(btn=>!intersect(s,btn))),{status:b.status});}
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});const watchdog=setTimeout(()=>browser.close(),300000);
try{
 for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}],['narrow',{width:320,height:568}],['landscape',{width:844,height:390}]]){
  const touch=device!=='desktop',context=await browser.newContext({viewport,hasTouch:touch,deviceScaleFactor:1});await context.routeWebSocket(/.*/,()=>{});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(raw=>localStorage.setItem('emberhall-save-v4',raw),fs.readFileSync('public/art/phase1-review-save.json','utf8'));
  await page.goto(url+'/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>{if(window.__ember?.useGame.getState().phase!=='playing'||!window.__emberCamera)return false;window.__ember.useGame.getState().speed(0);return true;});await page.waitForLoadState('networkidle');
  const activate=async locator=>touch?locator.tap():locator.click();
  for(const kind of HOUSE_KINDS){
   const prefix=device+'-'+kind,row={device,kind,id:'qa-clearance-'+kind};report.active=row;
   const tiles=await page.evaluate(({kind,id})=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);s.closeCtx();s.setPanel('none');window.__ember.useGame.setState({openHouseId:null,toast:null});w.buildings=w.buildings.filter(b=>b.ownerId!==w.player.id);w.buildings.push({id,kind,tx:254,ty:308,beds:[],ownerId:w.player.id,chest:{},chestGold:0});p.x=254;p.z=308;p.path=[];p.story=0;p.ghost=false;w.player.ghost=false;w.player.intent.kind='none';w.player.armedSpell=null;w.player.poisonUntil=0;w.player.invisUntil=0;w.player.blessUntil=0;w.hour=12;w.player.pack={bandage:3};s.tick(.13);const tiles=[];for(let z=305;z<=312;z++)for(let x=251;x<=258;x++)tiles.push({x,z,...w.tiles[z][x]});return tiles;},{kind,id:row.id});
   const world={tiles:[]};for(const {x,z,...tile} of tiles){world.tiles[z]??=[];world.tiles[z][x]=tile;}
   await page.waitForTimeout(550);row.before=await state(page,row.id);
   const point=await project(page,254,309,groundY(world,254,309));
   if(!touch)await page.mouse.click(point.x,point.y,{button:'right'});
   else{const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await page.waitForTimeout(750);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
   assert.equal((await state(page,row.id)).ctx?.target.id,row.id,'actual context targets fixture house');await activate(page.getByRole('button',{name:'Open the chest',exact:true}));
   const panel=page.getByTestId('house-chest');await panel.waitFor();const initial=await capture(page,prefix,'open',row);clearance(prefix+'-open',initial.bounds);
   if(mode!=='before')await competingHousePanels({page,row,prefix,check,activate});
   await activate(panel.locator('div.grid > div').nth(0).getByRole('button',{name:'Bandage 3',exact:true}));await panel.locator('div.grid > div').nth(1).getByRole('button',{name:'Bandage 3',exact:true}).waitFor();
   const stored=await capture(page,prefix,'stored',row);clearance(prefix+'-stored',stored.bounds);check(prefix+'-real-deposit',stored.state.pack.bandage===0&&stored.state.house.chest.bandage===3&&stored.state.openHouse===row.id);check(prefix+'-one-local-feedback',stored.bounds.status.length===1&&stored.bounds.status[0].inside&&stored.bounds.status[0].text==='Into the chest.');
   await activate(panel.locator('div.grid > div').nth(1).getByRole('button',{name:'Bandage 3',exact:true}));await panel.locator('div.grid > div').nth(0).getByRole('button',{name:'Bandage 3',exact:true}).waitFor();
   const taken=await capture(page,prefix,'taken',row);clearance(prefix+'-taken',taken.bounds);check(prefix+'-real-retrieve',taken.state.pack.bandage===3&&taken.state.house.chest.bandage===0);check(prefix+'-rules-and-clock-unchanged',taken.state.hour===row.before.hour&&taken.state.tick===row.before.tick&&taken.state.gold===row.before.gold&&JSON.stringify(taken.state.bank)===JSON.stringify(row.before.bank));
   if(mode!=='before')await stressHouseClearance({page,context,touch,row,prefix,check,capture,clearance,activate});
   if(mode==='before'&&!taken.bounds.closeHit)await page.evaluate(()=>window.__ember.useGame.setState({openHouseId:null}));else await activate(panel.getByRole('button',{name:'Close',exact:true}));
   check(prefix+'-real-close',!(await panel.isVisible())&&(await state(page,row.id)).openHouse===null);
   if(mode!=='before')await closedHouseClearance({page,prefix,check,activate});
   report.cases.push(row);flush();console.log(mode,device,kind,'recorded');
  }
  await context.close();
 }
 check('no-runtime-errors',report.errors.length===0,{errors:report.errors});check('all-three-by-four-cases',report.cases.length===12&&new Set(report.cases.map(r=>r.device+':'+r.kind)).size===12);
 report.passed=report.checks.every(c=>c.ok);if(!report.passed)process.exitCode=1;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
finally{clearTimeout(watchdog);flush();await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,checks:report.checks.length,failed:report.checks.filter(c=>!c.ok).map(c=>c.name),failure:report.failure}));
