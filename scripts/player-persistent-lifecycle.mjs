import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const red=process.argv.includes('--red');const out='art/verification/civic/player-persistent-lifecycle-'+(red?'red':'green');fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(out+'/results.json'));
const result={scope:'Persistent overlay lifecycle diagnostic; full depth pass, not production integration/performance acceptance. Disposable local save and QA state transitions.',checks:[],errors:[]};
const save=()=>fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2));
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
try {
for(const device of ['desktop','mobile']) {
const viewport=device==='desktop'?{width:1440,height:960}:{width:390,height:844};
const context=await browser.newContext({viewport,hasTouch:device==='mobile'});await context.routeWebSocket(/.*/,()=>{});
const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|GLSL|THREE/.test(m.text()))result.errors.push(m.text())});
await page.addInitScript(s=>localStorage.setItem('emberhall-save-v4',s),fs.readFileSync('public/art/phase1-review-save.json','utf8'));
await page.goto('http://127.0.0.1:8093/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__emberCamera&&window.__ember?.useGame.getState().phase==='playing');
await page.evaluate(()=>{const s=window.__ember.useGame.getState(),p=window.__ember.getWorld().people.find(p=>p.isPlayer);s.speed(0);p.x=256;p.z=298;p.path=[];s.setPanel('none');s.select(null);s.tick(0)});await page.waitForTimeout(8500);

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

assert(sceneAccess.available);

await page.evaluate(async ({moduleSource,red})=>{
 const source=await(await fetch('/src/components/game/terrain.tsx')).text();
 const match=source.match(/from\s+["']([^"']*\/three\.js[^"']*)["']/);if(!match)throw Error('Exact Three module missing');
 const T=await import(match[1]);
 const module=await import('data:text/javascript;base64,'+btoa(moduleSource));
 window.__persistent=module.installOverlay(T,window.__settlementQA.state,()=>window.__ember.getWorld(),{sync:!red});
 window.__persistentT=T;
},{moduleSource:fs.readFileSync('scripts/player-persistent-overlay-prototype.mjs','utf8'),red});
await page.waitForTimeout(500);
const initial=await page.evaluate(()=>window.__persistent.snapshot());
assert(initial.copies>0);
await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.useTile(262,302);s.speed(1)});
await page.waitForFunction(()=>{const p=window.__ember.getWorld().people.find(p=>p.isPlayer);return Math.hypot(p.x-262,p.z-302)<0.2},{},{timeout:20000});
const moving=await page.evaluate(()=>window.__persistent.snapshot());
result.checks.push({device,id:'continuous-transform-sync',frames:moving.frames-initial.frames,mismatches:moving.mismatches,passed:moving.frames>initial.frames+10&&moving.mismatches===0});
result.checks.push({device,id:'persistent-copy-reuse',passed:initial.ids.some(id=>moving.ids.includes(id))});
await page.evaluate(()=>window.__ember.useGame.getState().speed(0));
await page.screenshot({path:out+'/'+device+'-persistent.png'});
for(const mode of ['ghost','invisible','hidden','detached']) {
 const evidence=await page.evaluate(async mode=>{
  const world=window.__ember.getWorld(),p=world.people.find(p=>p.isPlayer);
  const {scene,camera,gl}=window.__settlementQA.state;
  const figure=scene.getObjectByName('emberhall-player-figure'),parent=figure.parent;
  const oldGhost=p.ghost,oldInvis=world.player.invisUntil,oldVisible=figure.visible;
  if(mode==='ghost')p.ghost=true;
  if(mode==='invisible')world.player.invisUntil=world.hour+1;
  if(mode==='hidden')figure.visible=false;
  if(mode==='detached')parent.remove(figure);
  gl.render(scene,camera);
  const hidden=window.__persistent.snapshot();
  const candidate=gl.domElement.toDataURL();
  window.__persistent.originalRender.call(gl,scene,camera);
  const pixelsEqual=candidate===gl.domElement.toDataURL();
  p.ghost=oldGhost;world.player.invisUntil=oldInvis;figure.visible=oldVisible;
  if(mode==='detached')parent.add(figure);
  gl.render(scene,camera);
  const restored=window.__persistent.snapshot();
  return {hiddenCopies:hidden.copies,restoredCopies:restored.copies,pixelsEqual};
 },mode);
 result.checks.push({device,id:mode,...evidence,passed:evidence.hiddenCopies===0&&evidence.restoredCopies>0&&evidence.pixelsEqual});save();
}
const replaced=await page.evaluate(()=>{
 const {scene,camera,gl}=window.__settlementQA.state,figure=scene.getObjectByName('emberhall-player-figure');
 let source;figure.traverse(o=>{if(!source&&o.isMesh&&!Array.isArray(o.material))source=o});
 const old=source.material,prior=window.__persistent.snapshot();
 source.material=old.clone();gl.render(scene,camera);const after=window.__persistent.snapshot();
 const replacement=source.material;source.material=old;gl.render(scene,camera);replacement.dispose();
 return {created:after.created-prior.created,disposed:after.disposed-prior.disposed};
});
result.checks.push({device,id:'material-replacement',...replaced,passed:replaced.created>0&&replaced.disposed>0});
await page.setViewportSize({width:viewport.width+20,height:viewport.height});await page.waitForTimeout(300);
const cleaned=await page.evaluate(()=>{
 const {scene,camera,gl}=window.__settlementQA.state,p=window.__persistent;
 // Same JS task freezes animation between control and cleanup renders.
 const group=scene.getObjectByName('diagnostic-persistent-player-overlay');group.visible=false;
 p.originalRender.call(gl,scene,camera);const before=gl.domElement.toDataURL();
 p.stop();p.stop();gl.render(scene,camera);
 const stats=p.snapshot();
 return {pixelsEqual:before===gl.domElement.toDataURL(),renderRestored:gl.render===p.originalRender,groupRemoved:!scene.getObjectByName('diagnostic-persistent-player-overlay'),balanced:stats.created===stats.disposed,stats};
});
result.checks.push({device,id:'resize-and-idempotent-cleanup',...cleaned,passed:cleaned.pixelsEqual&&cleaned.renderRestored&&cleaned.groupRemoved&&cleaned.balanced});save();
await context.close();
}
result.passed=result.checks.length===16&&result.checks.every(c=>c.passed)&&result.errors.length===0;
if(!result.passed)process.exitCode=1;
}catch(e){result.failure=e.stack;process.exitCode=1}finally{save();await browser.close();console.log(JSON.stringify(result))}
