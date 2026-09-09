// Disposable commons baseline/candidate QA. node scripts/commons-smoke.mjs URL LABEL --baseline|--authored
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
const out=path.join(repo,'art/verification/commons',label);assert(!fs.existsSync(path.join(out,'results.json')),'Use a new label; failed attempts are retained');fs.mkdirSync(out,{recursive:true});
const result={url,label,authored,started:new Date().toISOString(),checks:[],errors:[],assets:[],screenshots:[],projections:[],measurements:[],scope:'Disposable fixture, exact target scene, desktop/mobile viewport emulation, not physical phone',releaseGate:'Prior global and hospitality performance acceptance remains unresolved; exact full-suite baseline script failures are tracked by parent gate evidence.'};
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
const record=(name,ok,evidence={})=>{result.checks.push({name,ok,...evidence});flush()};
const check=(name,ok,evidence={})=>{record(name,!!ok,evidence);assert(ok,name)};
let browser;const watchdog=setTimeout(()=>{result.status='timeout';flush();browser?.close();},240000);
try {
const fixturePath=path.join(repo,'public/art/commons-review-save.json');
const original=JSON.parse(fs.readFileSync(path.join(repo,'public/art/hospitality-review-save.json'),'utf8'));
let fixture=structuredClone(original), buildings;
result.mechanics={yard:'Existing bench station UI, not training UI',dormitory:'Original two unassigned beds; no rest UI asserted',farm:'No synthetic plots, items, resources or plant/harvest proof; preserve baseline plots'};
const {chromium}=await import('playwright');browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
const context=await browser.newContext({viewport:{width:1440,height:960}});await context.routeWebSocket(/.*/,()=>{});
const page=await context.newPage();page.setDefaultTimeout(12000);
page.on('pageerror',e=>{result.errors.push({kind:'pageerror',message:e.message});flush()});page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|GLSL|THREE/i.test(m.text())){result.errors.push({kind:'shader',message:m.text()});flush()}});
await page.addInitScript(s=>{if(!localStorage.getItem('emberhall-save-v4'))localStorage.setItem('emberhall-save-v4',s)},JSON.stringify(fixture));await page.goto(url+'/?qa=1',{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing',null,{timeout:60000});await page.waitForSelector('canvas');await page.waitForLoadState('networkidle');
const placement=await page.evaluate(async()=>{
 const w=window.__ember.getWorld();const {buildingBox,boxesOverlap}=await import('/src/game/building-size.ts'); const {walkable}=await import('/src/game/pathfinding.ts');
 const added=[],checks=[];const selected=[w.buildings.find(b=>b.kind==='yard'&&b.tx===248&&b.ty===291)];if(!selected[0])throw Error('Missing original yard');
 for(const [kind,tx,ty] of [['dormitory',266,285],['farm',268,304]]){
 const candidates=[];for(let z=274;z<=310;z++)for(let x=238;x<=274;x++)if(Math.hypot(x-256,z-292)<=18)candidates.push([x,z]);candidates.sort((a,b)=>Math.hypot(a[0]-tx,a[1]-ty)-Math.hypot(b[0]-tx,b[1]-ty)||a[1]-b[1]||a[0]-b[0]);
 let found;for(const [x,z] of candidates){const box=buildingBox(kind,x,z);if([...w.buildings,...added].some(b=>boxesOverlap(box,buildingBox(b.kind,b.tx,b.ty))))continue;
 const tiles=[];for(let zz=Math.floor(box.z0);zz<=Math.floor(box.z1-1e-4);zz++)for(let xx=Math.floor(box.x0);xx<=Math.floor(box.x1-1e-4);xx++)tiles.push({x:xx,z:zz,kind:w.tiles[zz]?.[xx]?.kind,walkable:walkable(w,xx,zz)});
 if(!tiles.every(t=>t.walkable&&!['water','wall','pit','tree','rock'].includes(t.kind)))continue;
 found={id:'qa-commons-'+kind,kind,tx:x,ty:z,beds:kind==='dormitory'?[{occupantId:null},{occupantId:null}]:[]};checks.push({kind,box,tiles});break;}
 if(!found)throw Error('No clear fit '+kind);added.push(found);selected.push(found);}
 return {added,selected,checks};
},original);
fixture.buildings.push(...placement.added);buildings=['dormitory','yard','farm'].map(k=>placement.selected.find(b=>b.kind===k));
check('all-53-original-building-records-unchanged',original.buildings.length===53&&original.buildings.every(b=>JSON.stringify(fixture.buildings.find(q=>q.id===b.id))===JSON.stringify(b)));
check('all-nonbuilding-save-records-unchanged',Object.keys(original).filter(k=>k!=='buildings').every(k=>JSON.stringify(original[k])===JSON.stringify(fixture[k])));
check('55-buildings-one-original-yard',fixture.buildings.length===55&&fixture.buildings.filter(b=>b.kind==='yard').length===1);
result.fixture={path:fixturePath,positions:buildings,adjustments:[],placement,changes:['two disposable buildings only; dorm beds exactly world.ts placeBuilding definition'],sha256:null};
if(authored){check('candidate-fixture-identical',fs.readFileSync(fixturePath,'utf8')===JSON.stringify(fixture));}else fs.writeFileSync(fixturePath,JSON.stringify(fixture));result.fixture.sha256=crypto.createHash('sha256').update(fs.readFileSync(fixturePath)).digest('hex');flush();
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
    const ticks=async()=>{await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(1);for(let i=0;i<240;i++)s.tick(.05);s.speed(0);});await settle();};
    const walk=async(name,target)=>{await clear();const before=await state();await page.evaluate(t=>window.__ember.useGame.getState().useTile(...t),target);const intent=await state();result.lastWalkIntent={name,target,intent};flush();await ticks();const after=await state();check(name,Math.hypot(after.position[0]-target[0],after.position[1]-target[1])<.35,{target,before,after,method:'simulation-useTile-240x.05-not-pointer'});};
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
      let authored;group.traverse(o=>{if(o.name.includes(b.kind)&&/commons|blender/.test(o.name))authored=o});
      return {found:true,uuid:group.uuid,authored:!!authored,visibleOriginal:meshes.filter(m=>m.visible && m.material.colorWrite && m.material.opacity>0).reduce((n,m)=>n+m.count,0),originalCount:meshes.reduce((n,m)=>n+m.count,0),meshIds:meshes.map(m=>m.uuid),points:points.sort((a,b)=>b.world[1]-a.world[1]).filter(p=>p.x>12 && p.x<rect.right-12 && p.y>65 && p.y<rect.bottom-12).filter((p,i)=>i%5===0).slice(0,30),camera:{position:camera.position.toArray(),projection:camera.projectionMatrix.toArray(),worldInverse:camera.matrixWorldInverse.toArray()},viewport:{width:rect.width,height:rect.height}};
    },b);
    const capture=async name=>{await settle();const cdp=await context.newCDPSession(page);const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await cdp.detach();fs.writeFileSync(path.join(out,`${name}.png`),Buffer.from(shot.data,'base64'));result.screenshots.push(`${name}.png`);flush();};
const footing=await page.evaluate(async buildings=>{const w=window.__ember.getWorld();const local=['localhost','127.0.0.1'].includes(location.hostname);if(!local)return {available:false};const {walkable}=await import('/src/game/pathfinding.ts');const {buildingBox}=await import('/src/game/building-size.ts');return {available:true,buildings:buildings.map(b=>{const q=buildingBox(b.kind,b.tx,b.ty),tiles=[];for(let z=Math.floor(q.z0);z<=Math.floor(q.z1-1e-4);z++)for(let x=Math.floor(q.x0);x<=Math.floor(q.x1-1e-4);x++)tiles.push({x,z,kind:w.tiles[z]?.[x]?.kind,walkable:walkable(w,x,z)});return {id:b.id,tiles,approach:walkable(w,b.tx,b.ty+3)}})}} ,buildings);
check('real-world-walkable-floors-approaches',footing.available&&footing.buildings.every(b=>b.approach&&b.tiles.every(t=>t.walkable)),footing);
const metrics=async(device,b)=>{await page.evaluate(()=>{const w=window.__ember.getWorld();w.hour=12;Object.assign(w.weather,{kind:'clear',cloud:.06,wet:0,wind:.12,untilHour:99999,douseHour:0});window.__ember.useGame.getState().speed(0);window.__ember.useGame.getState().tick(0)});await settle();const m=await page.evaluate(()=>new Promise(resolve=>{const {gl}=window.__settlementQA.state;const values=[];const start=performance.now();let prev=start;function frame(now){values.push(now-prev);prev=now;if(values.length>=180||now-start>=10000){const sorted=[...values].sort((a,b)=>a-b),ctx=gl.getContext(),ext=ctx.getExtension('WEBGL_debug_renderer_info');resolve({frames:values.length,elapsedMs:now-start,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],drawCalls:gl.info.render.calls,triangles:gl.info.render.triangles,geometryCount:gl.info.memory.geometries,textures:gl.info.memory.textures,heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null,renderer:ext?ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL):ctx.getParameter(ctx.RENDERER)});}else requestAnimationFrame(frame)}requestAnimationFrame(frame)}));result.measurements.push({device,building:b.kind,...m});record(device+'-'+b.kind+'-bounded-frame-sample',m.frames===180,{measurement:m});};
for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
await page.setViewportSize(viewport);
for(const b of buildings){
await walk(device+'-'+b.kind+'-court-waypoint',[256,298]);
const outside=await page.evaluate(async b=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer);const {astar}=await import('/src/game/pathfinding.ts');for(const dz of [3,-3])for(const dx of [0,1,-1,2,-2]){const x=b.tx+dx,z=b.ty+dz,t=w.tiles[z]?.[x];if(t&&!['tree','rock','wall','water'].includes(t.kind)&&!w.plots.some(p=>p.tx===x&&p.ty===z)&&astar(w,Math.round(p.x),Math.round(p.z),x,z,9000))return [x,z]}throw Error('No safe useTile approach')},b);if(outside[0]!==b.tx)result.fixture.adjustments.push({building:b.kind,approach:outside,reason:'Centreline approach rejected by real A* (The way is closed); selected clear reachable tile; building unchanged'});await walk(device+'-'+b.kind+'-outside',outside);const exterior=await scene(b);
check(device+'-'+b.kind+'-exterior-contract',exterior.found&&(authored?exterior.authored:!exterior.authored),{scene:exterior});result.projections.push({name:device+'-'+b.kind,source:exterior,...exterior});flush();await capture(device+'-'+b.kind+'-outside');await metrics(device,b);
await walk(device+'-'+b.kind+'-entry',[b.tx,b.ty]);const interior=await scene(b);check(device+'-'+b.kind+'-cutaway',interior.found&&interior.visibleOriginal>0&&(b.kind==='dormitory'?(!interior.authored&&interior.originalCount<exterior.originalCount):(interior.authored===exterior.authored&&interior.originalCount===exterior.originalCount)),{outside:exterior,inside:interior});await capture(device+'-'+b.kind+'-inside');
await walk(device+'-'+b.kind+'-exit',outside);const restored=await scene(b);check(device+'-'+b.kind+'-restored',restored.originalCount===exterior.originalCount&&restored.authored===exterior.authored,{scene:restored});await capture(device+'-'+b.kind+'-restored');
await clear();await settle();const candidates=await scene(b);
await page.evaluate(uuid=>{let g;window.__settlementQA.state.scene.traverse(o=>{if(o.uuid===uuid)g=o});const old=g.__r3f.handlers.onPointerDown;window.__commonsPointer={hits:0,old,g};g.__r3f.handlers.onPointerDown=e=>{window.__commonsPointer.hits++;return old(e)};},candidates.uuid);
let hit=false;const attempts=[];for(const point of candidates.points.slice(0,15)){await page.mouse.click(point.x,point.y);await settle();const count=await page.evaluate(()=>window.__commonsPointer.hits);attempts.push({point,count});if(count){hit=true;break;}}
await page.evaluate(()=>{const q=window.__commonsPointer;q.g.__r3f.handlers.onPointerDown=q.old});check(device+'-'+b.kind+'-real-original-proxy-pointer',hit,{attempts});
const interaction=await state();check(device+'-'+b.kind+'-existing-interaction',b.kind==='yard'?!!interaction.openCraft:!interaction.openCraft,{interaction,contract:result.mechanics[b.kind]});await capture(device+'-'+b.kind+'-interaction');await clear();
}
}
check('six-balanced-measurements',result.measurements.length===6&&result.measurements.every(m=>m.frames===180&&/RTX 4060/.test(m.renderer)));
if(authored){const base=JSON.parse(fs.readFileSync(path.join(repo,'art/verification/commons/baseline-ready.json')));for(const m of result.measurements){const b=base.measurements.find(q=>q.device===m.device&&q.building===m.building);check(m.device+'-'+m.building+'-relative-performance',m.p95Ms<=b.p95Ms*1.2&&m.drawCalls<=Math.ceil(b.drawCalls*1.1)&&m.triangles<=Math.ceil(b.triangles*1.15)&&m.geometryCount<=Math.ceil(b.geometryCount*1.1)&&m.heap.used<=Math.ceil(b.heap.used*1.2),{baseline:b,candidate:m,ceilings:{p95:1.2,calls:1.1,triangles:1.15,geometry:1.1,heap:1.2}})}}check('no-page-shader-errors',result.errors.length===0,{errors:result.errors});result.status=result.checks.every(c=>c.ok)?'passed':'completed-with-failures';
if(!authored&&result.status==='passed'){fs.writeFileSync(path.join(repo,'art/verification/commons/baseline-ready.json'),JSON.stringify({status:'passed',fixture:result.fixture,results:path.join(out,'results.json'),measurements:result.measurements,screenshots:result.screenshots,releaseGate:result.releaseGate,finished:new Date().toISOString()},null,2));}
if(result.status!=='passed')process.exitCode=1;
}catch(e){result.status='blocked-or-failed';result.failure={message:e.message,stack:e.stack};process.exitCode=1}finally{clearTimeout(watchdog);if(browser)await browser.close();result.finished=new Date().toISOString();flush();console.log(JSON.stringify({status:result.status,failure:result.failure?.message,measurements:result.measurements.length,checks:result.checks.map(({name,ok})=>({name,ok})),out},null,2))}
