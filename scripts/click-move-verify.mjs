import { chromium } from 'playwright';
import { PerspectiveCamera, Vector3 } from 'three';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const url = process.env.CLICK_MOVE_URL || 'http://127.0.0.1:8198/?qa=1';
const evidence = process.env.CLICK_MOVE_EVIDENCE || 'plans/evidence/click-move/native-review';
const result = { url, checks: [], errors: [], consoleErrors: [], method: 'Disposable browser context; controlled flat terrain fixture via existing probe; native mouse clicks; real store simulation ticks.' };
const flush = () => writeFileSync(`${evidence}.json`, JSON.stringify(result, null, 2));
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
try {
 const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
 page.setDefaultTimeout(20000);
 page.on('pageerror', e => result.errors.push(e.message));
 page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
 await page.goto(url);
 console.log('loaded', await page.title());
 await page.waitForFunction(() => window.__ember);
 await page.evaluate(() => window.__ember.useGame.getState().begin(true));
 await page.waitForFunction(() => ['intro', 'looking', 'playing'].includes(window.__ember.useGame.getState().phase));
 await page.evaluate(() => window.__ember.useGame.setState({ phase: 'playing' }));
 await page.waitForFunction(() => window.__emberCamera, null, {timeout: 45000});
 console.log('camera ready');
 const state = () => page.evaluate(() => { const w = window.__ember.getWorld(), p = w.people.find(p => p.isPlayer); return { x: p.x, z: p.z, path: structuredClone(p.path), intent: structuredClone(w.player.intent) }; });
 const setup = async (x, z, wall) => {
  await page.evaluate(({x,z,wall}) => {
   const w = window.__ember.getWorld(), s = window.__ember.useGame.getState(), p = w.people.find(p => p.isPlayer);
   w.speed = 0; p.x = x; p.z = z; p.path = []; w.player.intent.kind = 'none';
   for (let ty = 85; ty <= 115; ty++) for (let tx = 85; tx <= 115; tx++) w.tiles[ty][tx] = { h: 0, kind: 'grass' };
   for (const key of ['trees', 'fauna', 'buildings', 'props', 'herbs', 'piles']) if (Array.isArray(w[key])) w[key] = w[key].filter(v => Math.hypot((v.tx ?? v.x ?? -999)-100,(v.ty ?? v.z ?? -999)-100)>20);
   if (wall) w.tiles[wall[1]][wall[0]].kind = 'wall';
   w.landRev++; s.select(null); s.setPanel('none'); s.closeCraft(); s.flash(''); s.tick(0);
  }, {x,z,wall});
  await page.waitForTimeout(2000);
 };
 const click = async (tx, ty) => {
  const live = await page.evaluate(() => ({p:window.__emberCamera.getCamera(),t:window.__emberCamera.getTarget()}));
  const cam = new PerspectiveCamera(48,1280/800,.2,480); cam.position.set(live.p.x,live.p.y,live.p.z); cam.lookAt(live.t.x,live.t.y,live.t.z); cam.updateMatrixWorld();
  const v = new Vector3(tx,0,ty).project(cam), pixel = {x:(v.x+1)*640,y:(1-v.y)*400};
  await page.mouse.click(pixel.x,pixel.y);
  const after = await state(); result.checks.push({name:'native-target',target:[tx,ty],pixel,after}); flush();
  assert.equal(after.intent.kind,'walk'); assert.equal(after.intent.tx,tx); assert.equal(after.intent.ty,ty); return after;
 };
 const advance = async n => page.evaluate(n => {const s=window.__ember.useGame.getState(),w=window.__ember.getWorld();w.speed=1;for(let i=0;i<n;i++)s.tick(.1);w.speed=0;},n);
 await setup(100,100,null);
 let a = await click(104,102); assert.deepEqual(a.path,[{tx:104,ty:102}]);
 await advance(1); let b = await state(); assert(Math.abs(Math.hypot(b.x-100,b.z-100)-.26)<1e-8);
 result.checks.push({name:'open-ground-straight-motion',ok:true,b}); flush();
 a = await click(97,104); assert.deepEqual(a.path,[{tx:97,ty:104}]); const before = a; await advance(1); b=await state();
 const d=Math.hypot(97-before.x,104-before.z); assert(Math.abs(b.x-before.x-.26*(97-before.x)/d)<1e-8); assert(Math.abs(b.z-before.z-.26*(104-before.z)/d)<1e-8);
 await advance(50); b=await state(); assert.equal(b.x,97); assert.equal(b.z,104); result.checks.push({name:'fractional-redirect-arrival',ok:true,b}); flush();
 await setup(100.5408,100.3606,[102,100]); a=await click(103,102); assert.deepEqual(a.path,[{tx:103,ty:102}]); await advance(30); b=await state(); assert.equal(b.x,103); assert.equal(b.z,102); result.checks.push({name:'rounded-origin-false-obstacle-regression',ok:true,b}); flush();
 await setup(100.4,100.4,[101,101]); a=await click(104,104); assert(a.path.length>1); const samples=[];
 for(let i=0;i<60;i++){await advance(1);b=await state();samples.push([b.x,b.z]);assert(!(Math.round(b.x)===101&&Math.round(b.z)===101));if(!b.path.length)break;}
 assert.equal(b.x,104);assert.equal(b.z,104);result.checks.push({name:'obstacle-avoidance-arrival',ok:true,route:a.path,samples});
 await page.screenshot({path:`${evidence}.png`});
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.consoleErrors,[]);result.passed=true;
} catch(e) {result.failure=String(e);process.exitCode=1;} finally {flush();await browser.close();console.log(JSON.stringify(result));}
