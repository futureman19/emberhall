import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out='art/verification/civic/player-depth-transparent-red';fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(out+'/results.json'));
const result={scope:'Transparent non-depth-writing occluder regression: isolated player must remain unchanged; tavern positive retained. Disposable synthetic box, not new gameplay scenery.',checks:[],errors:[]};
const save=()=>fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2));
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
try {
for(const device of ['desktop','mobile']) for(const isolated of [true,false]) {
const viewport=device==='desktop'?{width:1440,height:960}:{width:390,height:844};
const context=await browser.newContext({viewport,hasTouch:device==='mobile'});await context.routeWebSocket(/.*/,()=>{});
const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|GLSL|THREE/.test(m.text()))result.errors.push(m.text())});
await page.addInitScript(s=>localStorage.setItem('emberhall-save-v4',s),fs.readFileSync('public/art/phase1-review-save.json','utf8'));
await page.goto('http://127.0.0.1:8093/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__emberCamera&&window.__ember?.useGame.getState().phase==='playing');
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
const evidence=await page.evaluate(async(isolated)=>{const source=await(await fetch('/src/components/game/terrain.tsx')).text();const match=source.match(/from\s+["']([^"']*\/three\.js[^"']*)["']/);if(!match)throw Error('Exact Three import missing');const T=await import(match[1]);
 const {scene,camera,gl}=window.__settlementQA.state;scene.updateMatrixWorld(true);const player=scene.getObjectByName('emberhall-player-figure');if(!player)throw Error('No player figure');
 const hidden=[];scene.traverse(o=>{if(!o.isMesh)return;let isPlayer=false;for(let p=o;p;p=p.parent)if(p===player)isPlayer=true;if(isolated&&!isPlayer){hidden.push([o,o.visible]);o.visible=false;}});
 const invisible=new T.Mesh(new T.BoxGeometry(4,4,1),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));invisible.position.copy(player.getWorldPosition(new T.Vector3())).lerp(camera.position,0.08);invisible.lookAt(camera.position);invisible.raycast=()=>{};scene.add(invisible);scene.updateMatrixWorld(true);
 gl.render(scene,camera);const before=gl.domElement.toDataURL();const copies=[];
 const size=gl.getDrawingBufferSize(new T.Vector2()),target=new T.WebGLRenderTarget(size.x,size.y);target.depthTexture=new T.DepthTexture(size.x,size.y);const box=new T.Box3();player.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position)return;for(let p=o;p;p=p.parent)if(!p.visible)return;const pos=o.geometry.attributes.position;for(let i=0;i<pos.count;i++){const v=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);if(![v.x,v.y,v.z].every(Number.isFinite))throw Error('Nonfinite visible player vertex');box.expandByPoint(v);}});if(box.isEmpty())throw Error('Empty player bounds');const points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new T.Vector3(x,y,z).project(camera));const x0=Math.max(0,Math.floor(Math.min(...points.map(p=>(p.x+1)*size.x/2)))-4),y0=Math.max(0,Math.floor(Math.min(...points.map(p=>(p.y+1)*size.y/2)))-4),x1=Math.min(size.x,Math.ceil(Math.max(...points.map(p=>(p.x+1)*size.x/2)))+4),y1=Math.min(size.y,Math.ceil(Math.max(...points.map(p=>(p.y+1)*size.y/2)))+4);target.scissor.set(x0,y0,x1-x0,y1-y0);target.scissorTest=true;const depthMaterial=new T.MeshDepthMaterial();depthMaterial.colorWrite=false;const oldTarget=gl.getRenderTarget(),visible=player.visible;player.visible=false;gl.setRenderTarget(target);{const override=scene.overrideMaterial,auto=gl.shadowMap.autoUpdate;scene.overrideMaterial=depthMaterial;gl.shadowMap.autoUpdate=false;try{gl.render(scene,camera)}finally{scene.overrideMaterial=override;gl.shadowMap.autoUpdate=auto}}player.visible=visible;gl.setRenderTarget(oldTarget);

 player.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material))return;let visible=true;for(let p=o;p;p=p.parent)if(!p.visible)visible=false;if(!visible)return;
 const c=o.clone(false);c.material=o.material.clone();c.material.color?.set('#ffcf70');c.material.emissive?.set('#ffcf70');c.material.emissiveIntensity=1;c.material.transparent=true;c.material.opacity=.55;c.material.depthFunc=6;c.material.depthTest=false;c.material.onBeforeCompile=shader=>{shader.uniforms.sceneDepth={value:target.depthTexture};shader.uniforms.depthSize={value:size};shader.fragmentShader='uniform sampler2D sceneDepth;uniform vec2 depthSize;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('void main() {','void main() { if(gl_FragCoord.z<=texture2D(sceneDepth,gl_FragCoord.xy/depthSize).x+0.000001) discard;');};c.material.customProgramCacheKey=()=> 'scenery-depth-spike';c.material.depthWrite=false;c.material.toneMapped=false;c.matrixAutoUpdate=false;c.matrix.copy(o.matrixWorld);c.renderOrder=10000;c.raycast=()=>{};c.castShadow=false;c.receiveShadow=false;copies.push(c);
 });
 for(const c of copies)scene.add(c);gl.render(scene,camera);const candidate=gl.domElement.toDataURL();for(const c of copies){scene.remove(c);c.material.dispose()}gl.render(scene,camera);const restoredEqual=before===gl.domElement.toDataURL();for(const [o,v]of hidden)o.visible=v;scene.remove(invisible);invisible.geometry.dispose();invisible.material.dispose();depthMaterial.dispose();target.dispose();target.depthTexture.dispose();return{before,candidate,restoredEqual,unobstructedEqual:before===candidate,meshes:copies.length};
},isolated);
for(const k of ['before','candidate'])fs.writeFileSync(out+'/'+device+'-'+(isolated?'isolated':'occluded')+'-'+k+'.png',Buffer.from(evidence[k].split(',')[1],'base64'));
result.checks.push({device,isolated,unobstructedEqual:evidence.unobstructedEqual,meshes:evidence.meshes,restoredEqual:evidence.restoredEqual,passed:evidence.meshes>0&&evidence.restoredEqual&&(isolated?evidence.unobstructedEqual:!evidence.unobstructedEqual)});save();await context.close();

}
result.passed=result.checks.length===4&&result.checks.every(x=>x.passed)&&result.errors.length===0;if(!result.passed)process.exitCode=1;
}catch(e){result.failure=e.message;process.exitCode=1}finally{save();await browser.close();console.log(JSON.stringify(result))}
