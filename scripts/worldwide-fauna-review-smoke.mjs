// Bounded local review regression: real input, rejection fallback and draw attribution.
// All worlds and storage below are disposable; no live save/account is used.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const [url = 'http://127.0.0.1:8123', label = 'review-v1'] = process.argv.slice(2);
assert(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
assert.match(label, /^[a-z0-9-]+$/);
const out = path.resolve('art/verification/worldwide', label);
assert(!fs.existsSync(path.join(out, 'results.json')), 'Never overwrite old evidence');
fs.mkdirSync(out, { recursive: true });
const report = { scope: 'One disposable wolf on desktop and mobile viewport; actual input and isolated submission count, NOT all-species/gameplay/FPS acceptance', checks: [], errors: [], captures: [] };
const flush = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
const check = (name, ok, data = {}) => { report.checks.push({ name, ok: !!ok, ...data }); flush(); assert(ok, name); };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
const watchdog = setTimeout(() => browser.close(), 150000);
try {
  for (const mode of ['candidate', 'network-failure']) {
    const context = await browser.newContext();
    await context.routeWebSocket(/.*/, () => {});
    let failedRequests = 0;
    if (mode === 'network-failure') await context.route('**/art/lanternwood/fauna-*.glb', route => { failedRequests++; return route.fulfill({ status: 503, contentType: 'text/plain', body: 'intentional disposable network-failure test' }); });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ mode, type: 'pageerror', text: error.message }));
    page.on('console', msg => { if (msg.type() === 'error') report.errors.push({ mode, type: 'console', text: msg.text() }); });
    await page.addInitScript(raw => localStorage.setItem('emberhall-save-v4', raw), fs.readFileSync('public/art/phase1-review-save.json', 'utf8'));
    await page.goto(url + '/?qa=1');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'playing');
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      const src = await (await fetch('/src/components/game/world-scene.tsx')).text();
      const match = src.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);
      const fiber = await import(match[1]);
      window.__review = fiber._roots.get(document.querySelector('canvas')).store.getState();
      const w = window.__ember.getWorld(), s = window.__ember.useGame.getState(), p = w.people.find(p => p.isPlayer);
      s.speed(0); w.hour = 12; w.buildings = []; w.houses = []; w.piles = []; w.herbs = [];
      w.people = [p]; p.x = 256; p.z = 299; p.path = [];
      for (let y = 291; y <= 303; y++) for (let x = 250; x <= 262; x++) w.tiles[y][x].kind = 'dirt';
      const template = structuredClone(w.fauna[0]);
      w.fauna = [{ ...template, id: 'review-wolf', kind: 'wolf', x: 256, z: 295, path: [], task: 'idle', taskUntil: 999, hp: 100, maxHp: 100, ownerId: null, home: { tx: 256, ty: 295 } }];
      s.select(null); s.setPanel('none'); s.tick(0);
    });
    await page.waitForLoadState('networkidle');
    for (const [device, viewport] of [['desktop', { width: 1440, height: 960 }], ['mobile', { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(600);
      const data = await page.evaluate(() => {
        const { scene, camera, gl } = window.__review;
        const proxy = scene.getObjectByName('fauna-original-pick-proxy');
        const root = proxy.parent, art = root.children.find(o => o.name.startsWith('authored-'));
        const originalMeshes = []; proxy.traverse(o => { if (o.isMesh) originalMeshes.push(o); });
        // Same frozen scene rendered twice. The control reproduces reviewed colorWrite=false
        // original bodies without committing that behavior; restore every property in finally.
        const saved = originalMeshes.map(o => ({ o, material: o.material, castShadow: o.castShadow, receiveShadow: o.receiveShadow }));
        const priorVisible = proxy.visible, priorShadow = gl.shadowMap.enabled;
        let candidate, control;
        try {
          gl.shadowMap.enabled = false;
          gl.render(scene, camera); candidate = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
          if (art) {
            for (const row of saved) { row.o.material = row.material.clone(); row.o.material.colorWrite = false; row.o.material.depthWrite = false; row.o.castShadow = false; row.o.receiveShadow = false; }
            proxy.visible = true;
          }
          gl.render(scene, camera); control = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
        } finally {
          for (const row of saved) { if (row.o.material !== row.material) row.o.material.dispose(); row.o.material = row.material; row.o.castShadow = row.castShadow; row.o.receiveShadow = row.receiveShadow; }
          proxy.visible = priorVisible; gl.shadowMap.enabled = priorShadow;
        }
        const pos = root.position.clone().project(camera), rect = gl.domElement.getBoundingClientRect();
        return { proxyVisible: proxy.visible, art: !!art, originalMeshes: originalMeshes.length, candidate, control, click: { x: rect.left + (pos.x + 1) * rect.width / 2, y: rect.top + (1 - pos.y) * rect.height / 2 } };
      });
      check(`${mode}-${device}-visibility-and-fallback`, mode === 'candidate' ? data.art && !data.proxyVisible : !data.art && data.proxyVisible, data);
      if (mode === 'candidate') check(`${device}-removed-original-draws`, data.control.calls - data.candidate.calls === data.originalMeshes, data);
      await page.screenshot({ path: path.join(out, `${mode}-${device}.png`) });
      report.captures.push(`${mode}-${device}.png`); flush();
      // Existing fauna action path uses ground coordinates, not decorative mesh handlers.
      await page.mouse.click(data.click.x, data.click.y, { button: 'right' });
      const target = await page.evaluate(() => window.__ember.useGame.getState().ctx);
      check(`${mode}-${device}-real-context-pointer`, JSON.stringify(target).includes('review-wolf'), { target, click: data.click });
      await page.keyboard.press('Escape');
      await page.evaluate(() => { const s = window.__ember.useGame.getState(); s.closeCtx(); });
      // Existing animated root must still handle a dead-state transition without proxy redraw.
      await page.evaluate(() => { const w = window.__ember.getWorld(); w.fauna = w.fauna.map(c => ({ ...c, task: 'dead', corpseUntil: 999 })); window.__ember.useGame.getState().tick(0); });
      await page.waitForTimeout(150);
      const dead = await page.evaluate(() => { const p = window.__review.scene.getObjectByName('fauna-original-pick-proxy'); return { rotationX: p.parent.rotation.x, proxy: p.visible }; });
      check(`${mode}-${device}-dead-root-preserved`, Math.abs(dead.rotationX - Math.PI / 2) < 1e-6 && dead.proxy === (mode !== 'candidate'), dead);
      await page.evaluate(() => { const w = window.__ember.getWorld(); w.fauna = w.fauna.map(c => ({ ...c, task: 'idle' })); window.__ember.useGame.getState().tick(0); });
    }
    if (mode === 'network-failure') check('actual-request-rejection-exercised', failedRequests > 0, { failedRequests });
    await context.close();
  }
  const unexpected = report.errors.filter(e => !(e.mode === 'network-failure' && e.type === 'console' && e.text.includes('503')));
  check('no-unexpected-page-console-shader-errors', unexpected.length === 0, { unexpected });
  report.passed = true;
} catch (error) { report.passed = false; report.failure = error.stack; process.exitCode = 1; }
finally { clearTimeout(watchdog); flush(); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, failure: report.failure, out }));
