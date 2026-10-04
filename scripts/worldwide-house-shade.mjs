// Local-only real deed input on a disposable copy of loaded terrain; never alters terrain.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { houseIdentityChecks } from './worldwide-house-id-checks.mjs';
import ts from 'typescript';
import { PerspectiveCamera, Vector3 } from 'three';
import { HOUSE_KINDS, HOUSE_DEEDS, houseSiteError } from '../src/game/house.ts';
import { COURT } from '../src/game/atlas.ts';
import { groundY } from '../src/game/height.ts';
import { ITEM_META, emptyChest, emptyPack } from '../src/game/catalog.ts';
const [url='http://127.0.0.1:8123',label='house-shade-candidate',mode='candidate',scenario='shade']=process.argv.slice(2);
assert(['shade','identity'].includes(scenario));const identity=scenario==='identity';
assert(['localhost','127.0.0.1'].includes(new URL(url).hostname));assert.match(label,/^[a-z0-9-]+$/);assert(['candidate','built','failure','original'].includes(mode));
const out=path.resolve('art/verification/worldwide',label);assert(!fs.existsSync(path.join(out,'results.json')));fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync('src/components/game/building-meshes.tsx','utf8'),specs={};new Function('exports',ts.transpile(source.slice(source.indexOf('function put('),source.indexOf('function occupant('))+'\nexport { SPECS };',{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(specs);
const report={url,mode,scenario,kinds:HOUSE_KINDS,scope:'Three deed kinds, desktop and genuine touch. Loaded review-save terrain preserved. Disposable removal of owned house, four other-owner blockers at auto-hut candidate spots, supplied deeds, fixture tick counter raised beyond loaded numeric IDs to isolate a retained existing ID-collision bug, normalized pause/clock and bounded body relocation to an eligible existing-terrain site. Real Pack/deed button and terrain press/release, no direct placement call. No walking, full construction animation, natural-world-wide, performance or physical-phone acceptance.',checks:[],cases:[],errors:[],requests:[]};
if(identity)report.scope=report.scope.replace('fixture tick counter raised beyond loaded numeric IDs to isolate a retained existing ID-collision bug, ','unadjusted loaded tick counter, ');
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
function check(name,ok,data={}){report.checks.push({name,ok:!!ok,...data});flush();assert(ok,name);}
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});const watchdog=setTimeout(()=>browser.close(),300000);
async function state(page){return page.evaluate(()=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);return {player:{id:p.id,x:p.x,z:p.z,path:structuredClone(p.path)},buildKind:s.buildKind,buildAt:s.buildAt,pack:structuredClone(w.player.pack),gold:w.gold,tickCount:w.tickCount,buildings:structuredClone(w.buildings),toast:s.toast,hour:w.hour,fx:structuredClone(w.constructionFx??[])};});}
async function project(page,x,z,y){const v=await page.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {camera:window.__emberCamera.getCamera(),target:window.__emberCamera.getTarget(),rect:{x:r.x,y:r.y,width:r.width,height:r.height}};});const c=new PerspectiveCamera(48,v.rect.width/v.rect.height,.2,480);c.position.set(v.camera.x,v.camera.y,v.camera.z);c.lookAt(v.target.x,v.target.y,v.target.z);c.updateMatrixWorld(true);const p=new Vector3(x,y,z).project(c);return {x:v.rect.x+(p.x+1)*v.rect.width/2,y:v.rect.y+(1-p.y)*v.rect.height/2,view:v};}
async function preview(page){if(mode==='built')return null;return page.evaluate(()=>{const rows=[];window.__shadeScene.traverse(o=>{if(o.isInstancedMesh&&o.material?.opacity===.34&&o.material?.isMeshBasicMaterial){rows.push({count:o.count,visible:o.visible&&o.parent.visible,color:o.material.color.getHexString(),children:o.parent.children.map(c=>({type:c.type,visible:c.visible,color:c.material?.color?.getHexString(),opacity:c.material?.opacity}))});}});return rows;});}
async function capture(page,prefix,phase,row){row[phase]={state:await state(page),preview:await preview(page)};if(mode!=='built'&&row[phase].state.buildAt){row[phase].liveDecision=await page.evaluate(async()=>{const s=window.__ember.useGame.getState(),w=window.__ember.getWorld(),m=await import('/src/game/placement-preview.ts'),canonical=await import('/src/game/house.ts');return {error:m.placementPreviewError(w,s.buildKind,s.buildAt.tx,s.buildAt.ty),canonicalError:canonical.houseSiteError(w,s.buildKind,s.buildAt.tx,s.buildAt.ty),ghost:w.player.ghost,owned:w.buildings.filter(b=>b.ownerId===w.player.id&&['porch','hut','homestead'].includes(b.kind))};});}await page.screenshot({path:path.join(out,prefix+'-'+phase+'.png')});flush();}
async function activate(page,device,locator){if(device==='mobile')await locator.tap();else await locator.click();}
try{
 for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,hasTouch:device==='mobile',deviceScaleFactor:1});await context.routeWebSocket(/.*/,()=>{});
  if(mode==='original')await context.route('**/src/components/game/building-meshes.tsx*',async route=>{const response=await route.fetch(),text=await response.text();assert(text.includes('/src/game/placement-preview.ts'));const body=text.replaceAll('placementPreviewError','siteError').replace('/src/game/placement-preview.ts','/src/game/building-size.ts');assert(body!==text&&!body.includes('/src/game/placement-preview.ts'));report.originalOverrides=(report.originalOverrides??0)+1;return route.fulfill({response,body});});
  if(mode==='failure')await context.route('**/art/lanternwood/architecture-*.glb',r=>{report.requests.push({device,url:r.request().url(),injected:true,status:503});return r.fulfill({status:503,contentType:'text/plain',body:'Deliberate local QA rejection'});});
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push({device,type:'page',text:e.message}));page.on('console',m=>{if(m.type()==='error')report.errors.push({device,type:'console',text:m.text()});});page.on('response',r=>{if(/architecture-.*\.glb$/.test(r.url()))report.requests.push({device,url:r.url(),status:r.status()});});
  await page.addInitScript(raw=>localStorage.setItem('emberhall-save-v4',raw),fs.readFileSync('public/art/phase1-review-save.json','utf8'));
  await page.goto(url+'/?qa=1');if(identity)await page.evaluate(()=>{window.__shadeIdentityPause=true;});await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>{if(window.__ember?.useGame.getState().phase!=='playing'||!window.__emberCamera)return false;if(window.__shadeIdentityPause)window.__ember.useGame.getState().speed(0);return true;});await page.waitForLoadState('networkidle');
  await page.evaluate(identity=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState();s.speed(0);s.setPanel('none');s.closeCtx();w.hour=12;window.__shadeBaseBuildings=structuredClone(w.buildings);window.__shadeTerrain=JSON.stringify(w.tiles);const ids=[...w.buildings,...w.people,...w.fauna,...w.plots,...w.herbs,...w.piles].map(v=>Number(v.id?.match(/-(\d+)$/)?.[1]??0));window.__shadeCounterBefore=w.tickCount;if(!identity)w.tickCount=Math.max(w.tickCount,...ids)+1;window.__shadeCounterAfter=w.tickCount;},identity);
  if(mode!=='built')await page.evaluate(async()=>{const text=await(await fetch('/src/components/game/world-scene.tsx')).text(),m=text.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);const f=await import(m[1]);window.__shadeScene=f._roots.get(document.querySelector('canvas')).store.getState().scene;});
  report.fixtureCounters??=[];report.fixtureCounters.push(await page.evaluate(()=>({before:window.__shadeCounterBefore,after:window.__shadeCounterAfter})));if(identity)check(device+'-fixture-counter-not-normalized',report.fixtureCounters.at(-1).before===report.fixtureCounters.at(-1).after);
  const cdp=device==='mobile'?await context.newCDPSession(page):null;
  for(const kind of HOUSE_KINDS){
   const prefix=device+'-'+kind,row={device,kind};report.active=row;flush();
   const region=await page.evaluate(({origin,empty})=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);w.buildings=structuredClone(window.__shadeBaseBuildings).filter(b=>!(b.ownerId===w.player.id&&['porch','hut','homestead'].includes(b.kind)));for(const [i,[dx,dz]] of [[-6,6],[10,6],[-10,-8],[2,10]].entries())w.buildings.push({id:'qa-bootstrap-blocker-'+i,kind:'hut',tx:origin.tx+dx,ty:origin.ty+dz,beds:[],ownerId:'qa-other'});w.player.ghost=false;p.ghost=false;p.story=0;p.path=[];w.player.intent.kind='none';w.player.armedSpell=null;w.player.poisonUntil=0;w.player.invisUntil=0;w.player.pack={...empty,deed_porch:2,deed_hut:2,deed_homestead:2,bandage:3};s.armBuild(null);s.setPanel('none');window.__ember.useGame.setState({toast:null,openHouseId:null});s.tick(.01);const tiles=[];for(let z=264;z<=334;z++)for(let x=220;x<=292;x++)tiles.push({x,z,...w.tiles[z][x]});return {tiles,buildings:structuredClone(w.buildings),people:[structuredClone(p)],player:structuredClone(w.player),plots:structuredClone(w.plots),gold:w.gold};},{origin:COURT,empty:identity?emptyPack():{}});
   const world={...region,tiles:[]};for(const {x,z,...tile} of region.tiles){world.tiles[z]??=[];world.tiles[z][x]=tile;}
   const candidates=[];for(let z=272;z<=326;z++)for(let x=228;x<=284;x++){
    world.people[0].x=x;world.people[0].z=z+5;
    if(houseSiteError(world,kind,x,z))continue;
    // Existing open ground around the target reduces scenery interception without clearing any tile.
    if(![-3,-2,-1,0,1,2,3].every(dz=>[-3,-2,-1,0,1,2,3].every(dx=>['grass','dirt','sand','snow'].includes(world.tiles[z+dz]?.[x+dx]?.kind))))continue;
    if(!['grass','dirt','sand','snow','cobble'].includes(world.tiles[z+5]?.[x]?.kind))continue;
    candidates.push({x,z,d:Math.hypot(x-256,z-292)});
   }
   candidates.sort((a,b)=>a.d-b.d||a.z-b.z||a.x-b.x);check(prefix+'-eligible-loaded-terrain-site',candidates.length>0,{count:candidates.length});const site=candidates[0];row.site=site;world.people[0].x=site.x;world.people[0].z=site.z+5;row.siteError=houseSiteError(world,kind,site.x,site.z);row.footing=region.tiles.filter(t=>Math.abs(t.x-site.x)<=4&&Math.abs(t.z-site.z)<=6);
   await page.evaluate(site=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);p.x=site.x;p.z=site.z+5;p.path=[];p.facing=Math.PI;s.tick(.01);},site);await page.waitForTimeout(450);
   row.before=await state(page);check(prefix+'-no-auto-granted-owned-house',!row.before.buildings.some(b=>b.ownerId===region.player.id&&HOUSE_KINDS.includes(b.kind)));
   await activate(page,device,page.getByRole('button',{name:'You — pack, paperdoll, skills',exact:true}));await activate(page,device,page.getByRole('button',{name:new RegExp(ITEM_META[HOUSE_DEEDS[kind]].label+'.*Place')}));
   check(prefix+'-real-pack-deed-arms-preview',(await state(page)).buildKind===kind);
   const point=await project(page,site.x,site.z,groundY(world,site.x,site.z));row.point=point;
   const press=async()=>{if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:1}]});else{await page.mouse.move(point.x,point.y);await page.mouse.down();}await page.waitForTimeout(220);};
   const release=async()=>{if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();await page.waitForTimeout(240);};
   await press();await capture(page,prefix,'valid',row);
   check(prefix+'-actual-preview-at-target',row.valid.state.buildAt?.tx===site.x&&row.valid.state.buildAt?.ty===site.z,{at:row.valid.state.buildAt,site});
   if(mode!=='built')check(prefix+'-live-canonical-site-valid',row.valid.liveDecision.canonicalError===null,{decision:row.valid.liveDecision});
   if(mode==='original')check(prefix+'-original-policy-override-applied',(report.originalOverrides??0)>0);
   if(row.valid.preview)check(prefix+'-legal-shade-valid-color',row.valid.preview.length===1&&row.valid.preview[0].color==='c9a36a'&&row.valid.preview[0].visible&&row.valid.preview[0].count===specs.SPECS[kind].voxels.length&&row.valid.preview[0].children.every(c=>c.visible&&c.color==='c9a36a'),{preview:row.valid.preview,canonicalError:row.siteError});
   await page.evaluate(deed=>{const w=window.__ember.getWorld();w.player.pack[deed]=0;window.__ember.useGame.getState().tick(.01);},HOUSE_DEEDS[kind]);await page.waitForTimeout(180);await capture(page,prefix,'invalid',row);
   if(row.invalid.preview)check(prefix+'-stationary-deed-loss-invalid-color',row.invalid.preview.length===1&&row.invalid.preview[0].color==='a85a42'&&row.invalid.preview[0].children.every(c=>c.visible&&c.color==='a85a42')&&row.invalid.liveDecision.canonicalError===`Need a ${kind} deed.`);
   await release();row.rejected=await state(page);
   check(prefix+'-invalid-release-rejected-without-cost',JSON.stringify(row.rejected.buildings)===JSON.stringify(row.before.buildings)&&row.rejected.gold===row.before.gold&&row.rejected.pack[HOUSE_DEEDS[kind]]===0&&row.rejected.toast===`Need a ${kind} deed.`,{toast:row.rejected.toast});
   await page.evaluate(deed=>{window.__ember.getWorld().player.pack[deed]=2;window.__ember.useGame.getState().tick(.01);},HOUSE_DEEDS[kind]);await page.waitForTimeout(180);await capture(page,prefix,'restored',row);
   if(row.restored.preview)check(prefix+'-stationary-restored-deed-valid-color',row.restored.preview.length===1&&row.restored.preview[0].color==='c9a36a'&&row.restored.preview[0].children.every(c=>c.visible&&c.color==='c9a36a')&&row.restored.liveDecision.canonicalError===null);
   await press();await release();row.placed=await state(page);
   if(identity)check(prefix+'-placed-building-ids-unique',new Set(row.placed.buildings.map(b=>b.id)).size===row.placed.buildings.length,{ids:row.placed.buildings.map(b=>({id:b.id,kind:b.kind}))});
   const oldIds=new Set(row.before.buildings.map(b=>b.id)),added=row.placed.buildings.filter(b=>!oldIds.has(b.id));row.added=added;
   check(prefix+'-real-release-places-exactly-one',added.length===1&&row.placed.buildings.length===row.before.buildings.length+1);
   const placed=added[0],expected={id:placed.id,kind,tx:site.x,ty:site.z,beds:[],ownerId:region.player.id,chest:emptyChest(),chestGold:0};check(prefix+'-exact-canonical-new-building',JSON.stringify(placed)===JSON.stringify(expected),{placed,expected});
   const expectedPack={...row.before.pack,[HOUSE_DEEDS[kind]]:1};check(prefix+'-one-deed-no-gold-or-other-items-charged',JSON.stringify(row.placed.pack)===JSON.stringify(expectedPack)&&row.placed.gold===row.before.gold);
   check(prefix+'-all-original-buildings-unchanged',JSON.stringify(row.placed.buildings.filter(b=>oldIds.has(b.id)))===JSON.stringify(row.before.buildings));
   check(prefix+'-mode-clears-on-success',row.placed.buildKind===null&&row.placed.buildAt===null);
   check(prefix+'-terrain-byte-preserved',await page.evaluate(()=>JSON.stringify(window.__ember.getWorld().tiles)===window.__shadeTerrain));
   await page.waitForTimeout(900);await capture(page,prefix,'placed',row);
   if(mode!=='built'){
    row.draw=await page.evaluate(({kind,site})=>{const scene=window.__shadeScene,authored=[];scene.traverse(o=>{if(o.name==='blender-architecture-'+kind+'-exterior'&&Math.abs(o.position.x-site.x)<.01&&Math.abs(o.position.z-site.z)<.01)authored.push({name:o.name,position:o.position.toArray(),visible:o.visible});});const groups=[];scene.traverse(o=>{if(!o.isGroup)return;const rows=[];for(const c of o.children){if(!c.isInstancedMesh||!c.material.colorWrite)continue;for(let i=0;i<c.count;i++){const a=c.instanceMatrix.array;rows.push([a[i*16+12],a[i*16+13],a[i*16+14]].map(v=>+v.toFixed(4)).join(','));}}if(rows.length)groups.push(rows.sort());});return {authored,groups};},{kind,site});
    if(mode==='candidate')check(prefix+'-new-authored-body-visible-without-walking',row.draw.authored.length===1&&row.draw.authored[0].visible);
    if(mode==='failure'){const expected=specs.SPECS[kind].voxels.map(v=>[site.x+(v.x+.5)*.5,groundY(world,site.x,site.z)+(v.y+.5)*.5,site.z+(v.z+.5)*.5].map(v=>+v.toFixed(4)).join(',')).sort();check(prefix+'-new-exact-original-fallback-visible',row.draw.authored.length===0&&row.draw.groups.some(g=>JSON.stringify(g)===JSON.stringify(expected)));}
    delete row.draw.groups;
   }
   if(mode!=='failure'){const r=await context.request.get(url+`/art/lanternwood/architecture-${kind}.glb`),bytes=await r.body(),sha=createHash('sha256').update(bytes).digest('hex');check(prefix+'-placed-asset-current',r.status()===200&&sha===createHash('sha256').update(fs.readFileSync(`public/art/lanternwood/architecture-${kind}.glb`)).digest('hex'),{sha});}
   if(identity)await houseIdentityChecks({page,device,mode,url,out,prefix,row,project,ground:groundY(world,site.x,site.z+1),check,report});
   report.cases.push(row);flush();console.log(mode,device,kind,'passed');
  }
  if(cdp)await cdp.detach();await context.close();
 }
 if(mode==='failure')for(const device of ['desktop','mobile'])for(const kind of HOUSE_KINDS)check(device+'-'+kind+'-actual-asset-rejection',report.requests.some(r=>r.device===device&&r.injected&&r.url.endsWith(`architecture-${kind}.glb`)));
 check('no-unexpected-errors',report.errors.filter(e=>!(mode==='failure'&&e.type==='console'&&e.text.includes('503'))).length===0,{errors:report.errors});
 check('all-three-by-two-cases',report.cases.length===HOUSE_KINDS.length*2&&new Set(report.cases.map(r=>r.device+':'+r.kind)).size===HOUSE_KINDS.length*2);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;try{for(const ctx of browser.contexts())for(const p of ctx.pages())if(!p.isClosed())await p.screenshot({path:path.join(out,'failure.png')});}catch{ /* Preserve original failure. */ }}finally{clearTimeout(watchdog);flush();await browser.close();}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,cases:report.cases.length,failure:report.failure,out}));
