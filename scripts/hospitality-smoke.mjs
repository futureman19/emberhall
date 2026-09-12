// Disposable hospitality baseline/candidate QA. node scripts/hospitality-smoke.mjs URL LABEL --baseline|--authored
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
const out=path.join(repo,'art/verification/hospitality',label);fs.mkdirSync(out,{recursive:true});
const result={url,label,authored,started:new Date().toISOString(),checks:[],errors:[],assets:[],screenshots:[],projections:[],measurements:[],scope:'Disposable fixture, exact target scene, desktop/mobile viewport emulation, not physical phone',releaseGate:'BLOCKED: existing 10/14 p95 comparison and 529 green / 12 baseline game failures remain unwaived'};
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
const record=(name,ok,evidence={})=>{result.checks.push({name,ok,...evidence});flush()};
const check=(name,ok,evidence={})=>{record(name,!!ok,evidence);assert(ok,name)};
let browser;
try {
const fixturePath=path.join(repo,'public/art/hospitality-review-save.json');
const original=JSON.parse(fs.readFileSync(path.join(repo,'public/art/settlement-review-save.json'),'utf8'));
const fixture=fs.existsSync(fixturePath)?JSON.parse(fs.readFileSync(fixturePath,'utf8')):structuredClone(original);
const positions=[['kitchen',247,302],['tavern',262,302],['market',254,303]];
const buildings=positions.map(([kind,tx,ty])=>{let b=fixture.buildings.find(b=>b.kind===kind&&Math.hypot(b.tx-256,b.ty-292)<=18);if(!b){b={id:'qa-hospitality-'+kind,kind,tx,ty,beds:[]};fixture.buildings.push(b)}return b});
fixture.hour=12;fixture.speed=0;fixture.player.skills.cooking=100;Object.assign(fixture.player.pack,{meat:8,wheat:8,cabbage:4,raw_fish:4});
const source=fs.readFileSync(path.join(repo,'src/game/building-size.ts'),'utf8');
const sizes=Object.fromEntries([...source.matchAll(/^\s*(\w+): \{ x0: (-?\d+), x1: (-?\d+), z0: (-?\d+), z1: (-?\d+) \}/gm)].map(m=>[m[1],m.slice(2).map(Number)]));
const vox=Number(source.match(/export const VOX = ([\d.]+)/)[1]);
const box=b=>{const s=sizes[b.kind];return{x0:b.tx+s[0]*vox,x1:b.tx+(s[1]+1)*vox,z0:b.ty+s[2]*vox,z1:b.ty+(s[3]+1)*vox}};
const collisions=[];for(const b of buildings)for(const other of fixture.buildings){if(b.id===other.id)continue;const a=box(b),q=box(other);if(a.x0<q.x1&&a.x1>q.x0&&a.z0<q.z1&&a.z1>q.z0)collisions.push([b.id,other.id])}
result.fixture={path:fixturePath,positions:buildings,adjustments:[],collisions,comparisonScope:'Each of three hospitality buildings against ALL saved buildings; existing unrelated overlaps not rewritten',stationContract:{kitchen:'fire',tavern:null,market:null},changes:['three missing local buildings','noon paused','cooking 100','ordinary meat wheat cabbage raw_fish; existing tools preserved']};
check('all-new-footprints-clear',collisions.length===0,{collisions});check('within-18-court',buildings.every(b=>Math.hypot(b.tx-256,b.ty-292)<=18));
check('approved-bank-forge-preserved',original.buildings.filter(b=>b.kind==='bank'||b.kind==='forge').every(b=>JSON.stringify(fixture.buildings.find(q=>q.id===b.id))===JSON.stringify(b)));
fs.writeFileSync(fixturePath,JSON.stringify(fixture));result.fixture.sha256=crypto.createHash('sha256').update(fs.readFileSync(fixturePath)).digest('hex');flush();
const {chromium}=await import('playwright');browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
const context=await browser.newContext({viewport:{width:1440,height:960}});await context.routeWebSocket(/.*/,()=>{});
const page=await context.newPage();page.setDefaultTimeout(12000);
page.on('pageerror',e=>{result.errors.push({kind:'pageerror',message:e.message});flush()});page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|GLSL|THREE/i.test(m.text())){result.errors.push({kind:'shader',message:m.text()});flush()}});
await page.addInitScript(s=>localStorage.setItem('emberhall-save-v4',s),JSON.stringify(fixture));await page.goto(url+'/?qa=1',{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing',null,{timeout:60000});await page.waitForSelector('canvas');await page.waitForLoadState('networkidle');
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
      if(!state) {
        const queue=[];for(let n=canvas;n;n=n.parentElement) {if(n.__r3f)queue.push(n.__r3f);for(const k of Object.keys(n))if(k.startsWith('__reactFiber'))queue.push(n[k]);}
        const seen=new Set();
        for(let i=0;i<queue.length && i<30000;i++) {const o=queue[i];if(!o || (typeof o!=='object' && typeof o!=='function') || seen.has(o))continue;seen.add(o);
          if(typeof o.getState==='function') {const s=o.getState();if(s?.camera && s?.scene && s?.gl?.domElement===canvas){state=s;method='target-bundle-react-r3f-ancestor';break;}}
          for(const k of ['child','sibling','return','stateNode','memoizedState','next','memoizedProps','__r3f','root','store','current','value','children','_currentValue','_currentValue2','containerInfo','props','dependencies','firstContext','memoizedValue','context'])if(o[k] && (typeof o[k]==='object'||typeof o[k]==='function'))queue.push(o[k]);
          if(Array.isArray(o))queue.push(...o.slice(0,100));
          if(o.memoizedState && typeof o.memoizedState==='object')for(const d of Object.values(Object.getOwnPropertyDescriptors(o.memoizedState)))if(d.value && typeof d.value==='object')queue.push(d.value);
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
      const authored=group.getObjectByName(`blender-${b.kind}-exterior`);
      return {found:true,uuid:group.uuid,authored:!!authored,visibleOriginal:meshes.filter(m=>m.visible && m.material.colorWrite && m.material.opacity>0).reduce((n,m)=>n+m.count,0),originalCount:meshes.reduce((n,m)=>n+m.count,0),meshIds:meshes.map(m=>m.uuid),points:points.sort((a,b)=>b.world[1]-a.world[1]).filter(p=>p.x>12 && p.x<rect.right-12 && p.y>65 && p.y<rect.bottom-12).filter((p,i)=>i%5===0).slice(0,30),camera:{position:camera.position.toArray(),projection:camera.projectionMatrix.toArray(),worldInverse:camera.matrixWorldInverse.toArray()},viewport:{width:rect.width,height:rect.height}};
    },b);
    const capture=async name=>{await settle();const cdp=await context.newCDPSession(page);const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await cdp.detach();fs.writeFileSync(path.join(out,`${name}.png`),Buffer.from(shot.data,'base64'));result.screenshots.push(`${name}.png`);flush();};
    const pick=async(b,name)=>{await clear();await settle();const s=await scene(b);check(`${name}-original-pick-candidates`,s.found && s.points.length>0,{scene:s});
      let picked=false;const attempts=[];
      for(const p of s.points.slice(0,15)){await page.mouse.click(p.x,p.y);await settle();const after=await state();attempts.push({point:p,selected:after.selected,openCraft:after.openCraft});if(b.kind==='bank'?/Pell/.test(after.selected??''):after.openCraft){picked=true;break;}}
      result.projections.push({name,...s});check(`${name}-mouse-pick`,picked,{attempts,method:'real mouse at original voxel instance centres'});
    };

const footing=await page.evaluate(async buildings=>{const w=window.__ember.getWorld();const local=['localhost','127.0.0.1'].includes(location.hostname);if(!local)return {available:false};const {walkable}=await import('/src/game/pathfinding.ts');const {buildingBox}=await import('/src/game/building-size.ts');return {available:true,buildings:buildings.map(b=>{const q=buildingBox(b.kind,b.tx,b.ty),tiles=[];for(let z=Math.floor(q.z0);z<=Math.floor(q.z1-1e-4);z++)for(let x=Math.floor(q.x0);x<=Math.floor(q.x1-1e-4);x++)tiles.push({x,z,kind:w.tiles[z]?.[x]?.kind,walkable:walkable(w,x,z)});return {id:b.id,tiles,approach:walkable(w,b.tx,b.ty+3)}})}} ,buildings);
check('real-world-walkable-floors-approaches',footing.available&&footing.buildings.every(b=>b.approach&&b.tiles.every(t=>t.walkable)),footing);
const metrics=async(device,b)=>{const m=await page.evaluate(()=>new Promise(resolve=>{const {gl}=window.__settlementQA.state;const values=[];const start=performance.now();let prev=start;function frame(now){values.push(now-prev);prev=now;if(values.length>=180||now-start>=10000){const sorted=[...values].sort((a,b)=>a-b),ctx=gl.getContext(),ext=ctx.getExtension('WEBGL_debug_renderer_info');resolve({frames:values.length,elapsedMs:now-start,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],drawCalls:gl.info.render.calls,triangles:gl.info.render.triangles,geometryCount:gl.info.memory.geometries,textures:gl.info.memory.textures,heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null,renderer:ext?ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL):ctx.getParameter(ctx.RENDERER)});}else requestAnimationFrame(frame)}requestAnimationFrame(frame)}));result.measurements.push({device,building:b.kind,...m});record(device+'-'+b.kind+'-bounded-frame-sample',m.frames===180,{measurement:m});};
for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
await page.setViewportSize(viewport);
for(const b of buildings){
await walk(device+'-'+b.kind+'-court-waypoint',[256,298]);
const outside=await page.evaluate(async b=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer);const {astar}=await import('/src/game/pathfinding.ts');for(const dz of [3,-3])for(const dx of [0,1,-1,2,-2]){const x=b.tx+dx,z=b.ty+dz,t=w.tiles[z]?.[x];if(t&&!['tree','rock','wall','water'].includes(t.kind)&&!w.plots.some(p=>p.tx===x&&p.ty===z)&&astar(w,Math.round(p.x),Math.round(p.z),x,z,9000))return [x,z]}throw Error('No safe useTile approach')},b);if(outside[0]!==b.tx)result.fixture.adjustments.push({building:b.kind,approach:outside,reason:'Centreline approach rejected by real A* (The way is closed); selected clear reachable tile; building unchanged'});await walk(device+'-'+b.kind+'-outside',outside);const exterior=await scene(b);
check(device+'-'+b.kind+'-exterior-contract',exterior.found&&(authored?exterior.authored:!exterior.authored),{scene:exterior});result.projections.push({name:device+'-'+b.kind,...exterior});flush();await capture(device+'-'+b.kind+'-outside');await metrics(device,b);
await walk(device+'-'+b.kind+'-entry',[b.tx,b.ty]);const interior=await scene(b);check(device+'-'+b.kind+'-cutaway',interior.found&&!interior.authored&&interior.visibleOriginal>0&&interior.originalCount<exterior.originalCount,{outside:exterior,inside:interior});await capture(device+'-'+b.kind+'-inside');
await walk(device+'-'+b.kind+'-exit',outside);const restored=await scene(b);check(device+'-'+b.kind+'-restored',restored.originalCount===exterior.originalCount&&restored.authored===exterior.authored,{scene:restored});await capture(device+'-'+b.kind+'-restored');
if(b.kind!=='kitchen'){await clear();const p=restored.points[0];check(device+'-'+b.kind+'-pointer-candidate',!!p);await page.mouse.click(p.x,p.y);await settle();const after=await state();check(device+'-'+b.kind+'-nonstation-pointer',!after.openCraft,{point:p,after,note:'Existing fall-through pointer behavior, no trade feature asserted'});}
}
const kitchen=buildings.find(b=>b.kind==='kitchen');await walk(device+'-kitchen-cook-approach',[kitchen.tx,kitchen.ty+3]);await pick(kitchen,device+'-kitchen');
const row=page.locator('li').filter({has:page.getByText('Roast meat',{exact:true})}),make=row.getByRole('button',{name:'Make',exact:true});await make.scrollIntoViewIfNeeded();check(device+'-cooking-enabled',await make.isEnabled());const before=await state();
await page.evaluate(()=>{window.__settlementQA.random=Math.random;Math.random=()=>.5});try{await make.click()}finally{await page.evaluate(()=>{Math.random=window.__settlementQA.random;delete window.__settlementQA.random})}await ticks();const after=await state();check(device+'-roast-meat-exact',after.pack.meat===before.pack.meat-1&&after.pack.cooked_meat===before.pack.cooked_meat+1,{before,after,random:'Explicit disposable synchronous .5 roll around real Make UI; restored'});await capture(device+'-kitchen-cooking');
}
check('six-balanced-measurements',result.measurements.length===6);check('no-page-shader-errors',result.errors.length===0,{errors:result.errors});result.status=result.checks.every(c=>c.ok)?'passed':'completed-with-failures';
if(!authored&&result.status==='passed'){fs.writeFileSync(path.join(repo,'art/verification/hospitality/baseline-ready.json'),JSON.stringify({status:'baseline-complete-before-integration',fixture:result.fixture,results:path.join(out,'results.json'),measurements:result.measurements,screenshots:result.screenshots,releaseGate:result.releaseGate,finished:new Date().toISOString()},null,2));}
if(result.status!=='passed')process.exitCode=1;
}catch(e){result.status='blocked-or-failed';result.failure={message:e.message,stack:e.stack};process.exitCode=1}finally{if(browser)await browser.close();result.finished=new Date().toISOString();flush();console.log(JSON.stringify({status:result.status,failure:result.failure?.message,measurements:result.measurements.length,checks:result.checks.map(({name,ok})=>({name,ok})),out},null,2))}
