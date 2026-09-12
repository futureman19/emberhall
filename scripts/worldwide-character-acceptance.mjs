// Cleared disposable NPC fixtures; actual inputs and normal simulation, never a production save.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PerspectiveCamera, Vector3 } from 'three';
import { chromium } from 'playwright';
import { CLASS_META, NPC_META, ITEM_META, SHOP_STOCK } from '../src/game/catalog.ts';
const [url='http://127.0.0.1:8123',label='characters-candidate-v1',mode='candidate']=process.argv.slice(2);
assert(['localhost','127.0.0.1'].includes(new URL(url).hostname));
assert.match(label,/^[a-z0-9-]+$/);assert(['candidate','control','failure','built'].includes(mode));
const cases=[...Object.keys(CLASS_META).map(cls=>({id:cls,cls,role:null})),...Object.keys(NPC_META).map(role=>({id:role,role,cls:role==='healer'?'mage':'merchant'}))];
assert.equal(cases.length,8);assert.equal(new Set(cases.map(c=>c.id)).size,8);
const out=path.resolve('art/verification/worldwide',label);assert(!fs.existsSync(path.join(out,'results.json')));fs.mkdirSync(out,{recursive:true});
const asset='/art/lanternwood/character.glb';
const report={url,mode,catalog:cases,scope:'Cleared disposable single-NPC fixtures for five classes and three roles with null homes (outside the old civic policy). Actual mouse/touch ground selection, ordinary walking/approach, real Talk buttons for services. NPC locomotion uses a fixture path and normal fixed world substeps, not natural AI. Original NPC body control and real rejected GLB. Built mode does not import source. Normal camera; no physical-phone, complete animation, dense-scene or performance acceptance.',checks:[],cases:[],errors:[],requests:[],assetHash:createHash('sha256').update(fs.readFileSync('public'+asset)).digest('hex')};
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
const check=(name,ok,evidence={})=>{report.checks.push({name,ok:!!ok,...evidence});flush();assert(ok,name);};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
const watchdog=setTimeout(()=>browser.close(),240000);
async function tick(page,seconds){await page.evaluate(seconds=>{const s=window.__ember.useGame.getState(),random=Math.random;s.speed(1);try{Math.random=()=>.5;for(let t=0;t<seconds-1e-6;t+=.05)s.tick(Math.min(.05,seconds-t));}finally{Math.random=random;s.speed(0);}},seconds);await page.waitForTimeout(90);}
async function snapshot(page){return page.evaluate(()=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState();return {npc:structuredClone(w.people.find(p=>!p.isPlayer)),player:structuredClone(w.people.find(p=>p.isPlayer)),selected:s.selectedId,intent:{...w.player.intent},toast:s.toast,body:document.body.innerText};});}
async function screen(page,x,z,lift=0){
 const v=await page.evaluate(({x,z})=>{const w=window.__ember.getWorld(),tx=Math.round(x),ty=Math.round(z),t=w.tiles[ty][tx],ground=(t.h*4+w.tiles[ty][tx-1].h+w.tiles[ty][tx+1].h+w.tiles[ty-1][tx].h+w.tiles[ty+1][tx].h)/8*.2,r=document.querySelector('canvas').getBoundingClientRect();return {ground,camera:window.__emberCamera.getCamera(),target:window.__emberCamera.getTarget(),rect:{x:r.x,y:r.y,width:r.width,height:r.height}};},{x,z});
 const c=new PerspectiveCamera(48,v.rect.width/v.rect.height,.2,480);c.position.set(v.camera.x,v.camera.y,v.camera.z);c.lookAt(v.target.x,v.target.y,v.target.z);c.updateMatrixWorld(true);const p=new Vector3(x,v.ground+lift,z).project(c);
 return {x:v.rect.x+(p.x+1)*v.rect.width/2,y:v.rect.y+(1-p.y)*v.rect.height/2,view:v};
}
async function model(page){
 if(mode==='built')return null;
 return page.evaluate(()=>{const w=window.__ember.getWorld(),npc=w.people.find(p=>!p.isPlayer),scene=window.__characters.scene;scene.updateMatrixWorld(true);let group;scene.traverse(o=>{if(o.name==='emberhall-npc-figure'&&Math.hypot(o.position.x-npc.x,o.position.z-npc.z)<.01)group=o;});const meshes=[];group?.traverse(o=>{if(o.isMesh)meshes.push({type:o.geometry.type,vertices:o.geometry.attributes.position?.count,color:o.material.color?.getHexString(),position:o.position.toArray(),scale:o.scale.toArray()});});return {found:!!group,x:group?.position.x,z:group?.position.z,yaw:group?.rotation.y,meshes,authored:meshes.some(m=>m.type==='BufferGeometry'&&m.vertices>24)};});
}
async function input(page,device,point,button='left'){if(device==='mobile')await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y,{button});}

async function serviceAction(page,device,spec,prefix,row){
 const cash=()=>page.evaluate(()=>{const w=window.__ember.getWorld();return {gold:w.gold,vault:w.player.vault,pack:{...w.player.pack}};});
 const activate=async button=>{if(device==='mobile')await button.tap();else await button.click();};
 if(spec.role==='banker'){
  check(prefix+'-bank-box-visible',await page.getByTestId('bank-box').isVisible());
  row.bankBefore=await cash();await activate(page.getByRole('button',{name:'Bank gold',exact:true}));row.banked=await cash();
  check(prefix+'-actual-bank-deposit',row.bankBefore.gold>0&&row.banked.gold===0&&row.banked.vault===row.bankBefore.vault+row.bankBefore.gold,{before:row.bankBefore,after:row.banked});
  await activate(page.getByRole('button',{name:'Take 10',exact:true}));row.withdrawn=await cash();
  check(prefix+'-actual-bank-withdraw',row.withdrawn.gold===10&&row.withdrawn.vault===row.banked.vault-10,row.withdrawn);
 }else if(spec.role==='provisioner'){
  const id=SHOP_STOCK[0],meta=ITEM_META[id];row.tradeBefore=await cash();
  await activate(page.getByRole('button',{name:meta.label+' '+meta.buy+'g',exact:true}));row.bought=await cash();
  check(prefix+'-actual-counter-purchase',row.bought.gold===row.tradeBefore.gold-meta.buy&&row.bought.pack[id]===(row.tradeBefore.pack[id]??0)+1,{item:id,price:meta.buy,before:row.tradeBefore,after:row.bought});
 }
}

try{
 for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,hasTouch:device==='mobile',deviceScaleFactor:1});await context.routeWebSocket(/.*/,()=>{});
  if(mode==='control')await context.route('**/src/components/game/civic-character.ts',route=>route.fulfill({contentType:'application/javascript',body:'export function civicCharacterArt(p){return p.isPlayer || (p.home !== null && ["banker","provisioner","healer"].includes(p.role ?? "") && Math.hypot(p.home.tx-256,p.home.ty-292)<=18)};export function civicVisualYaw(f,a){return a?f+Math.PI:f}'}));
  if(mode==='failure')await context.route('**'+asset,route=>{report.requests.push({device,url:route.request().url(),status:503,injected:true});return route.fulfill({status:503,contentType:'text/plain',body:'Deliberate local character QA rejection'});});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  page.on('pageerror',e=>report.errors.push({device,type:'page',text:e.message}));page.on('console',m=>{if(m.type()==='error')report.errors.push({device,type:'console',text:m.text()});});page.on('response',r=>{if(r.url().endsWith(asset))report.requests.push({device,url:r.url(),status:r.status()});});
  await page.addInitScript(raw=>localStorage.setItem('emberhall-save-v4',raw),fs.readFileSync('public/art/phase1-review-save.json','utf8'));
  await page.goto(url+'/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing'&&window.__emberCamera);await page.waitForLoadState('networkidle');
  if(mode!=='built')await page.evaluate(async()=>{const text=await(await fetch('/src/components/game/world-scene.tsx')).text(),match=text.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/),fiber=await import(match[1]);window.__characters=fiber._roots.get(document.querySelector('canvas')).store.getState();});
  if(mode!=='failure'){const r=await context.request.get(url+asset),bytes=await r.body();check(device+'-asset-http-hash',r.status()===200&&createHash('sha256').update(bytes).digest('hex')===report.assetHash,{bytes:bytes.length});}
  await page.evaluate(()=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);s.speed(0);w.hour=12;w.people=[p];w.fauna=[];w.buildings=[];w.houses=[];w.piles=[];w.herbs=[];w.plots=[];w.saplings=[];w.resourceNodes={};w.plantedTimber={};w.scars={};w.player.ghost=false;p.ghost=false;p.story=0;w.player.poisonUntil=0;w.player.intent.kind='none';w.player.invisUntil=0;for(let z=285;z<=320;z++)for(let x=240;x<=280;x++)w.tiles[z][x].kind='dirt';w.landRev++;s.select(null);s.setPanel('none');s.closeCtx();s.tick(.13);});
  for(const spec of cases){
   const prefix=device+'-'+spec.id,row={device,...spec};report.active=row;flush();
   row.fixture=await page.evaluate(spec=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);p.x=255;p.z=306;p.path=[];p.hp=spec.role==='healer'?Math.max(1,p.maxHp-12):p.maxHp;w.player.intent.kind='none';w.hour=12;w.gold=200;w.player.vault=0;const npc={...structuredClone(p),id:'qa-'+spec.id,name:'Review '+spec.id,cls:spec.cls,role:spec.role,isPlayer:false,home:null,look:undefined,x:257,z:302,bob:0,facing:0,path:[],task:'idle',ghost:false};w.people=[p,npc];s.select(null);s.setPanel('none');s.closeCtx();s.tick(.13);window.__ember.useGame.setState({toast:null});return structuredClone(npc);},spec);
   await page.waitForTimeout(500);row.standing=await model(page);const before=await snapshot(page);
   check(prefix+'-fixture-records-preserved',JSON.stringify(before.npc)===JSON.stringify(row.fixture));
   if(row.standing){check(prefix+'-geometry-route',row.standing.found&&row.standing.authored===(mode==='candidate'),row.standing);const expected=mode==='control'?0:Math.PI;check(prefix+'-initial-forward-axis',Math.cos(row.standing.yaw-expected)>.999);}
   row.point=await screen(page,257,302);row.head=await screen(page,257,302,1.8);
   check(prefix+'-target-inside-viewport',row.point.x>30&&row.point.x<viewport.width-30&&row.head.y>110&&row.point.y<viewport.height-180,{point:row.point,head:row.head});
   await page.screenshot({path:path.join(out,prefix+'-standing.png')});
   if(device==='desktop'){await input(page,device,row.point,'right');const target=await page.evaluate(()=>window.__ember.useGame.getState().ctx?.target);check(prefix+'-right-click-exact-person',target?.id===row.fixture.id&&target.kind==='person',{target});await page.getByRole('button',{name:'Cancel',exact:true}).click();}
   await input(page,device,row.point);row.selected=await snapshot(page);check(prefix+'-actual-select',row.selected.selected===row.fixture.id,row.selected);
   if(spec.role){check(prefix+'-actual-service-approach',row.selected.player.path.length>0&&row.selected.intent.kind==='walk',row.selected);await tick(page,2);}
   else {const dest=await screen(page,255,303);await input(page,device,dest);const moving=await snapshot(page);check(prefix+'-actual-ground-walk',moving.intent.kind==='walk'&&moving.player.path.length>0,moving);await tick(page,2);}
   row.arrived=await snapshot(page);check(prefix+'-walked-into-range',Math.hypot(row.arrived.player.x-row.arrived.npc.x,row.arrived.player.z-row.arrived.npc.z)<=2.4&&Math.hypot(row.arrived.player.x-255,row.arrived.player.z-306)>1,row.arrived);
   if(spec.role){const talk=page.getByRole('button',{name:'Talk',exact:true});if(device==='mobile')await talk.tap();else await talk.click();}
   else await input(page,device,await screen(page,row.arrived.npc.x,row.arrived.npc.z));
   row.talk=await snapshot(page);const needle=spec.role==='banker'?'Gold in, gold out.':spec.role==='provisioner'?'Dust, steel':spec.role==='healer'?'wound closes.':'nods.';
   check(prefix+'-normal-talk-result',String(row.talk.toast).includes(needle),{toast:row.talk.toast});
   if(spec.role==='healer')check(prefix+'-real-healing',row.fixture.hp<row.fixture.maxHp&&row.talk.player.hp===row.talk.player.maxHp,{before:row.fixture.hp,after:row.talk.player.hp});
   if(spec.role){check(prefix+'-service-ui',await page.getByRole('button',{name:'Talk',exact:true}).isVisible());await serviceAction(page,device,spec,prefix,row);await page.screenshot({path:path.join(out,prefix+'-service.png')});const close=page.getByRole('button',{name:'Close',exact:true});if(device==='mobile')await close.tap();else await close.click();}
   else await page.evaluate(()=>window.__ember.useGame.getState().select(null));
   await tick(page,3);await page.evaluate(()=>window.__ember.useGame.setState({toast:null}));
   // A prescribed legal path isolates the renderer's live follow/yaw from NPC AI choices.
   row.walkStart=await page.evaluate(()=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer),npc=w.people.find(p=>!p.isPlayer);p.x=255;p.z=306;p.path=[];npc.x=257;npc.z=302;npc.path=[{tx:259,ty:302}];w.player.intent.kind='none';s.tick(.13);return structuredClone(npc);});
   await tick(page,.3);row.walking=await snapshot(page);row.walkingModel=await model(page);
   check(prefix+'-npc-normal-substep-motion',row.walking.npc.x>row.walkStart.x+.4&&Math.abs(row.walking.npc.z-row.walkStart.z)<1e-6,row.walking);
   if(row.walkingModel){const expected=row.walking.npc.facing+(mode==='control'?0:Math.PI);check(prefix+'-live-render-follow-and-yaw',row.walkingModel.found&&Math.abs(row.walkingModel.x-row.walking.npc.x)<.01&&Math.cos(row.walkingModel.yaw-expected)>.999,row.walkingModel);}
   await page.screenshot({path:path.join(out,prefix+'-walking.png')});
   await tick(page,.6);row.walkEnd=await snapshot(page);check(prefix+'-npc-path-completes',Math.abs(row.walkEnd.npc.x-259)<.001&&row.walkEnd.npc.path.length===0,row.walkEnd);
   report.cases.push(row);flush();console.log(mode,device,spec.id,'recorded');
  }
  await context.close();
 }
 if(mode==='failure')check('actual-per-device-rejected-character-download',['desktop','mobile'].every(d=>report.requests.some(r=>r.device===d&&r.injected)),{requests:report.requests});
 const unexpected=report.errors.filter(e=>!(mode==='failure'&&e.type==='console'&&e.text.includes('503')));check('no-unexpected-errors',unexpected.length===0,{unexpected});
 check('exact-eight-by-two-coverage',report.cases.length===16&&new Set(report.cases.map(c=>c.device+':'+c.id)).size===16);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;try{for(const context of browser.contexts())for(const page of context.pages())if(!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')});}catch{ /* Preserve the original failed assertion if capture also fails. */ }}
finally{clearTimeout(watchdog);flush();await browser.close();}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,cases:report.cases.length,failure:report.failure,out}));
