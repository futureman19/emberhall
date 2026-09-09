// Bounded ABBA diagnostic: current civic visuals held fixed; only Phase1 furnishing/sign GLBs differ.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url=process.argv[2]??'http://127.0.0.1:8093';assert(['localhost','127.0.0.1'].includes(new URL(url).hostname));
const label=process.argv[3]??'active-count-targeted-capture';assert.match(label,/^[a-z0-9-]+$/);const out='art/verification/civic/'+label+'.json';assert(!fs.existsSync(out),'Preserve previous results');
const result={scope:'Six disposable streaming-window relocations, desktop/mobile; synchronous current/old-capacity/restored rendering and nine NDC ray probes. Not continuous walking or resource UI action proof.',order:['on'],settleMs:8500,runs:[],errors:[]};
const flush=()=>fs.writeFileSync(out,JSON.stringify(result,null,2));
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
const watchdog=setTimeout(()=>browser.close(),240000);
try {
 for(const arm of result.order){
  const ctx=await browser.newContext({viewport:{width:390,height:844}});await ctx.routeWebSocket(/.*/,()=>{});
  if(arm==='off')await ctx.route(/\/art\/lanternwood\/(?:interior-[^/]+|notice|board)\.glb$/,r=>r.abort());
  if(label.includes('terrain-only'))await ctx.route('**/src/components/game/terrain.tsx*',async route=>{const response=await route.fetch();const body=await response.text();assert(body.includes('mesh.count = from;'),'compiled active-count marker');await route.fulfill({response,body:body.replace('mesh.count = from;','mesh.count = from; mesh.userData.activeTerrainProbe = true;')})});const page=await ctx.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>result.errors.push(e.message));
  await page.addInitScript(s=>localStorage.setItem('emberhall-save-v4',s),fs.readFileSync('public/art/phase1-review-save.json','utf8'));
  await page.goto(url+'/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing');await page.waitForLoadState('networkidle');
  await page.evaluate(async()=>{const src=await(await fetch('/src/components/game/world-scene.tsx')).text(),m=src.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/),f=await import(m[1]);window.__perf=f._roots.get(document.querySelector('canvas')).store.getState();const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);p.x=256;p.z=290;p.path=[];w.hour=12;Object.assign(w.weather,{kind:'clear',cloud:.06,wet:0,wind:.12,untilHour:99999,douseHour:0});s.speed(0);s.tick(0)});

await page.evaluate(value=>{window.__terrainOnlyProbe=value},label.includes('terrain-only'));
for(const [device,width,height]of [['desktop',1440,960]]){await page.setViewportSize({width,height});for(const [x,z]of [[256,290],[220,260],[280,320]]){
await page.evaluate(({x,z})=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);p.x=x;p.z=z;p.path=[];s.tick(0)},{x,z});await page.waitForTimeout(8500);
for(let sampleIndex=0;sampleIndex<40;sampleIndex++){await page.waitForTimeout(100);const proof=await page.evaluate(()=>{const s=window.__perf,g=s.gl,restore=[],counts=[];s.scene.traverse(o=>{if(!o.isInstancedMesh||(window.__terrainOnlyProbe&&!o.userData.activeTerrainProbe))return;const a=o.instanceMatrix.array,n=o.instanceMatrix.count,k=(n-1)*16;if(n>o.count&&a[k+13]===-40&&Math.abs(a[k]-.01)<1e-7&&Math.abs(a[k+5]-.01)<1e-7&&Math.abs(a[k+10]-.01)<1e-7){restore.push([o,o.count]);counts.push({used:o.count,capacity:n,type:o.geometry.type})}});
const pick=()=>{const hits=[];for(const x of [-.3,0,.3])for(const y of [-.3,0,.3]){s.raycaster.setFromCamera({x,y},s.camera);hits.push(s.raycaster.intersectObjects(s.scene.children,true).slice(0,5).map(h=>({id:h.object.uuid,instance:h.instanceId,distance:h.distance})));}return JSON.stringify(hits)};
g.render(s.scene,s.camera);const before=g.domElement.toDataURL(),beforePicks=pick(),beforeTriangles=g.info.render.triangles;for(const[o]of restore)o.count=o.instanceMatrix.count;g.render(s.scene,s.camera);const expanded=g.domElement.toDataURL(),expandedPicks=pick(),expandedTriangles=g.info.render.triangles;for(const[o,n]of restore)o.count=n;g.render(s.scene,s.camera);return{images:before===expanded?null:{before,expanded},counts,pixelsEqual:before===expanded,restoredEqual:before===g.domElement.toDataURL(),picksEqual:beforePicks===expandedPicks,beforeTriangles,expandedTriangles}});
if(proof.images){for(const [key,data]of Object.entries(proof.images))fs.writeFileSync(out+'.'+device+'.'+x+'.'+z+'.'+key+'.png',Buffer.from(data.split(',')[1],'base64'));delete proof.images}result.runs.push({device,x,z,sampleIndex,...proof});flush();assert(proof.counts.length>0);assert(proof.pixelsEqual&&proof.restoredEqual&&proof.picksEqual,'pixel/raycast parity');}}}
await ctx.close();}
result.passed=result.errors.length===0&&result.runs.length===120;
}catch(e){result.passed=false;result.failure=e.message;process.exitCode=1}finally{clearTimeout(watchdog);flush();await browser.close()}
console.log(JSON.stringify({passed:result.passed,cases:result.runs.length,failure:result.failure}));
