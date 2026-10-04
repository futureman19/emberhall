// Bounded U2 flora render/input smoke. Disposable cleared plot; not full farming QA.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {SAVE_KEY} from '../src/game/save.ts';
const [url='http://127.0.0.1:8123',label='vis-u3-offhands-dev',mode='candidate']=process.argv.slice(2);
assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));assert.match(label,/^[a-z0-9-]+$/);
const out=path.resolve('art/verification/worldwide',label);fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(path.join(out,'results.json')));
const raw=fs.readFileSync('art/verification/worldwide/vis-u1-smoke-v1/disposable-save.json','utf8');
const result={mode,url,scope:'Controlled live material transitions for 13 equipped items, five states; not real death/resurrection/combat lifecycle.',cases:[],errors:[]};
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
try {
 for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]) {
  const context=await browser.newContext({viewport,hasTouch:device==='mobile',deviceScaleFactor:1});await context.routeWebSocket(/.*/,()=>{});
  if(mode==='fallback')await context.route('**/art/lanternwood/offhands.glb',r=>r.fulfill({status:503,body:'Deliberate local QA rejection'}));
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
  await page.addInitScript(({raw,key})=>localStorage.setItem(key,raw),{raw,key:SAVE_KEY});await page.goto(url+'/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.waitForFunction(()=>{if(!window.__emberCamera||window.__ember?.useGame.getState().phase!=='playing')return false;window.__ember.useGame.getState().speed(0);return true;});await page.waitForLoadState('networkidle');
  await page.evaluate(()=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);w.people=[p];w.fauna=[];w.buildings=[{id:'u3-fixture-house',kind:'hut',tx:64,ty:400,beds:[],ownerId:w.player.id}];w.plots=[];w.herbs=[];w.saplings=[];w.piles=[];for(let z=282;z<=322;z++)for(let x=232;x<=278;x++){w.tiles[z][x].kind='dirt';w.tiles[z][x].h=4;}w.landRev++;p.x=255;p.z=304;p.story=0;p.path=[];p.hunger=0;p.energy=100;w.hour=12;w.player.intent.kind='none';s.setPanel('none');s.closeCtx();s.tick(.01);});
  await page.waitForTimeout(1200);
  for(const weapon of ['hatchet','pick','hoe','fishing_rod','knife','sword','club','mace','staff','bow','torch','shield','heater']) {
   const row={device,weapon,states:[]};
   for(const state of ['alive','ghost','restored','invisible','visible']) {
    await page.evaluate(({weapon,state})=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);w.player.wear.main=['shield','heater'].includes(weapon)?null:weapon;w.player.wear.off=['shield','heater'].includes(weapon)?weapon:null;p.ghost=state==='ghost';w.player.ghost=state==='ghost';w.player.invisUntil=state==='invisible'?w.hour+1:0;s.tick(.01);s.select(null);},{weapon,state});await page.waitForTimeout(350);
    const mats=mode==='built'?[]:await page.evaluate(async()=>{const text=await(await fetch('/src/components/game/world-scene.tsx')).text(),f=text.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/),fiber=await import(f[1]);const scene=fiber._roots.get(document.querySelector('canvas')).store.getState().scene;const mats=[];scene.traverse(o=>{const part=o.geometry?.userData.weaponPart||o.geometry?.userData.offhandPart||o.geometry?.userData.toolPart;if(part){const m=o.material;mats.push({part,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,color:m.color.getHexString(),emissive:m.emissive.getHexString(),emissiveIntensity:m.emissiveIntensity,roughness:m.roughness,metalness:m.metalness});}});return mats.sort((a,b)=>a.part.localeCompare(b.part));});
    const rejectedOffhand = mode==='fallback' && ['bow','torch','shield','heater'].includes(weapon);
    if(mode!=='built') {
     if(rejectedOffhand) assert.equal(mats.length,0,'Rejected offhand kit has no authored materials');
     else assert.equal(mats.length,weapon==='sword'?3:2,'Complete authored equipment remains');
    }
    // Empty census proves rejection only, not primitive material-state parity.
    row.states.push({state,mats,materialChecks:mode==='built'||rejectedOffhand?'not inspected':'authored inspected'});
    if(['ghost','invisible'].includes(state)){for(const mat of mats){assert.equal(mat.opacity,.58,weapon+'/'+mat.part+'/'+state);assert.equal(mat.transparent,true);assert.equal(mat.depthWrite,false);}}
    if(['restored','visible'].includes(state))assert.deepEqual(mats,row.states[0].mats);
    if(weapon==='sword'&&['alive','ghost','restored'].includes(state))await page.screenshot({path:path.join(out,device+'-'+state+'.png')});
   }
   result.cases.push(row);flush();
  }
  await context.close();
 }
 const unexpected=result.errors.filter(e=>!(mode==='fallback'&&e.includes('503')));assert.deepEqual(unexpected,[]);
 result.passed=true;
} catch(e){result.passed=false;result.failure=e.stack;process.exitCode=1;}finally{flush();await browser.close();}
console.log(JSON.stringify({passed:result.passed,cases:result.cases.length,errors:result.errors,failure:result.failure,out}));
