// Bounded ABBA diagnostic: current civic visuals held fixed; only Phase1 furnishing/sign GLBs differ.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url=process.argv[2]??'http://127.0.0.1:8093';assert(['localhost','127.0.0.1'].includes(new URL(url).hostname));
const label=process.argv[3]??'hall-unused-slot-proof';assert.match(label,/^[a-z0-9-]+$/);const out='art/verification/civic/'+label+'.json';assert(!fs.existsSync(out),'Preserve previous results');
const result={diagnostic:'One synchronous before/trimmed/restored render; inherited frames field is not timing evidence',scope:'Current civic renderer in both arms, mobile hall interior, fixed fixture/noon/clear. Off aborts only new Phase1 props/signs. CPU render submission is NOT GPU execution time. Diagnostic does not waive original failed gates.',order:['on'],frames:300,settleMs:8500,runs:[],errors:[]};
const flush=()=>fs.writeFileSync(out,JSON.stringify(result,null,2));
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
const watchdog=setTimeout(()=>browser.close(),180000);
try {
 for(const arm of result.order){
  const ctx=await browser.newContext({viewport:{width:390,height:844}});await ctx.routeWebSocket(/.*/,()=>{});
  if(arm==='off')await ctx.route(/\/art\/lanternwood\/(?:interior-[^/]+|notice|board)\.glb$/,r=>r.abort());
  const page=await ctx.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>result.errors.push(e.message));
  await page.addInitScript(s=>localStorage.setItem('emberhall-save-v4',s),fs.readFileSync('public/art/phase1-review-save.json','utf8'));
  await page.goto(url+'/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing');await page.waitForLoadState('networkidle');
  await page.evaluate(async()=>{const src=await(await fetch('/src/components/game/world-scene.tsx')).text(),m=src.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/),f=await import(m[1]);window.__perf=f._roots.get(document.querySelector('canvas')).store.getState();const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);p.x=256;p.z=290;p.path=[];w.hour=12;Object.assign(w.weather,{kind:'clear',cloud:.06,wet:0,wind:.12,untilHour:99999,douseHour:0});s.speed(0);s.tick(0)});
  await page.waitForTimeout(8500);
 const proof=await page.evaluate(()=>{const s=window.__perf,g=s.gl,rows=[],restore=[];g.render(s.scene,s.camera);const before=g.domElement.toDataURL(),beforeInfo={...g.info.render};s.scene.traverse(o=>{if(!o.isInstancedMesh)return;const a=o.instanceMatrix.array;let n=o.count;while(n>0){const k=(n-1)*16;if(a[k+13]!==-40||Math.abs(a[k]-.01)>1e-7||Math.abs(a[k+5]-.01)>1e-7||Math.abs(a[k+10]-.01)>1e-7)break;n--}if(n!==o.count){rows.push({old:o.count,used:n,geometry:o.geometry.type});restore.push([o,o.count]);o.count=n}});g.render(s.scene,s.camera);const after=g.domElement.toDataURL(),afterInfo={...g.info.render};for(const [o,n]of restore)o.count=n;g.render(s.scene,s.camera);return{rows,beforeInfo,afterInfo,pixelsEqual:before===after,restoredPixelsEqual:before===g.domElement.toDataURL()}});
result.runs.push(proof);flush();await ctx.close();}
result.passed=result.errors.length===0&&result.runs.every(r=>r.pixelsEqual&&r.restoredPixelsEqual);
}catch(e){result.passed=false;result.failure=e.message;process.exitCode=1}finally{clearTimeout(watchdog);flush();await browser.close()}
console.log(JSON.stringify(result));
