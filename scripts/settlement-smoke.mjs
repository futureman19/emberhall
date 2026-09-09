#!/usr/bin/env node
/** Disposable settlement interaction QA. Never seeds or edits runtime code.
 * node scripts/settlement-smoke.mjs URL LABEL [--authored] [--preflight-only]
 *   [--save=PATH] [--forge=X,Z] [--out=DIR]
 * Default fixture is intentionally rejected if canonical buildingBox overlaps.
 * Non-default --forge is an explicit caller-approved alternative, not a silent move.
 * --authored requires live scene groups, not bundle-text or local proxy proof.
 * Exit 1: failure/blocker; exit 0: all exercised assertions passed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith('--'));
const option = (key, fallback) => args.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const url = positional[0] ?? 'http://127.0.0.1:8093';
const label = positional[1] ?? 'original';
assert.match(label, /^[a-zA-Z0-9_-]+$/, 'label must be a safe filename');
const assetFailure = args.includes('--asset-failure');
const authored = args.includes('--authored') && !assetFailure;
const out = path.resolve(option('out', path.join(repo, 'art/verification/smoke-baseline', label)));
const savePath = option('save', 'C:/Users/futur/.hermes/profiles/telegram2/lanternwood-review/baseline-save.json');
const forgeXY = option('forge', '253,295').split(',').map(Number);
assert.equal(forgeXY.length, 2); assert(forgeXY.every(Number.isFinite));
fs.mkdirSync(out, { recursive: true });
const result = { url, label, authored, started: new Date().toISOString(), scope: 'disposable browser context; no runtime edits', browserExercised: false, checks: [], errors: [], assets: [], screenshots: [], projections: [] };
const flush = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
const record = (name, ok, evidence = {}) => { result.checks.push({ name, ok, ...evidence }); flush(); };
const check = (name, ok, evidence = {}) => { record(name, !!ok, evidence); assert(ok, name); };
let browser;
try {
  const text = fs.readFileSync(savePath, 'utf8');
  const fixture = JSON.parse(text);
  result.sourceSave = { path: savePath, sha256: crypto.createHash('sha256').update(text).digest('hex') };
  // Parse the canonical numeric table, not a duplicated guessed footprint.
  const source = fs.readFileSync(path.join(repo, 'src/game/building-size.ts'), 'utf8');
  const sizes = Object.fromEntries([...source.matchAll(/^\s*(\w+): \{ x0: (-?\d+), x1: (-?\d+), z0: (-?\d+), z1: (-?\d+) \}/gm)].map(m => [m[1], m.slice(2).map(Number)]));
  const vox = Number(source.match(/export const VOX = ([\d.]+)/)?.[1]);
  assert.equal(vox, .5); assert(sizes.bank && sizes.forge && sizes.hut && sizes.yard);
  const box = b => { const s = sizes[b.kind]; assert(s, `unknown footprint ${b.kind}`); return { x0: b.tx+s[0]*vox, x1: b.tx+(s[1]+1)*vox, z0:b.ty+s[2]*vox, z1:b.ty+(s[3]+1)*vox }; };
  const proposed = { id: 'qa-disposable-settlement-forge', kind:'forge', tx:forgeXY[0], ty:forgeXY[1], beds:[] };
  const a = box(proposed);
  const comparisons = fixture.buildings.map(b => { const q=box(b); return { id:b.id, kind:b.kind, tx:b.tx, ty:b.ty, box:q, overlaps:a.x0<q.x1 && a.x1>q.x0 && a.z0<q.z1 && a.z1>q.z0 }; });
  const collisions = comparisons.filter(b => b.overlaps);
  result.fixture = { proposed, box:a, comparisons, collisions, randomMock:false, modifications:['add explicitly positioned forge only after collision gate','noon and paused simulation','100 smithing','typed iron plus rare sentinel stacks','80 gold and 3 boards for banking; zero legacy ore/ingot'] };
  record('fixture-buildingBox-clear', collisions.length === 0, { proposed:a, collisions, nearby:comparisons.filter(b=>['hut','yard'].includes(b.kind)) });
  if (args.includes('--preflight-only')) {
    result.status = collisions.length ? 'blocked-fixture-overlap' : 'preflight-only-not-browser-proof';
    if (collisions.length) process.exitCode=1;
  } else {
    assert.equal(collisions.length, 0, 'Unsafe fixture overlaps existing buildings. Parent must approve a different --forge=X,Z; no silent relocation.');
    fixture.buildings.push(proposed); fixture.hour=12; fixture.speed=0; fixture.gold=80;
    fixture.player.skills.smithing=100;
    fixture.player.pack.ore=0; fixture.player.pack.ingot=0; fixture.player.pack.board=3;
    fixture.player.chest.board=0;
    fixture.player.resources.stacks = { ...fixture.player.resources.stacks, 'iron_ore:ore:sound':8, 'highland_ore:ore:pristine':7, 'ruby:gem:flawless':5, 'redwood:log:pristine':9 };
    const { chromium } = await import('playwright');
    browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']}); result.browserExercised=true; flush();
    const context=await browser.newContext({viewport:{width:1440,height:960}});
    await context.routeWebSocket(/.*/, () => {}); // Isolate QA from concurrent Vite HMR writes.
    if(assetFailure) await context.route(/\/(bank|forge)\.glb$/,r=>r.fulfill({status:503,body:'Deliberate optional-art failure fixture'}));
    const page=await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror',e=>{result.errors.push({kind:'pageerror',message:e.message});flush();});
    page.on('console',m=>{if(m.type()==='error' && /shader|WebGL|GLSL|THREE|glb/i.test(m.text())) {result.errors.push({kind:'render',message:m.text()});flush();}});
    page.on('response',r=>{if(/\.glb(?:\?|$)/.test(r.url())) {result.assets.push({url:r.url(),status:r.status()});flush();}});
    page.on('requestfailed',r=>{result.errors.push({kind:'requestfailed',url:r.url(),message:r.failure()?.errorText});flush();});
    await page.addInitScript(save=>localStorage.setItem('emberhall-save-v4',save),JSON.stringify(fixture));
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>!!window.__ember,null,{timeout:60000});
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.waitForFunction(()=>window.__ember?.useGame?.getState().phase==='playing',null,{timeout:60000});
    await page.waitForSelector('canvas');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle');
    await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(0);s.setPanel('none');});
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
    const walk=async(name,target)=>{await clear();const before=await state();await page.evaluate(t=>window.__ember.useGame.getState().useTile(...t),target);await ticks();const after=await state();check(name,Math.hypot(after.position[0]-target[0],after.position[1]-target[1])<.35,{target,before,after,method:'simulation-useTile-240x.05-not-pointer'});};
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
    const bank=fixture.buildings.find(b=>b.kind==='bank'&&b.tx===261&&b.ty===295);
    check('canonical-bank-present',!!bank);
    // Spawn fixture remains unchanged; walk from original saved position to bank range.
    await walk('approach-bank',[259,294]);
    await pick(bank,'bank');
    // Pell may stand away from the building; UI range is stricter than command nearBank.
    if(!await page.getByTestId('bank-box').isVisible()) {
      const pell=await page.evaluate(()=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.role==='banker'&&Math.hypot(p.x-261,p.z-295)<10);return [p.x,p.z];});
      await walk('approach-Pell',[Math.round(pell[0]),Math.round(pell[1])+1]);await pick(bank,'bank-near-Pell');
    }
    await page.getByTestId('bank-box').waitFor();
    const before=await state();
    await page.getByRole('button',{name:'Bank gold',exact:true}).click();
    const deposited=await state();check('bank-gold-exact',deposited.gold===0 && deposited.vault===before.vault+before.gold,{before,after:deposited});
    await page.getByRole('button',{name:'Take 10',exact:true}).click();const withdrawn=await state();check('take-10-exact',withdrawn.gold===10 && withdrawn.vault===deposited.vault-10,{after:withdrawn});
    const goods=page.getByTestId('bank-box').getByRole('button').filter({hasText:/Boards?/});
    await goods.first().click();const stored=await state();check('goods-deposit-exact',stored.pack.board===0 && stored.chest.board===3,{after:stored});
    await goods.first().click();const retrieved=await state();check('goods-withdraw-exact',retrieved.pack.board===3 && retrieved.chest.board===0,{after:retrieved});
    await capture('desktop-bank-ui');
    for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]) {
      await page.setViewportSize(viewport);
      for(const b of [bank,proposed]) {
        // Centreline entrance from positive Z. Simulation walk is separate from pointer walk proof.
        const outside=[b.tx,b.ty+(b.kind==='bank'?3:3)];
        await walk(`${device}-${b.kind}-outside`,outside);await settle();const exterior=await scene(b);
        check(`${device}-${b.kind}-exterior-contract`,exterior.found && (authored?exterior.authored:!exterior.authored),{scene:exterior});await capture(`${device}-${b.kind}-outside`);
        await walk(`${device}-${b.kind}-doorway-entry`,[b.tx,b.ty]);const interior=await scene(b);
        check(`${device}-${b.kind}-cutaway`,interior.found && !interior.authored && interior.visibleOriginal>0 && interior.originalCount<exterior.originalCount,{outside:exterior,inside:interior});await capture(`${device}-${b.kind}-inside`);
        await walk(`${device}-${b.kind}-doorway-exit`,outside);const exited=await scene(b);check(`${device}-${b.kind}-cutaway-restored`,exited.originalCount===exterior.originalCount && exited.authored===exterior.authored,{exited});
      }
      await pick(proposed,`${device}-forge`);
      const row=page.locator('li').filter({has:page.getByText('Smelt ore',{exact:true})});const make=row.getByRole('button',{name:'Make',exact:true});await make.scrollIntoViewIfNeeded();
      const pre=await state();const disabled=await make.isDisabled();await capture(`${device}-crafting`);
      if(disabled)record(`${device}-typed-smelt-UI`,false,{classification:'existing-typed-only-UI-gate',row:await row.innerText(),before:pre,note:'RecipeRow uses haveNeed(pack,rec); engine supports typed iron, UI only counts legacy pack. No legacy injection or programmatic craft substituted.'});
      else {
        // SuccessChance caps at .95 even at 100 skill. Only the synchronous UI callback gets a disposable deterministic roll.
        await page.evaluate(()=>{window.__settlementQA.random=Math.random;Math.random=()=>.5;});result.fixture.randomMock=true;flush();
        try{await make.click();}finally{await page.evaluate(()=>{Math.random=window.__settlementQA.random;delete window.__settlementQA.random;});}
        const post=await state();check(`${device}-typed-smelt-UI`,post.resources['iron_ore:ore:sound']===pre.resources['iron_ore:ore:sound']-1 && post.pack.ingot===pre.pack.ingot+1,{before:pre,after:post,random:'explicit disposable .5 around mouse UI Make; original restored'});
      }
      const after=await state();check(`${device}-rare-stacks-preserved`,['highland_ore:ore:pristine','ruby:gem:flawless','redwood:log:pristine'].every(k=>after.resources[k]===fixture.player.resources.stacks[k]),{resources:after.resources});
    }
    // Real terrain pointer walking, camera projection from the same target scene.
    await clear();await page.setViewportSize({width:1440,height:960});await walk('pointer-start',[256,294]);
    const beforePointer=await state();
    const pt=await page.evaluate(()=>{const {camera,gl}=window.__settlementQA.state;const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer);const v=camera.position.clone().set(p.x+1,0,p.z+2);const r=gl.domElement.getBoundingClientRect();v.project(camera);return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};});
    await page.mouse.click(pt.x,pt.y);const pointerIntent=await state();await ticks();const afterPointer=await state();check('terrain-mouse-walk',pointerIntent.path.length>0 && Math.hypot(afterPointer.position[0]-beforePointer.position[0],afterPointer.position[1]-beforePointer.position[1])>.2,{point:pt,before:beforePointer,intent:pointerIntent,after:afterPointer});
    check('no-render-errors',result.errors.length===0,{errors:result.errors});check(assetFailure?'optional-art-fallback-HTTP-fixture':'no-failed-glbs',result.assets.every(a=>assetFailure && /\/(bank|forge)\.glb$/.test(a.url)?a.status===503:a.status<400),{assets:result.assets});
    result.status=result.checks.some(c=>!c.ok)?'completed-with-failures':'passed';if(result.status!=='passed')process.exitCode=1;
  }
} catch(error) {result.status='blocked-or-failed';result.failure={message:error.message,stack:error.stack};process.exitCode=1;}
finally {if(browser)await browser.close();result.finished=new Date().toISOString();flush();console.log(JSON.stringify({status:result.status,browserExercised:result.browserExercised,checks:result.checks.map(({name,ok})=>({name,ok})),failure:result.failure?.message,evidence:path.join(out,'results.json')},null,2));}
