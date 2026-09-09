// Disposable phase1 baseline/candidate QA. node scripts/commons-smoke.mjs URL LABEL --baseline|--authored
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith('--'));

const url = positional[0] ?? 'http://127.0.0.1:8093';
const label = positional[1] ?? 'baseline';
assert.match(label, /^[a-zA-Z0-9_-]+$/, 'label must be a safe filename');
const authored=args.includes('--authored');
assert(!(authored&&args.includes('--baseline')));
const out=path.join(repo,'art/verification/phase1',label);assert(!fs.existsSync(path.join(out,'results.json')),'Use a new label; failed attempts are retained');fs.mkdirSync(out,{recursive:true});
const result={url,label,authored,started:new Date().toISOString(),checks:[],errors:[],assets:[],screenshots:[],projections:[],measurements:[],scope:'Disposable fixture, exact target scene, desktop/mobile viewport emulation, not physical phone',releaseGate:'Prior global and hospitality performance acceptance remains unresolved; exact full-suite baseline script failures are tracked by parent gate evidence.'};
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
const record=(name,ok,evidence={})=>{result.checks.push({name,ok,...evidence});flush()};
const check=(name,ok,evidence={})=>{record(name,!!ok,evidence);assert(ok,name)};
let browser;const watchdog=setTimeout(()=>{result.status='timeout';flush();browser?.close();},420000);
try {
const fixturePath=path.join(repo,'public/art/phase1-review-save.json');
const original=JSON.parse(fs.readFileSync(path.join(repo,'public/art/commons-review-save.json'),'utf8'));
let fixture=structuredClone(original);
const kinds=['hall','dormitory','kitchen','yard','market','forge','tavern','notice','board','farm','bank'];
result.source={building:crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,'src/components/game/building-meshes.tsx'))).digest('hex')};
result.mechanics={notice:'Original nonstation pointer fall-through; no quest UI invented',board:'Original nonstation pointer fall-through; no board UI invented',yard:'Existing bench UI, not training',dormitory:'Original unassigned beds; no sleep UI',farm:'No synthetic crops/resources or harvest proof'};
const {chromium}=await import('playwright');browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
const context=await browser.newContext({viewport:{width:1440,height:960}});await context.routeWebSocket(/.*/,()=>{});
const page=await context.newPage();page.setDefaultTimeout(12000);
page.on('pageerror',e=>{result.errors.push({kind:'pageerror',message:e.message});flush()});page.on('console',m=>{if(m.type()==='error'){result.errors.push({kind:'console',message:m.text()});flush()}});
await page.addInitScript(s=>{if(!localStorage.getItem('emberhall-save-v4'))localStorage.setItem('emberhall-save-v4',s)},JSON.stringify(fixture));await page.goto(url+'/?qa=1',{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing',null,{timeout:60000});await page.waitForSelector('canvas');await page.waitForLoadState('networkidle');
const placement=await page.evaluate(async()=>{
 const w=window.__ember.getWorld();const {buildingBox,boxesOverlap}=await import('/src/game/building-size.ts'); const {walkable}=await import('/src/game/pathfinding.ts');const added=[],checks=[];
 if(!w.buildings.some(b=>b.kind==='board'))for(let z=288;z<310&&!added.length;z++)for(let x=265;x<277&&!added.length;x++){
 const box=buildingBox('board',x,z);if(w.buildings.some(b=>boxesOverlap(box,buildingBox(b.kind,b.tx,b.ty))))continue;const tiles=[];
 for(let zz=Math.floor(box.z0);zz<=Math.floor(box.z1-1e-4);zz++)for(let xx=Math.floor(box.x0);xx<=Math.floor(box.x1-1e-4);xx++)tiles.push({x:xx,z:zz,kind:w.tiles[zz]?.[xx]?.kind,walkable:walkable(w,xx,zz)});
 if(!tiles.every(t=>t.walkable&&!['water','wall','pit','tree','rock'].includes(t.kind)))continue;
 added.push({id:'qa-phase1-board',kind:'board',tx:x,ty:z,beds:[]});checks.push({box,tiles});}
 return {added,checks};});
fixture.buildings.push(...placement.added);
const buildings=kinds.map(k=>fixture.buildings.filter(b=>b.kind===k).sort((a,b)=>Math.hypot(a.tx-256,a.ty-292)-Math.hypot(b.tx-256,b.ty-292))[0]);
check('all-11-kinds',buildings.length===11&&buildings.every(Boolean));
check('55-original-records-preserved',original.buildings.length===55&&original.buildings.every(b=>JSON.stringify(fixture.buildings.find(q=>q.id===b.id))===JSON.stringify(b)));
check('nonbuilding-records-preserved',Object.keys(original).filter(k=>k!=='buildings').every(k=>JSON.stringify(original[k])===JSON.stringify(fixture[k])));
if(authored)check('candidate-fixture-identical',fs.readFileSync(fixturePath,'utf8')===JSON.stringify(fixture));else fs.writeFileSync(fixturePath,JSON.stringify(fixture));
result.fixture={path:fixturePath,positions:buildings,placement,adjustments:[],sha256:crypto.createHash('sha256').update(JSON.stringify(fixture)).digest('hex')};
result.coverage=buildings.map(b=>({kind:b.kind,id:b.id,position:[b.tx,b.ty],states:[],mechanic:result.mechanics[b.kind]??'Existing station or original fall-through; no new mechanic asserted'}));flush();
await page.evaluate(s=>localStorage.setItem('emberhall-save-v4',s),JSON.stringify(fixture));await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing');await page.waitForLoadState('networkidle');
    // Import exactly the Fiber URL used by the local renderer (including Vite hash).
    // Production falls back to its own React/R3F objects; never import local game code into live.
    const sceneAccess=await page.evaluate(async()=>{
      const canvas=document.querySelector('canvas'); let state; let method;
      if (['localhost','127.0.0.1'].includes(location.hostname)) {
        const response=await fetch('/src/components/game/world-scene.tsx');
        if(response.ok) {
          const src=await response.text(); const match=src.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);
          if(match) {const fiber=await import(match[1]);state=fiber._roots?.get(canvas)?.store?.getState();if(state) method='exact-local-fiber-_roots:'+match[1];}
        }
      }
      if(!state)return {available:false,reason:'No exact target scene/camera. Cannot claim local or live cutaway proof.'};
      window.__settlementQA={state};return {available:true,method,camera:state.camera.type};
    });
    check('exact-target-scene-camera',sceneAccess.available,sceneAccess);
    const settle=()=>page.waitForTimeout(500);
    const state=()=>page.evaluate(()=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);return {position:[p.x,p.z],path:p.path,selectedId:s.selectedId,selected:w.people.find(p=>p.id===s.selectedId)?.name,openCraft:s.openCraft,gold:w.gold,vault:w.player.vault,pack:structuredClone(w.player.pack),chest:structuredClone(w.player.chest),resources:structuredClone(w.player.resources.stacks),toast:s.toast};});
    const clear=()=>page.evaluate(()=>{const s=window.__ember.useGame.getState();s.select(null);s.closeCraft();s.setPanel('none');});

    const walk=async(name,target)=>{await clear();await page.evaluate(t=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer);p.x=t[0];p.z=t[1];p.path=[];w.hour=12;Object.assign(w.weather,{kind:'clear',cloud:.06,wet:0,wind:.12,untilHour:99999,douseHour:0});const s=window.__ember.useGame.getState();s.speed(0);s.tick(0)},target);await settle();const after=await state();check(name,Math.hypot(after.position[0]-target[0],after.position[1]-target[1])<.35,{target,after,method:'explicit-dev-position-state-setup-NOT-walking-proof'});};
    const scene=async b=>page.evaluate(b=>{
      const {scene,camera,gl}=window.__settlementQA.state;scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
      const rect=gl.domElement.getBoundingClientRect();let group;
      // Original BlockLayer instance matrices are world-space, under identity groups.
      scene.traverse(o=>{if(group || !o.isGroup || !o.__r3f?.handlers?.onPointerDown)return;
        const meshes=o.children.filter(c=>c.isInstancedMesh);if(!meshes.length)return;
        const m=meshes[0],mat=m.matrix.clone();m.getMatrixAt(0,mat);const p=m.position.clone().setFromMatrixPosition(mat).applyMatrix4(m.matrixWorld);
        if(p.x>=b.tx-3 && p.x<=b.tx+3 && p.z>=b.ty-3 && p.z<=b.ty+3)group=o;
      });
      if(!group)return {found:false};
      const meshes=group.children.filter(c=>c.isInstancedMesh),points=[];
      for(const mesh of meshes)for(let i=0;i<mesh.count;i++) {const mat=mesh.matrix.clone();mesh.getMatrixAt(i,mat);const p=mesh.position.clone().setFromMatrixPosition(mat).applyMatrix4(mesh.matrixWorld);const projected=p.clone().project(camera);points.push({x:rect.left+(projected.x+1)*rect.width/2,y:rect.top+(1-projected.y)*rect.height/2,world:[p.x,p.y,p.z],uuid:mesh.uuid,instance:i});}
      const names=[];group.traverse(o=>{if(o.name)names.push(o.name)});const authored=names.some(n=>/blender/.test(n));
      return {found:true,uuid:group.uuid,authored:!!authored,names,visibleOriginal:meshes.filter(m=>m.visible && m.material.colorWrite && m.material.opacity>0).reduce((n,m)=>n+m.count,0),originalCount:meshes.reduce((n,m)=>n+m.count,0),meshIds:meshes.map(m=>m.uuid),points:points.sort((a,b)=>b.world[1]-a.world[1]).filter(p=>p.x>12 && p.x<rect.right-12 && p.y>65 && p.y<rect.bottom-12).filter((p,i)=>i%5===0).slice(0,30),camera:{position:camera.position.toArray(),projection:camera.projectionMatrix.toArray(),worldInverse:camera.matrixWorldInverse.toArray()},viewport:{width:rect.width,height:rect.height}};
    },b);
    const capture=async name=>{await settle();const cdp=await context.newCDPSession(page);const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await cdp.detach();fs.writeFileSync(path.join(out,`${name}.png`),Buffer.from(shot.data,'base64'));result.screenshots.push(`${name}.png`);flush();};
const metrics=async(device,b)=>{await page.evaluate(()=>{const w=window.__ember.getWorld();w.hour=12;Object.assign(w.weather,{kind:'clear',cloud:.06,wet:0,wind:.12,untilHour:99999,douseHour:0});window.__ember.useGame.getState().speed(0);window.__ember.useGame.getState().tick(0)});await settle();const m=await page.evaluate(()=>new Promise(resolve=>{const {gl}=window.__settlementQA.state;const values=[];const start=performance.now();let prev=start;function frame(now){values.push(now-prev);prev=now;if(values.length>=180||now-start>=30000){const sorted=[...values].sort((a,b)=>a-b),ctx=gl.getContext(),ext=ctx.getExtension('WEBGL_debug_renderer_info');resolve({frames:values.length,elapsedMs:now-start,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],drawCalls:gl.info.render.calls,triangles:gl.info.render.triangles,geometryCount:gl.info.memory.geometries,textures:gl.info.memory.textures,heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null,renderer:ext?ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL):ctx.getParameter(ctx.RENDERER)});}else requestAnimationFrame(frame)}requestAnimationFrame(frame)}));result.measurements.push({device,building:b.kind,...m});record(device+'-'+b.kind+'-bounded-frame-sample',m.frames===180,{measurement:m});};
for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
await page.setViewportSize(viewport);
for(const b of buildings){

const outside=await page.evaluate(async b=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer);const {astar}=await import('/src/game/pathfinding.ts');for(const dz of [3,-3])for(const dx of [0,1,-1,2,-2]){const x=b.tx+dx,z=b.ty+dz,t=w.tiles[z]?.[x];if(t&&!['tree','rock','wall','water'].includes(t.kind)&&!w.plots.some(p=>p.tx===x&&p.ty===z)&&astar(w,Math.round(p.x),Math.round(p.z),x,z,9000))return [x,z]}throw Error('No safe useTile approach')},b);if(outside[0]!==b.tx)result.fixture.adjustments.push({building:b.kind,approach:outside,reason:'Centreline approach rejected by real A* (The way is closed); selected clear reachable tile; building unchanged'});await walk(device+'-'+b.kind+'-outside',outside);const exterior=await scene(b);
check(device+'-'+b.kind+'-exterior-contract',exterior.found,{scene:exterior});result.projections.push({name:device+'-'+b.kind,source:exterior,...exterior});flush();await capture(device+'-'+b.kind+'-outside');if(['notice','board'].includes(b.kind))await metrics(device,{kind:b.kind+'-exterior'});
await walk(device+'-'+b.kind+'-entry',[b.tx,b.ty]);const interior=await scene(b);check(device+'-'+b.kind+'-cutaway',interior.found&&(['notice','board'].includes(b.kind)?interior.originalCount>0:interior.visibleOriginal>0),{outside:exterior,inside:interior});await capture(device+'-'+b.kind+'-inside');if(['hall','dormitory','kitchen','forge','bank'].includes(b.kind))await metrics(device,{kind:b.kind+'-interior'});result.coverage.find(q=>q.kind===b.kind).states.push({device,exterior,interior});flush();
await walk(device+'-'+b.kind+'-exit',outside);const restored=await scene(b);check(device+'-'+b.kind+'-restored',restored.originalCount===exterior.originalCount&&restored.authored===exterior.authored,{scene:restored});await capture(device+'-'+b.kind+'-restored');
await clear();await settle();const candidates=await scene(b);
await page.evaluate(uuid=>{let g;window.__settlementQA.state.scene.traverse(o=>{if(o.uuid===uuid)g=o});const old=g.__r3f.handlers.onPointerDown;window.__commonsPointer={hits:0,old,g};g.__r3f.handlers.onPointerDown=e=>{window.__commonsPointer.hits++;return old(e)};},candidates.uuid);
let hit=false;const attempts=[];for(const point of candidates.points.slice(0,15)){await page.mouse.click(point.x,point.y);await settle();const count=await page.evaluate(()=>window.__commonsPointer.hits);attempts.push({point,count});if(count){hit=true;break;}}
await page.evaluate(()=>{const q=window.__commonsPointer;q.g.__r3f.handlers.onPointerDown=q.old});check(device+'-'+b.kind+'-real-original-proxy-pointer',hit,{attempts});
const interaction=await state();check(device+'-'+b.kind+'-existing-interaction',['hall','yard','forge','kitchen'].includes(b.kind)?!!interaction.openCraft:b.kind==='bank'?/Pell/.test(interaction.selected??''):!interaction.openCraft,{interaction,contract:result.mechanics[b.kind]});await capture(device+'-'+b.kind+'-interaction');await clear();
}
}
fs.writeFileSync(path.join(repo,'art/PHASE1-COVERAGE.json'),JSON.stringify({status:'captured-pending-gates',coverage:result.coverage,measurements:result.measurements},null,2));
check('14-balanced-measurements',result.measurements.length===14&&result.measurements.every(m=>m.frames===180));
check('11-kinds-both-devices',result.coverage.length===11&&result.coverage.every(c=>c.states.length===2));
if(authored){const contractPath=path.join(repo,'art/verification/phase1/candidate-contract.json');check('candidate-contract-present',fs.existsSync(contractPath));const contract=JSON.parse(fs.readFileSync(contractPath));for(const c of result.coverage)for(const st of c.states)for(const mode of ['exterior','interior']){const expected=contract[c.kind]?.[mode];check(`${st.device}-${c.kind}-${mode}-contract-defined`,Array.isArray(expected));for(const name of expected)check(`${st.device}-${c.kind}-${mode}-${name}`,st[mode].names.includes(name));}}
check('no-page-console-shader-errors',result.errors.length===0,{errors:result.errors});result.status=result.checks.every(c=>c.ok)?'passed':'completed-with-failures';
fs.writeFileSync(path.join(repo,'art/PHASE1-COVERAGE.json'),JSON.stringify({status:result.status,authored,source:result.source,fixture:result.fixture,coverage:result.coverage,measurements:result.measurements,results:path.join(out,'results.json')},null,2));
if(!authored&&result.status==='passed'){fs.writeFileSync(path.join(repo,'art/verification/phase1/baseline-ready.json'),JSON.stringify({status:'passed',fixture:result.fixture,results:path.join(out,'results.json'),measurements:result.measurements,screenshots:result.screenshots,releaseGate:result.releaseGate,finished:new Date().toISOString()},null,2));}
if(result.status!=='passed')process.exitCode=1;
}catch(e){result.status='blocked-or-failed';result.failure={message:e.message,stack:e.stack};process.exitCode=1}finally{clearTimeout(watchdog);if(browser)await browser.close();result.finished=new Date().toISOString();flush();console.log(JSON.stringify({status:result.status,failure:result.failure?.message,measurements:result.measurements.length,checks:result.checks.map(({name,ok})=>({name,ok})),out},null,2))}
