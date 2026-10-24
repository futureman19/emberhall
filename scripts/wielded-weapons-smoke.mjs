import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { ITEM_FORM_CATALOG } from '../src/game/crafting/forms.ts';
import { resolveItemStats } from '../src/game/crafting/resolve.ts';
const weapons = ['dagger', 'spear', 'war_axe'].map((base, seed) => {
 const form = ITEM_FORM_CATALOG[base];
 const build = { workmanship: 'fine', components: form.roles.map(role => ({ role: role.role, resourceId: role.role === 'edge' ? 'copper_ore' : 'redwood', form: role.role === 'edge' ? 'ingot' : 'board', grade: role.role === 'edge' ? 'pristine' : 'sound', amount: role.amount })), inlays: [{ resourceId: 'ruby', clarity: 'cut' }] };
 return { uid: `visual-${base}`, base, formId: base, recipeId: base, recipeVersion: form.recipeVersion, maker: 'Visual fixture', affixes: [], seed, hour: 12, source: 'crafted', ...build, resolvedStats: resolveItemStats(form, build).stats };
});
const url = process.env.WIELDED_SMOKE_URL || 'http://127.0.0.1:8080/';
const output = resolve(process.env.WIELDED_SMOKE_OUTPUT || 'screenshots/wielded-weapons');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const verdict = { url, fixture: 'Fresh paused world, supplied crafted copper/redwood/ruby weapons. Native pack equip and Eyes toggle. Emulated touch, not physical phone.', ok: true, viewports: {} };
try {
 for (const mobile of [false, true]) {
  const name = mobile ? 'mobile' : 'desktop';
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile });
  await context.routeWebSocket('**', () => {});
  // Observe renderer roots before React initializes, including the separate R3F
  // reconciler. DOM-fiber traversal cannot cross that renderer boundary in builds.
  await context.addInitScript(() => {
   const roots = new Set();
   window.__weaponFiberRoots = roots;
   let next = 0;
   window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, renderers: new Map(),
    inject(renderer) { const id = ++next; this.renderers.set(id, renderer); return id; },
    onCommitFiberRoot(_id, root) { roots.add(root); },
    onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
   };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const act = async l => { await l.scrollIntoViewIfNeeded(); if (mobile) await l.tap(); else await l.click(); };
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ember);
  await page.evaluate(() => window.__ember.useGame.getState().begin(false));
  await page.waitForFunction(() => window.__ember.useGame.getState().phase === 'playing', null, { timeout: 60000 });
  await page.getByRole('heading', { name: /guide/i }).waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(weapons => {
   const { getWorld, useGame } = window.__ember;
   useGame.getState().speed(0);
   const w = getWorld(); w.hour = 12;
   w.player.rares = weapons;
   useGame.getState().tick(.13); useGame.getState().tick = () => {};
   useGame.setState({ panel: 'none' });
  }, weapons);
  // Read the actual mounted renderer stores. No second copy of Zustand or R3F.
  await page.evaluate(() => {
   window.__weaponRoots = () => [...document.querySelectorAll('canvas')].map(canvas => {
    const queue = [...window.__weaponFiberRoots];
    for (let n = canvas; n; n = n.parentElement) for (const k of Object.keys(n)) if (k.startsWith('__reactFiber')) queue.push(n[k]);
    const seen = new Set();
    for (let i = 0; i < queue.length && i < 100000; i++) {
     const o = queue[i]; if (!o || seen.has(o) || (typeof o !== 'object' && typeof o !== 'function')) continue; seen.add(o);
     if (o.scene && o.gl?.domElement === canvas && o.camera) return o;
     if (typeof o.getState === 'function') { const s = o.getState(); if (s?.scene && s?.gl?.domElement === canvas) return s; }
     if (!(o instanceof Node) && o !== window && !ArrayBuffer.isView(o)) {
      for (const d of Object.values(Object.getOwnPropertyDescriptors(o))) if (d.value && (typeof d.value === 'object' || typeof d.value === 'function')) queue.push(d.value);
     }
     for (const k of ['child','sibling','return','stateNode','memoizedState','next','memoizedProps','__r3f','root','store','current','value','children','_currentValue','_currentValue2','containerInfo','props','dependencies','firstContext','memoizedValue','context']) if (o[k] && (typeof o[k] === 'object' || typeof o[k] === 'function')) queue.push(o[k]);
     if(Array.isArray(o)) queue.push(...o.slice(0,100));
     if(o.memoizedState && typeof o.memoizedState==='object') for(const d of Object.values(Object.getOwnPropertyDescriptors(o.memoizedState))) if(d.value && typeof d.value==='object') queue.push(d.value);
    }
    return null; // Non-R3F canvases (for example the minimap) have no scene.
   }).filter(Boolean);
  });
  const results = [];
  for (const id of ['dagger', 'spear', 'war_axe']) {
   await page.evaluate(() => window.__ember.useGame.getState().setPanel('you'));
   await page.waitForTimeout(600);
   const label = id === 'war_axe' ? /war axe/i : new RegExp(id, 'i');
   await act(page.locator('[data-testid="pack-grid"]').getByRole('button', { name: label }).first());
   await page.waitForTimeout(600);
   assert.equal(await page.evaluate(() => window.__ember.getWorld().player.wearRare.main), `visual-${id}`);
   const inspect = async view => page.evaluate(({ id, view }) => {
    const roots = window.__weaponRoots();
    return roots.map(s => {
     const parent = view === 'first' ? s.scene.getObjectByName('emberhall-first-person-weapon') : s.scene;
     const g = parent?.getObjectByName(`emberhall-weapon-${id}`);
     if (!g) return null;
     s.scene.updateMatrixWorld(true); s.camera.updateMatrixWorld(true);
     const parts = ['weapon-edge', 'weapon-hilt', 'weapon-inlay'].map(name => {
      const m = g.getObjectByName(name); if (!m) return null;
      m.geometry.computeBoundingBox();
      const point = m.geometry.boundingBox.getCenter(m.position.clone()).applyMatrix4(m.matrixWorld).project(s.camera);
      return { name, color: m.material.color.getHexString(), roughness: m.material.roughness, vertices: m.geometry.attributes.position.count, ndc: point.toArray(), depthWrite: m.material.depthWrite };
     });
     return { parts, canvas: [s.size.width, s.size.height], first: Boolean(s.scene.getObjectByName('emberhall-first-person-weapon')) };
    }).filter(Boolean);
   }, { id, view });
   console.log('renderer diagnostic', await page.evaluate(() => ({ wear: window.__ember.useGame.getState().snap.player.wear, canvases: [...document.querySelectorAll('canvas')].map(c => ({ keys: Object.keys(c), size: [c.width,c.height] })), roots: window.__weaponRoots().map(s => { const names=[];s.scene.traverse(o=>{if(o.name.includes('weapon'))names.push(o.name)});return {size:s.size, names};}) })));
   const views = await inspect('third');
   assert.equal(views.length, 2, 'world and paperdoll both render held weapon');
   for (const v of views) { assert.equal(v.parts.length, 3); assert.ok(v.parts.every(p => p?.vertices > 0)); assert.equal(v.parts[0].roughness, .18); }
   assert.deepEqual(views[0].parts.map(p => p.color), views[1].parts.map(p => p.color));
   // Capture-only tooltip dismissal; equip and view toggles remain native inputs.
   await page.mouse.move(0, 0);
   await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.querySelectorAll('[data-tip-open]').forEach(el => el.dispatchEvent(new Event('dismiss-tip')));
   });
   await page.locator('.drawer-shell canvas').scrollIntoViewIfNeeded();
   await page.screenshot({ path: resolve(output, `${name}-${id}-paperdoll.png`) });
   await page.evaluate(() => window.__ember.useGame.getState().setPanel('none'));
   await page.waitForTimeout(500);
   await page.screenshot({ path: resolve(output, `${name}-${id}-world.png`) });
   await act(page.getByRole('button', { name: 'First-person: off', exact: true }));
   await page.waitForTimeout(600);
   const first = await inspect('first'); assert.equal(first.length, 1);
   assert.deepEqual(first[0].parts.map(p => p.color), views[0].parts.map(p => p.color));
   const edge = first[0].parts[0].ndc;
   assert.ok(edge.every(Number.isFinite) && Math.abs(edge[0]) < 1 && Math.abs(edge[1]) < 1 && Math.abs(edge[2]) < 1, `weapon edge in first-person frustum: ${edge}`);
   await page.screenshot({ path: resolve(output, `${name}-${id}-first.png`) });
   await act(page.getByRole('button', { name: 'First-person: on', exact: true }));
   results.push({ id, views, first });
  }
  assert.deepEqual(errors, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  verdict.viewports[name] = { passed: true, errors, results };
  await context.close();
 }
} catch (error) { verdict.ok = false; verdict.error = String(error.stack); process.exitCode = 1; }
finally { await browser.close(); writeFileSync(resolve(output, 'verdict.json'), JSON.stringify(verdict, null, 2)); }
console.log(JSON.stringify(verdict, null, 2));
