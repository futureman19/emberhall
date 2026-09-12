// Disposable bounded timber lifecycle QA. No live save, publishing or simulation rule edits.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PerspectiveCamera, Vector3 } from 'three';
import { chromium } from 'playwright';
import { bestPlantableTimber, plantSkillFor } from '../src/game/forestry.ts';
import { TIMBER_IDS } from '../src/components/game/timber-renderer-policy.ts';
import { runRareGates } from './worldwide-timber-rare-gates.mjs';
import { ghostTouchNegatives } from './worldwide-ghostwood-touch-checks.mjs';
const [url='http://127.0.0.1:8123',label='timber-pilot-v1',mode='candidate',only='oak,pine,birch']=process.argv.slice(2);
assert(['localhost','127.0.0.1'].includes(new URL(url).hostname));
assert.match(label,/^[a-z0-9-]+$/);assert(['candidate','failure','built'].includes(mode));
const species=only.split(',');assert(species.length && new Set(species).size===species.length && species.every(k=>TIMBER_IDS.includes(k)));
const plantPolicy=Object.fromEntries(species.map(k=>{const skill=plantSkillFor(k);return [k,{skill,selectedByChooser:bestPlantableTimber(skill),ordinary:bestPlantableTimber(skill)===k}];}));
const out=path.resolve('art/verification/worldwide',label);assert(!fs.existsSync(path.join(out,'results.json')));fs.mkdirSync(out,{recursive:true});
const asset=k=>`/art/lanternwood/${k==='oak'?'oak':`timber-${k}`}.glb`;
const report={url,mode,selected:species,scope:'Cleared disposable planted-timber fixture. Real pointer harvest, normal store/world substeps, controlled RNG and regrowth clock jumps. Normal acorn command when selected by the existing chooser; explicit saved sapling for tied-threshold species. See plantPolicy. Rare wild-node gates use canonical seed fixtures with cleared terrain and normal command dispatch. Ghostwood desktop uses right-click Chop; mobile tap remains walk and actual touch hold opens the normal menu, followed by a real button tap. Drag/multitouch/cancel and changing-state negatives included. No direct menu opening in the touch path. Not natural forest/performance or physical-phone certification.',plantPolicy,checks:[],cases:[],errors:[],requests:[],hashes:Object.fromEntries(species.map(k=>[k,createHash('sha256').update(fs.readFileSync('public'+asset(k))).digest('hex')]))};
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
const check=(name,ok,data={})=>{report.checks.push({name,ok:!!ok,...data});flush();assert(ok,name);};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
const watchdog=setTimeout(()=>browser.close(),240000);
const tick=async(page,seconds)=>page.evaluate(seconds=>{const s=window.__ember.useGame.getState(),old=Math.random;s.speed(1);try{Math.random=()=>0;for(let t=0;t<seconds-1e-6;t+=.05)s.tick(Math.min(.05,seconds-t));}finally{Math.random=old;s.speed(0);}},seconds);
async function screen(page,tx,ty,lift=.65){
 const view=await page.evaluate(({tx,ty})=>{const w=window.__ember.getWorld(),t=w.tiles[ty][tx],h=(t.h*4+w.tiles[ty][tx-1].h+w.tiles[ty][tx+1].h+w.tiles[ty-1][tx].h+w.tiles[ty+1][tx].h)/8*.2;const r=document.querySelector('canvas').getBoundingClientRect();return {camera:window.__emberCamera.getCamera(),target:window.__emberCamera.getTarget(),ground:h,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};},{tx,ty});
 const c=new PerspectiveCamera(48,view.rect.width/view.rect.height,.2,480);c.position.set(view.camera.x,view.camera.y,view.camera.z);c.lookAt(view.target.x,view.target.y,view.target.z);c.updateMatrixWorld(true);
 const v=new Vector3(tx,view.ground+lift,ty).project(c);return {x:view.rect.x+(v.x+1)*view.rect.width/2,y:view.rect.y+(1-v.y)*view.rect.height/2,view};
}
async function ghostInput(page,device,point,tx,ty,prefix){
 if(device==='desktop')await page.mouse.click(point.x,point.y,{button:'right'});
 else {
  await page.touchscreen.tap(point.x,point.y);
  const tapped=await snapshot(page,tx,ty);check(prefix+'-ghost-tap-is-walk-not-chop',tapped.intent.kind==='walk',tapped);
  await page.evaluate(()=>{const w=window.__ember.getWorld();w.people[0].path=[];w.player.intent.kind='none';});
  if(!prefix.endsWith('-regrown'))await ghostTouchNegatives({page,tx,ty,prefix,locate:()=>screen(page,tx,ty,.18),check});
  point=await screen(page,tx,ty,.18);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]});
  await page.waitForTimeout(700);
  const held=await page.evaluate(()=>({ctx:window.__ember.useGame.getState().ctx,intent:window.__ember.getWorld().player.intent.kind}));
  check(prefix+'-real-touch-hold-menu',held.ctx?.target.tx===tx&&held.ctx?.target.ty===ty&&held.intent!=='chop',held);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  const released=await snapshot(page,tx,ty);check(prefix+'-hold-release-does-not-walk',released.intent.kind==='none',released);
 }
 const menu=await page.evaluate(()=>window.__ember.useGame.getState().ctx);
 check(prefix+'-ghost-menu-target',menu?.target?.tx===tx&&menu?.target?.ty===ty,{menu,source:device==='desktop'?'real-right-click':'real-touch-hold'});
 const button=page.getByRole('button',{name:/^Chop(?: |$)/});
 const text=await button.innerText();report.ghostMenuLabels??=[];report.ghostMenuLabels.push({device,prefix,text});
 check(prefix+'-planted-menu-name',text.endsWith(' Ghostwood'),{text});
 await page.screenshot({path:path.join(out,prefix+'-menu.png')});
 if(device==='mobile')await button.tap();else await button.click();
}
async function ghostView(page,value){
 await page.evaluate(value=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people[0];w.player.ghost=value;p.ghost=value;p.hp=value?0:p.maxHp;w.player.intent.kind='none';p.path=[];s.tick(.13);},value);
 await page.waitForTimeout(450);
}
async function modelState(page,kind,tx,ty){
 if(mode==='built')return null;
 return page.evaluate(({kind,tx,ty})=>{
  const {scene}=window.__timber;scene.updateMatrixWorld(true);const hits=[];
  scene.traverse(m=>{if(!m.isInstancedMesh)return;for(let i=0;i<m.count;i++){const mat=m.matrix.clone();m.getMatrixAt(i,mat);if(Math.abs(mat.elements[12]-tx)<.01&&Math.abs(mat.elements[14]-ty)<.01 && Math.abs(mat.determinant())>1e-10)hits.push({name:m.name,type:m.geometry.type,vertices:m.geometry.attributes.position.count,index:i,position:mat.elements.slice(12,15)});}});
  const authored=hits.filter(h=>h.name.startsWith(`harvestable-${kind}-`));
  const stump=hits.filter(h=>h.name===`depleted-${kind}-stumps`);
  const young=[];scene.traverse(m=>{if(m.name.startsWith(`authored-${kind}-sapling`)){const p=m.getWorldPosition(m.position.clone());if(Math.abs(p.x-tx)<.01&&Math.abs(p.z-ty)<.01)young.push({name:m.name,scale:m.getWorldScale(m.scale.clone()).toArray()});}});
  return {authored,stump,young,hits};
 },{kind,tx,ty});
}
async function snapshot(page,tx,ty){return page.evaluate(({tx,ty})=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer);return {tile:w.tiles[ty][tx].kind,planted:w.plantedTimber?.[`${tx},${ty}`],node:Object.values(w.resourceNodes).find(n=>n.tx===tx&&n.ty===ty)??null,stacks:{...w.player.resources.stacks},legacyLogs:w.player.pack.log??0,workT:w.player.workT,intent:{...w.player.intent},sapling:w.saplings.find(s=>s.tx===tx&&s.ty===ty)??null,player:{x:p.x,z:p.z,path:p.path},hour:w.hour,toast:window.__ember.useGame.getState().toast};},{tx,ty});}
try{
 for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
  const ctx=await browser.newContext({viewport,hasTouch:device==='mobile',deviceScaleFactor:1});await ctx.routeWebSocket(/.*/,()=>{});
  if(mode==='failure')for(const kind of species)await ctx.route('**'+asset(kind),route=>{report.requests.push({device,kind,url:route.request().url(),status:503,injected:true});return route.fulfill({status:503,contentType:'text/plain',body:'Deliberate local timber QA rejection'});});
  const page=await ctx.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>report.errors.push({device,type:'page',text:e.message}));page.on('console',m=>{if(m.type()==='error')report.errors.push({device,type:'console',text:m.text()});});
  page.on('response',r=>{if(species.some(k=>r.url().endsWith(asset(k))))report.requests.push({device,url:r.url(),status:r.status()});});
  await page.addInitScript(raw=>localStorage.setItem('emberhall-save-v4',raw),fs.readFileSync('public/art/phase1-review-save.json','utf8'));
  await page.goto(url+'/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing'&&window.__emberCamera);await page.waitForLoadState('networkidle');
  if(mode!=='built')await page.evaluate(async()=>{const text=await(await fetch('/src/components/game/world-scene.tsx')).text();const match=text.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);const fiber=await import(match[1]);const forestry=await import('/src/game/forestry.ts');window.__timber={...fiber._roots.get(document.querySelector('canvas')).store.getState(),forestry};});
  await page.evaluate(()=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);s.speed(0);w.hour=12;w.people=[p];w.fauna=[];w.buildings=[];w.houses=[];w.piles=[];w.herbs=[];w.plots=[];w.saplings=[];w.resourceNodes={};w.plantedTimber={};w.scars={};w.player.resources={stacks:{}};w.player.pack.log=0;w.player.pack.hatchet=1;w.player.wear.main='hatchet';w.player.skills.lumberjack=100;w.player.ghost=false;p.ghost=false;p.hp=p.maxHp;w.player.poisonUntil=0;w.player.intent.kind='none';for(let z=285;z<=320;z++)for(let x=240;x<=280;x++)w.tiles[z][x].kind='dirt';w.landRev++;s.closeCtx();s.setPanel('none');s.select(null);s.tick(.13);});
  for(const kind of species){
   await runRareGates({page,device,kind,report,check,tick,snapshot});
   if(['redwood','yew','ghostwood'].includes(kind))await tick(page,3);
   const tx=257+species.indexOf(kind)*6,ty=302,prefix=`${device}-${kind}`,row={device,kind,tx,ty};
   if(mode!=='failure'){const response=await ctx.request.get(url+asset(kind));const bytes=await response.body();check(prefix+'-asset-http-hash',response.status()===200&&createHash('sha256').update(bytes).digest('hex')===report.hashes[kind],{status:response.status(),bytes:bytes.length});}
   await page.evaluate(({kind,tx,ty})=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people[0];p.x=tx;p.z=ty+4;p.path=[];w.player.intent.kind='none';w.player.workT=0;w.tiles[ty][tx].kind='tree';w.plantedTimber[`${tx},${ty}`]=kind;w.player.ghost=kind==='ghostwood';p.ghost=kind==='ghostwood';p.hp=p.ghost?0:p.maxHp;w.landRev++;s.setPanel('none');s.closeCtx();s.tick(.13);window.__ember.useGame.setState({toast:null});},{kind,tx,ty});
   await page.waitForTimeout(800);row.standing=await modelState(page,kind,tx,ty);
   if(row.standing)check(prefix+'-standing-route',mode==='candidate'?row.standing.authored.length===2:row.standing.authored.length===0&&row.standing.hits.some(h=>h.type==='CylinderGeometry'),row.standing);
   await page.screenshot({path:path.join(out,prefix+'-standing.png')});
   if(kind==='ghostwood'){
    await ghostView(page,false);row.livingStanding=await modelState(page,kind,tx,ty);
    if(row.livingStanding)check(prefix+'-living-no-tree-mesh',row.livingStanding.authored.length===0&&!row.livingStanding.hits.some(h=>h.type==='CylinderGeometry'),row.livingStanding);
    await page.screenshot({path:path.join(out,prefix+'-living-hidden.png')});await ghostView(page,true);
   }
   let point=await screen(page,tx,ty,kind==='ghostwood'?.18:.65);row.point=point;
   if(mode!=='built')row.rays=await page.evaluate(({point,tx,ty})=>{const {raycaster,camera,scene,gl}=window.__timber,r=gl.domElement.getBoundingClientRect();raycaster.setFromCamera({x:(point.x-r.x)/r.width*2-1,y:1-(point.y-r.y)/r.height*2},camera);const hits=raycaster.intersectObjects(scene.children,true).slice(0,8).map(h=>({name:h.object.name,type:h.object.geometry?.type,point:h.point.toArray(),instanceId:h.instanceId,distance:h.distance})),isolated=[];scene.traverse(m=>{if(!m.isInstancedMesh)return;for(let i=0;i<m.count;i++){const mat=m.matrix.clone();m.getMatrixAt(i,mat);if(Math.abs(mat.elements[12]-tx)>.01||Math.abs(mat.elements[14]-ty)>.01||Math.abs(mat.determinant())<1e-10)continue;const single=new m.constructor(m.geometry,m.material,1);single.setMatrixAt(0,mat);single.matrixWorld.copy(m.matrixWorld);const own=[];single.raycast(raycaster,own);isolated.push({name:m.name,type:m.geometry.type,bounds:m.boundingSphere?.toJSON?.()??m.boundingSphere,hits:own.map(h=>h.point.toArray())});single.dispose();}});return {hits,isolated};},{point,tx,ty});
   report.active=row;flush();
   if(kind==='ghostwood')await ghostInput(page,device,point,tx,ty,prefix);
   else if(device==='desktop'){await page.mouse.click(point.x,point.y,{button:'right'});const menu=await page.evaluate(()=>window.__ember.useGame.getState().ctx);check(prefix+'-right-click-map',menu?.target?.tx===tx&&menu?.target?.ty===ty,{menu});await page.evaluate(()=>window.__ember.useGame.getState().closeCtx());await page.mouse.click(point.x,point.y);}else await page.touchscreen.tap(point.x,point.y);
   row.before=await snapshot(page,tx,ty);check(prefix+'-real-harvest-input',row.before.intent.kind==='chop'&&row.before.intent.tx===tx&&row.before.intent.ty===ty,row.before);
   await tick(page,2);await page.waitForTimeout(300);row.harvest=await snapshot(page,tx,ty);row.depleted=await modelState(page,kind,tx,ty);
   const delta=Object.fromEntries(Object.entries(row.harvest.stacks).map(([k,v])=>[k,v-(row.before.stacks[k]??0)]).filter(([,v])=>v!==0));row.delta=delta;
   check(prefix+'-typed-harvest',Object.keys(delta).length===1&&Object.keys(delta)[0].startsWith(kind+':log:')&&Object.values(delta)[0]===2&&row.harvest.legacyLogs===row.before.legacyLogs,{delta,before:row.before,after:row.harvest});
   check(prefix+'-real-depletion',row.harvest.tile==='dirt'&&Number.isFinite(row.harvest.node?.depletedAtHour)&&row.harvest.intent.kind==='none',row.harvest);
   if(row.depleted)check(prefix+'-stump-route',row.depleted.authored.length===0&&row.depleted.stump.length===1,row.depleted);
   await tick(page,3);await page.waitForTimeout(200);await page.evaluate(()=>window.__ember.useGame.setState({toast:null}));
   await page.screenshot({path:path.join(out,prefix+'-depleted.png')});
   await page.evaluate(()=>{const w=window.__ember.getWorld();w.hour+=72.1;});await tick(page,.05);await page.waitForTimeout(400);row.regrown=await snapshot(page,tx,ty);row.regrownModel=await modelState(page,kind,tx,ty);
   check(prefix+'-regrowth-identity',row.regrown.tile==='tree'&&row.regrown.planted===kind&&row.regrown.node?.depletedAtHour===null&&row.regrown.node.nodeId===row.harvest.node.nodeId,row.regrown);
   if(row.regrownModel)check(prefix+'-regrowth-model',row.regrownModel.stump.length===0&&(mode!=='candidate'||row.regrownModel.authored.length===2),row.regrownModel);
   await page.screenshot({path:path.join(out,prefix+'-regrown.png')});
   // Repeat through actual near/faded tree pointer mapping before planting on its stump.
   point=await screen(page,tx,ty,kind==='ghostwood'?.18:.65);if(kind==='ghostwood')await ghostInput(page,device,point,tx,ty,prefix+'-regrown');else if(device==='desktop')await page.mouse.click(point.x,point.y);else await page.touchscreen.tap(point.x,point.y);
   const again=await snapshot(page,tx,ty);check(prefix+'-regrown-near-input',again.intent.kind==='chop'&&again.intent.tx===tx&&again.intent.ty===ty,again);
   await tick(page,1);const second=await snapshot(page,tx,ty);check(prefix+'-second-depletion',second.tile==='dirt'&&Number.isFinite(second.node?.depletedAtHour),second);
   await tick(page,3);await page.waitForTimeout(200);
   if(kind==='ghostwood'){
    await page.evaluate(({tx,ty})=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState();w.player.skills.forestry=80;w.player.pack.acorn=1;s.doVerb('sowAcorn',{kind:'tile',id:`${tx},${ty}`,tx,ty,label:'dirt'});},{tx,ty});
    row.ghostPlant=await snapshot(page,tx,ty);check(prefix+'-ghost-cannot-plant',row.ghostPlant.intent.kind!=='forest'&&row.ghostPlant.sapling===null&&String(row.ghostPlant.toast).includes('A ghost cannot'),row.ghostPlant);
    await ghostView(page,false);row.livingStump=await modelState(page,kind,tx,ty);
    if(row.livingStump)check(prefix+'-living-no-stump',row.livingStump.stump.length===0,row.livingStump);
   }
   // Do not invent a menu choice for species tied below the current chooser.
   row.plant=await page.evaluate(({kind,tx,ty,policy})=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState();w.player.workT=0;w.player.intent.kind='none';w.player.skills.forestry=policy.skill;w.player.pack.acorn=1;
    s.doVerb('sowAcorn',{kind:'tile',id:`${tx},${ty}`,tx,ty,label:'dirt'});const chooserIntent={...w.player.intent};
    if(!policy.ordinary){w.player.intent.kind='none';w.people[0].path=[];w.saplings.push({id:`qa-${kind}-sapling`,tx,ty,plantedHour:w.hour,stage:1,resourceId:kind});s.tick(.13);return {source:'saved-sapling-fixture',intent:null,chooserIntent};}
    return {source:'normal-sowAcorn-command',intent:{...w.player.intent},chooserIntent};
   },{kind,tx,ty,policy:plantPolicy[kind]});
   check(prefix+'-actual-plant-chooser',row.plant.chooserIntent.kind==='forest'&&row.plant.chooserIntent.targetId===plantPolicy[kind].selectedByChooser,row.plant);
   if(!plantPolicy[kind].ordinary)await tick(page,.05);
   if(plantPolicy[kind].ordinary){
    check(prefix+'-plant-command',row.plant.intent.kind==='forest'&&row.plant.intent.targetId===kind,row.plant);
    row.plantProgress=[];
    for(let elapsed=0;elapsed<8;elapsed+=.25){await tick(page,.25);const progress=await snapshot(page,tx,ty);row.plantProgress.push({elapsed:elapsed+.25,workT:progress.workT,intent:progress.intent,player:progress.player,hour:progress.hour,sapling:progress.sapling});if(progress.intent.kind!=='forest')break;}
   }
   await page.waitForTimeout(400);row.sapling=await snapshot(page,tx,ty);row.saplingModel=await modelState(page,kind,tx,ty);
   check(prefix+'-sapling-state',row.sapling.sapling?.stage===1&&row.sapling.sapling.resourceId===kind,row.sapling);
   if(row.saplingModel)check(prefix+'-sapling-no-stump',row.saplingModel.stump.length===0&&(mode!=='candidate'||row.saplingModel.young.length>0),row.saplingModel);
   // Let the just-completed planting effect expire on the world clock too.
   await tick(page,3);row.saplingAfterEffects=await snapshot(page,tx,ty);
   check(prefix+'-sapling-after-effects',row.saplingAfterEffects.sapling?.stage===1&&row.saplingAfterEffects.sapling.resourceId===kind,row.saplingAfterEffects);
   // Presentation-only observer reposition after assertions; normal camera is unchanged.
   await page.evaluate(({tx,ty})=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState();w.people[0].x=tx-2;w.people[0].z=ty+3;w.people[0].path=[];s.tick(.13);window.__ember.useGame.setState({toast:null});},{tx,ty});await page.waitForTimeout(500);
   await page.screenshot({path:path.join(out,prefix+'-sapling.png')});
   await page.evaluate(()=>{const w=window.__ember.getWorld();w.hour+=1.05;});await tick(page,.05);await page.waitForTimeout(300);row.young=await snapshot(page,tx,ty);row.youngModel=await modelState(page,kind,tx,ty);
   check(prefix+'-young-state',row.young.sapling?.stage===2&&row.young.sapling.resourceId===kind,row.young);
   if(mode==='candidate')check(prefix+'-young-model-growth',row.youngModel.young[0]?.scale[0]>row.saplingModel.young[0]?.scale[0],row.youngModel);
   await page.screenshot({path:path.join(out,prefix+'-young.png')});
   await page.evaluate(()=>{const w=window.__ember.getWorld();w.hour+=1;});await tick(page,.05);await page.waitForTimeout(400);row.mature=await snapshot(page,tx,ty);row.matureModel=await modelState(page,kind,tx,ty);
   check(prefix+'-mature-state',row.mature.tile==='tree'&&row.mature.planted===kind&&row.mature.sapling===null,row.mature);
   if(kind==='ghostwood'){
    if(row.matureModel)check(prefix+'-living-mature-hidden',row.matureModel.authored.length===0,row.matureModel);
    await page.screenshot({path:path.join(out,prefix+'-living-mature-hidden.png')});
    await ghostView(page,true);row.matureModel=await modelState(page,kind,tx,ty);
   }
   if(row.matureModel)check(prefix+'-mature-model',row.matureModel.young.length===0&&row.matureModel.stump.length===0&&(mode!=='candidate'||row.matureModel.authored.length===2),row.matureModel);
   await page.screenshot({path:path.join(out,prefix+'-mature.png')});
   report.cases.push(row);flush();console.log(mode,device,kind,'recorded');
  }
  await ctx.close();
 }
 if(mode==='failure')check('actual-per-device-species-rejections',species.every(k=>['desktop','mobile'].every(d=>report.requests.some(r=>r.injected&&r.device===d&&r.kind===k))),{requests:report.requests.filter(r=>r.injected)});
 const unexpected=report.errors.filter(e=>!(mode==='failure'&&e.type==='console'&&e.text.includes('503')));check('no-unexpected-errors',unexpected.length===0,{unexpected});
 check('exact-case-coverage',report.cases.length===species.length*2&&new Set(report.cases.map(c=>c.device+':'+c.kind)).size===species.length*2);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;}
finally{clearTimeout(watchdog);flush();await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,checks:report.checks.length,failure:report.failure,out}));
