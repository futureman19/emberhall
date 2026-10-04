// Controlled non-enterable fortification render/input fixtures; not natural collision/construction.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { PerspectiveCamera, Vector3 } from 'three';
import { chromium } from 'playwright';
import { ARCHITECTURE_KINDS } from '../src/components/game/architecture-kit.ts';
import { cityGateSupplement } from './worldwide-fortification-city.mjs';
const [url='http://127.0.0.1:8123',label='fortifications-candidate-v1',mode='candidate',selected]=process.argv.slice(2);
assert(['localhost','127.0.0.1'].includes(new URL(url).hostname));
assert.match(label,/^[a-z0-9-]+$/);assert(['candidate','control','failure','built'].includes(mode));
const allKinds=ARCHITECTURE_KINDS.filter(k=>['rampart','rampartV','tower','gatehouse'].includes(k));
assert.equal(allKinds.length,4);
const kinds=selected?selected.split(','):allKinds;assert(kinds.length>0&&new Set(kinds).size===kinds.length&&kinds.every(k=>allKinds.includes(k)));
const source=fs.readFileSync('src/components/game/building-meshes.tsx','utf8');
const code=ts.transpile(source.slice(source.indexOf('function put('),source.indexOf('function occupant('))+'\nexport { SPECS };',{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
const specs={};new Function('exports',code)(specs);
const manifest=JSON.parse(fs.readFileSync('public/art/lanternwood/architecture-manifest.json','utf8'));
const out=path.resolve('art/verification/worldwide',label);assert(!fs.existsSync(path.join(out,'results.json')));fs.mkdirSync(out,{recursive:true});
const hashes=Object.fromEntries(kinds.map(k=>[k,createHash('sha256').update(fs.readFileSync(`public/art/lanternwood/architecture-${k}.glb`)).digest('hex')]));
const report={url,mode,kinds,hashes,scope:'Four non-enterable fortification kits in explicitly cleared flat disposable render/input fixtures (256,320), outside former art pilot. Genuine mouse/touch input, original proxy/foundation parity and non-cutaway lifecycle. Full source extraction is Node-only; built browser imports no source. No construction, natural placement/collision, keep stories, AI, performance or physical-phone acceptance.',checks:[],cases:[],requests:[],errors:[]};
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
const check=(name,ok,data={})=>{report.checks.push({name,ok:!!ok,...data});flush();assert(ok,name);};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
const watchdog=setTimeout(()=>browser.close(),300000);
const round=v=>+v.toFixed(4);
const expectedVoxels=(kind,inside)=>specs.SPECS[kind].voxels.filter(v=>!inside||!v.cut).map(v=>[256+(v.x+.5)*.5,1.6+(v.y+.5)*.5,320+(v.z+.5)*.5].map(round).join(',')).sort();
async function tick(page,seconds){await page.evaluate(seconds=>{const s=window.__ember.useGame.getState(),random=Math.random;s.speed(1);try{Math.random=()=>.5;for(let t=0;t<seconds-1e-6;t+=.05)s.tick(Math.min(.05,seconds-t));}finally{Math.random=random;s.speed(0);}},seconds);await page.waitForTimeout(160);}
async function state(page){return page.evaluate(()=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);return {player:{x:p.x,z:p.z,facing:p.facing,path:structuredClone(p.path),hp:p.hp,story:p.story},gold:w.gold,allBuildings:structuredClone(w.buildings),intent:structuredClone(w.player.intent),building:structuredClone(w.buildings[0]),openHouse:s.openHouseId,openCraft:s.openCraft,openGate:s.openGateId,pack:structuredClone(w.player.pack),ctx:structuredClone(s.ctx),toast:s.toast};});}
async function screen(page,x,z,lift=0){
 const v=await page.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {camera:window.__emberCamera.getCamera(),target:window.__emberCamera.getTarget(),rect:{x:r.x,y:r.y,width:r.width,height:r.height}};});
 const c=new PerspectiveCamera(48,v.rect.width/v.rect.height,.2,480);c.position.set(v.camera.x,v.camera.y,v.camera.z);c.lookAt(v.target.x,v.target.y,v.target.z);c.updateMatrixWorld(true);const p=new Vector3(x,1.6+lift,z).project(c);
 return {x:v.rect.x+(p.x+1)*v.rect.width/2,y:v.rect.y+(1-p.y)*v.rect.height/2,view:v};
}
async function input(page,device,point,button='left'){if(device==='mobile')await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y,{button});}
async function geometry(page,kind){
 if(mode==='built')return null;
 return page.evaluate(kind=>{const scene=window.__buildings.scene,T=window.__buildings.THREE;scene.updateMatrixWorld(true);let group;scene.traverse(o=>{if(!o.isGroup||group)return;const mesh=o.children.find(c=>c.isInstancedMesh&&c.count>10);if(!mesh)return;const mat=new T.Matrix4();mesh.getMatrixAt(0,mat);const pos=new T.Vector3().setFromMatrixPosition(mat);if(Math.abs(pos.x-256)<6&&Math.abs(pos.z-320)<6)group=o;});if(!group)return {found:false};const visible=[],proxy=[];for(const o of group.children){if(!o.isInstancedMesh)continue;for(let i=0;i<o.count;i++){const m=new T.Matrix4();o.getMatrixAt(i,m);const p=new T.Vector3().setFromMatrixPosition(m);(o.material.colorWrite?visible:proxy).push(p.toArray().map(v=>+v.toFixed(4)).join(','));}}return {found:true,exterior:!!group.getObjectByName('blender-architecture-'+kind+'-exterior'),visible:visible.sort(),proxy:proxy.sort(),decorative:group.children.filter(o=>o.name.startsWith('blender-')).map(o=>({name:o.name,position:o.position.toArray(),decorative:o.userData.decorative}))};},kind);
}
async function capture(page,prefix,phase,row){row[phase+'State']=await state(page);row[phase+'Geometry']=await geometry(page,row.kind);row[phase+'Center']=await screen(page,256,320,1);await page.screenshot({path:path.join(out,prefix+'-'+phase+'.png')});flush();}
async function walk(page,device,prefix,x,z,row,key){const point=await screen(page,x,z);await input(page,device,point);row[key+'Input']={point,state:await state(page)};check(prefix+'-'+key+'-actual-walk-input',row[key+'Input'].state.intent.kind==='walk'&&row[key+'Input'].state.player.path.length>0,{...row[key+'Input']});const track=[];for(let i=0;i<30;i++){await tick(page,.2);const s=await state(page);track.push(s.player);if(i===0){await capture(page,prefix,key+'-moving',row);check(prefix+'-'+key+'-moving-capture',s.player.path.length>0&&Math.hypot(s.player.x-row[key+'Input'].state.player.x,s.player.z-row[key+'Input'].state.player.z)>.01);}if(Math.hypot(s.player.x-x,s.player.z-z)<.05&&s.player.path.length===0)break;}row[key+'Track']=track;const end=await state(page);check(prefix+'-'+key+'-arrived',Math.hypot(end.player.x-x,end.player.z-z)<.05&&end.player.path.length===0,{end,track});}

const expectedFoundation=kind=>specs.SPECS[kind].voxels.filter(v=>!v.cut&&v.y===0).map(v=>[256+(v.x+.5)*.5,1.6+(v.y+.5)*.5,320+(v.z+.5)*.5].map(round).join(',')).sort();
function layers(prefix,g,kind){if(!g)return;check(prefix+'-exterior-routing',g.found&&g.exterior===(mode==='candidate'));check(prefix+'-exact-visible-voxels',JSON.stringify(g.visible)===JSON.stringify(mode==='candidate'?expectedFoundation(kind):expectedVoxels(kind,false)));check(prefix+'-exact-original-picking-layer',JSON.stringify(g.proxy)===JSON.stringify(mode==='candidate'?expectedVoxels(kind,false):[]));if(mode==='candidate')check(prefix+'-noninteractive-decoration',g.decorative.some(o=>o.name==='blender-architecture-'+kind+'-exterior'&&o.decorative));}
try{
 for(const kind of kinds)check(kind+'-canonical-non-enterable',specs.SPECS[kind].enterable===false);
 for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,hasTouch:device==='mobile',deviceScaleFactor:1});await context.routeWebSocket(/.*/,()=>{});
  let override=false;
  if(mode==='control')await context.route('**/src/components/game/architecture-kit.ts*',async route=>{const response=await route.fetch(),text=await response.text(),body=text.replace(/return Number\.isFinite\(x\) && Number\.isFinite\(z\) && ARCHITECTURE_KINDS\.includes\(kind\)/,'return false');assert.notEqual(body,text,'original-policy override must actually apply');override=true;await route.fulfill({response,body});});
  if(mode==='failure')await context.route('**/art/lanternwood/architecture-*.glb',route=>{report.requests.push({device,url:route.request().url(),status:503,injected:true});return route.fulfill({status:503,contentType:'text/plain',body:'Deliberate local architecture QA rejection'});});
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push({device,type:'page',text:e.message}));page.on('console',m=>{if(m.type()==='error')report.errors.push({device,type:'console',text:m.text()});});page.on('response',r=>{if(/architecture-[^/]+\.glb$/.test(r.url()))report.requests.push({device,url:r.url(),status:r.status()});});
  await page.addInitScript(raw=>localStorage.setItem('emberhall-save-v4',raw),fs.readFileSync('public/art/phase1-review-save.json','utf8'));
  await page.goto(url+'/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>{if(window.__ember?.useGame.getState().phase!=='playing'||!window.__emberCamera)return false;window.__ember.useGame.getState().speed(0);return true;});await page.waitForLoadState('networkidle');
  if(mode==='control')check(device+'-original-policy-override-applied',override);
  if(mode!=='built')await page.evaluate(async()=>{const text=await(await fetch('/src/components/game/world-scene.tsx')).text(),match=text.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/),fiber=await import(match[1]),three=text.match(/from\s+["']([^"']*three\.js[^"']*)["']/);window.__buildings={...fiber._roots.get(document.querySelector('canvas')).store.getState(),THREE:await import(three[1])};});
  await cityGateSupplement({page,device,mode,report,out,check,flush,tick});
  await page.evaluate(()=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);s.speed(0);w.people=[p];w.fauna=[];w.buildings=w.buildings.filter(b=>b.ownerId===w.player.id&&['porch','hut','homestead'].includes(b.kind));w.houses=[];w.piles=[];w.herbs=[];w.plots=[];w.saplings=[];w.resourceNodes={};w.plantedTimber={};w.scars={};w.player.ghost=false;p.ghost=false;p.story=0;w.player.poisonUntil=0;w.player.invisUntil=0;w.player.armedSpell=null;w.player.intent.kind='none';for(let z=300;z<=342;z++)for(let x=234;x<=280;x++){w.tiles[z][x].kind='dirt';w.tiles[z][x].h=8;}w.landRev++;s.select(null);s.setPanel('none');s.closeCtx();s.tick(.13);});
  for(const kind of kinds){
   const prefix=device+'-'+kind,row={device,kind,door:manifest[kind].door};report.active=row;flush();
   row.fixture=await page.evaluate(kind=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);p.x=256;p.z=325;p.path=[];p.hunger=0;p.energy=100;p.hp=p.maxHp;w.hour=12;w.player.intent.kind='none';w.buildings=[{id:'qa-'+kind,kind,tx:256,ty:320,beds:[]},...w.buildings.filter(b=>b.ownerId===w.player.id&&['porch','hut','homestead'].includes(b.kind))];s.select(null);s.closeCtx();window.__ember.useGame.setState({openHouseId:null,toast:null});s.tick(.13);return structuredClone(w.buildings);},kind);
   await page.waitForTimeout(700);
   if(mode!=='failure'){const r=await context.request.get(`${url}/art/lanternwood/architecture-${kind}.glb`);check(prefix+'-asset-http-hash',r.status()===200&&createHash('sha256').update(await r.body()).digest('hex')===hashes[kind]);}
   await capture(page,prefix,'outside',row);layers(prefix+'-outside',row.outsideGeometry,kind);
   check(prefix+'-fixture-records-preserved',JSON.stringify(row.fixture)===JSON.stringify(row.outsideState.allBuildings));
   // A ground press through original voxel picking must still dispatch ordinary movement.
   await walk(page,device,prefix,256,320,row,'footprint');await capture(page,prefix,'footprint',row);layers(prefix+'-footprint',row.footprintGeometry,kind);
   check(prefix+'-no-house-station-or-gate-ui',!row.footprintState.openHouse&&!row.footprintState.openCraft&&!row.footprintState.openGate&&row.footprintState.player.story===0);
   if(kind==='gatehouse'){
    await walk(page,device,prefix,259,320,row,'east');await walk(page,device,prefix,253,320,row,'cross');await capture(page,prefix,'crossed',row);layers(prefix+'-crossed',row.crossedGeometry,kind);
    check(prefix+'-x-passage-crossed-in-flat-fixture',row.crossTrack.some(p=>p.x<256)&&row.crossedState.player.x===253);
   }
   await walk(page,device,prefix,256,325,row,'away');await capture(page,prefix,'restored',row);layers(prefix+'-restored',row.restoredGeometry,kind);
   check(prefix+'-all-building-records-unchanged',JSON.stringify(row.restoredState.allBuildings)===JSON.stringify(row.fixture));
   check(prefix+'-no-gold-or-pack-change',row.restoredState.gold===row.outsideState.gold&&JSON.stringify(row.restoredState.pack)===JSON.stringify(row.outsideState.pack));
   report.cases.push(row);flush();console.log(mode,device,kind,'recorded');
  }
  await context.close();
 }
 if(mode==='failure')for(const device of ['desktop','mobile'])for(const kind of kinds)check(device+'-'+kind+'-actual-download-rejected',report.requests.some(r=>r.device===device&&r.injected&&r.url.endsWith('/architecture-'+kind+'.glb')));
 check('no-unexpected-errors',report.errors.filter(e=>!(mode==='failure'&&e.type==='console'&&e.text.includes('503'))).length===0,{errors:report.errors});
 check('both-city-input-cases',report.cityCases?.length===2&&new Set(report.cityCases.map(r=>r.device)).size===2);
 check('exact-four-by-two-coverage',report.cases.length===kinds.length*2&&new Set(report.cases.map(c=>c.device+':'+c.kind)).size===kinds.length*2);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;try{for(const context of browser.contexts())for(const page of context.pages())if(!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')});}catch{ /* Retain original failure. */ }}
finally{clearTimeout(watchdog);flush();await browser.close();}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,cases:report.cases.length,failure:report.failure,out}));
