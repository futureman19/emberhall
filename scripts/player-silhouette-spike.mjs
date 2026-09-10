import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out='art/verification/civic/player-silhouette-spike';fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(out+'/results.json'));
const result={scope:'Frozen player silhouette browser spike at tavern262,302. Cloned visible meshes, greater-depth overlay, no picking. Not animation, performance or runtime integration acceptance.',checks:[],errors:[]};
const save=()=>fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2));
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
try {
for(const device of ['desktop','mobile']) {
const viewport=device==='desktop'?{width:1440,height:960}:{width:390,height:844};
const context=await browser.newContext({viewport,hasTouch:device==='mobile'});await context.routeWebSocket(/.*/,()=>{});
const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|GLSL|THREE/.test(m.text()))result.errors.push(m.text())});
await page.addInitScript(s=>localStorage.setItem('emberhall-save-v4',s),fs.readFileSync('public/art/phase1-review-save.json','utf8'));
await page.goto('https://emberhall-vale-1hq8nnatn-andrews-projects-ffe8a9fd.vercel.app/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__emberCamera&&window.__ember?.useGame.getState().phase==='playing');
await page.evaluate(()=>{const s=window.__ember.useGame.getState(),p=window.__ember.getWorld().people.find(p=>p.isPlayer);s.speed(0);p.x=262;p.z=302;p.path=[];s.setPanel('none');s.select(null);s.tick(0)});await page.waitForTimeout(8500);

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
const evidence=await page.evaluate(()=>{
 const {scene,camera,gl}=window.__settlementQA.state;scene.updateMatrixWorld(true);const player=scene.getObjectByName('emberhall-player-figure');if(!player)throw Error('No player figure');
 gl.render(scene,camera);const before=gl.domElement.toDataURL();const copies=[];
 player.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material))return;let visible=true;for(let p=o;p;p=p.parent)if(!p.visible)visible=false;if(!visible)return;
 const c=o.clone(false);c.material=o.material.clone();c.material.color?.set('#ffcf70');c.material.emissive?.set('#ffcf70');c.material.emissiveIntensity=1;c.material.transparent=true;c.material.opacity=.55;c.material.depthFunc=6;c.material.depthTest=true;c.material.depthWrite=false;c.material.toneMapped=false;c.matrixAutoUpdate=false;c.matrix.copy(o.matrixWorld);c.renderOrder=10000;c.raycast=()=>{};c.castShadow=false;c.receiveShadow=false;copies.push(c);
 });
 for(const c of copies)scene.add(c);gl.render(scene,camera);const candidate=gl.domElement.toDataURL();for(const c of copies){scene.remove(c);c.material.dispose()}gl.render(scene,camera);return{before,candidate,restoredEqual:before===gl.domElement.toDataURL(),meshes:copies.length};
});
for(const k of ['before','candidate'])fs.writeFileSync(out+'/'+device+'-'+k+'.png',Buffer.from(evidence[k].split(',')[1],'base64'));
result.checks.push({device,meshes:evidence.meshes,restoredEqual:evidence.restoredEqual,passed:evidence.meshes>0&&evidence.restoredEqual});save();await context.close();

}
result.passed=result.checks.length===2&&result.checks.every(x=>x.passed)&&result.errors.length===0;if(!result.passed)process.exitCode=1;
}catch(e){result.failure=e.message;process.exitCode=1}finally{save();await browser.close();console.log(JSON.stringify(result))}
