// Eight-species disposable local arena: real render/input/simulation; no live save.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
const [url = 'http://127.0.0.1:8123', label = 'eight-v1', mode = 'candidate', only = 'all'] = process.argv.slice(2);
assert(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
assert.match(label, /^[a-z0-9-]+$/); assert(['candidate', 'baseline', 'failure'].includes(mode));
const species = ['hare', 'hart', 'pine_lynx', 'brine_seal', 'cavern_bat', 'stonefang_ogre', 'cinder_drake', 'grave_lich'];
const selected = only === 'all' ? species : only.split(',');
const catalogKinds = new Set(JSON.parse(fs.readFileSync('public/art/lanternwood/fauna-manifest.json', 'utf8')).species.map(s => s.kind));
assert(selected.length && selected.every(k => catalogKinds.has(k)) && new Set(selected).size === selected.length);
const out = path.resolve('art/verification/worldwide', label);
assert(!fs.existsSync(path.join(out, 'results.json')), 'Preserve previous runs'); fs.mkdirSync(out, { recursive: true });
const report = { mode, selected, scope: 'Selected catalog species in cleared disposable Greybarrow-edge arena with viewer outside pit fog, default gameplay camera. Real mouse/touch targeting, tickEcology path motion, tickPlayer strike/death. Preweakened target for bounded death check; not natural combat difficulty, habitat, full AI or phone-hardware acceptance.', checks: [], cases: [], errors: [], requests: [], hashes: Object.fromEntries(selected.map(k => [k, createHash('sha256').update(fs.readFileSync(`public/art/lanternwood/fauna-${k}.glb`)).digest('hex')])) };
const flush = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
const check = (name, ok, data = {}) => { report.checks.push({ name, ok: !!ok, ...data }); flush(); };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
const watchdog = setTimeout(() => browser.close(), 210000);
try {
  for (const [device, viewport] of [['desktop', { width: 1440, height: 960 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, hasTouch: device === 'mobile', deviceScaleFactor: 1 });
    await context.routeWebSocket(/.*/, () => {});
    if (mode === 'failure') await context.route('**/art/lanternwood/fauna-*.glb', route => { report.requests.push({ url: route.request().url(), status: 503, injected: true }); return route.fulfill({ status: 503, contentType: 'text/plain', body: 'Deliberate disposable fauna failure' }); });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push({ device, type: 'page', text: e.message }));
    page.on('console', m => { if (m.type() === 'error') report.errors.push({ device, type: 'console', text: m.text() }); });
    page.on('response', r => { if (/\/fauna-[^/]+\.glb$/.test(r.url()) && mode !== 'failure') report.requests.push({ url: r.url(), status: r.status() }); });
    await page.addInitScript(raw => localStorage.setItem('emberhall-save-v4', raw), fs.readFileSync('public/art/phase1-review-save.json', 'utf8'));
    await page.goto(url + '/?qa=1' + (mode === 'baseline' ? '&faunaArt=off' : ''));
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'playing');
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      const source = await (await fetch('/src/components/game/world-scene.tsx')).text();
      const match = source.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);
      const fiber = await import(match[1]);
      const [ecology, player, atlas, catalog] = await Promise.all([import('/src/game/ecology.ts'), import('/src/game/player.ts'), import('/src/game/atlas.ts'), import('/src/game/catalog.ts')]);
      window.__eight = { ...fiber._roots.get(document.querySelector('canvas')).store.getState(), ecology, player, atlas, catalog };
      const w = window.__ember.getWorld(), s = window.__ember.useGame.getState(), p = w.people.find(p => p.isPlayer);
      s.speed(0); w.hour = 12; w.buildings = []; w.houses = []; w.piles = []; w.herbs = []; w.plots = []; w.saplings = [];
      w.people = [p]; p.path = []; p.ghost = false; w.player.ghost = false;
      const x = atlas.BARROW.cx, z = atlas.BARROW.cy + 7;
      for (let y = z - 12; y <= z + 12; y++) for (let tx = x - 12; tx <= x + 12; tx++) w.tiles[y][tx].kind = 'dirt';
      w.landRev++; s.select(null); s.setPanel('none');
    });
    for (const kind of selected) {
      const id = `eight-${kind}`;
      await page.evaluate(({ kind, id }) => {
        const w = window.__ember.getWorld(), s = window.__ember.useGame.getState(), p = w.people[0];
        const { ecology, atlas } = window.__eight, x = atlas.BARROW.cx, z = atlas.BARROW.cy + 7;
        w.hour = 12; w.piles = []; p.x = x; p.z = z + 4; p.path = []; p.hp = p.maxHp;
        w.player.intent = { kind: 'none', tx: x, ty: z, targetId: null, spell: null }; w.player.workT = 0;
        w.fauna = [{ ...ecology.spawn(w, kind, x, z), id, task: 'wander', taskUntil: 999 }];
        s.closeCtx(); s.setPanel('none'); s.select(null); window.__ember.useGame.setState({ toast: null }); s.tick(.13);
      }, { kind, id });
      await page.waitForTimeout(700);
      if (mode === 'candidate') await page.waitForFunction(() => {
        const proxy = window.__eight.scene.getObjectByName('fauna-original-pick-proxy');
        return proxy && !proxy.visible && proxy.parent.children.some(o => o.name.startsWith('authored-'));
      }, null, { timeout: 10000 });
      const state = await page.evaluate(() => {
        const { scene, camera, gl } = window.__eight, proxy = scene.getObjectByName('fauna-original-pick-proxy'), root = proxy.parent;
        const art = root.children.find(o => o.name.startsWith('authored-'));
        const v = root.position.clone().project(camera), r = gl.domElement.getBoundingClientRect();
        const meshes = []; art?.traverse(o => { if (o.isMesh) meshes.push({ vertices: o.geometry.attributes.position.count, geometry: o.geometry.uuid }); });
        const g = gl.getContext(), ext = g.getExtension('WEBGL_debug_renderer_info');
        return { position: root.position.toArray(), art: !!art, proxyVisible: proxy.visible, meshes, click: { x: r.left + (v.x + 1) * r.width / 2, y: r.top + (1 - v.y) * r.height / 2 }, renderer: ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER) };
      });
      check(`${device}-${kind}-render-route`, state.art === (mode === 'candidate') && state.proxyVisible !== (mode === 'candidate'), state);
      await page.screenshot({ path: path.join(out, `${device}-${kind}-idle.png`) });
      // Actual canvas input, not direct hunt/ctx store invocation.
      if (device === 'desktop') {
        await page.mouse.click(state.click.x, state.click.y, { button: 'right' });
        const ctx = await page.evaluate(() => window.__ember.useGame.getState().ctx);
        check(`${device}-${kind}-right-click-target`, ctx?.target?.id === id, { ctx });
        await page.evaluate(() => window.__ember.useGame.getState().closeCtx());
        await page.mouse.click(state.click.x, state.click.y);
      } else await page.touchscreen.tap(state.click.x, state.click.y);
      const intent = await page.evaluate(() => window.__ember.getWorld().player.intent);
      check(`${device}-${kind}-hunt-input`, intent.kind === 'hunt' && intent.targetId === id, { intent });
      // Prescribed short route through real ecology stepping, no renderer position writes.
      const motion = [];
      for (let phase = 0; phase < 3; phase++) {
        const sample = await page.evaluate(phase => {
          const w = window.__ember.getWorld(), c = w.fauna[0], { ecology, catalog } = window.__eight;
          w.player.intent.kind = 'none'; w.people[0].path = [];
          if (!phase) c.path = [{ tx: c.x + 2, ty: c.z }];
          for (let i = 0; i < 5; i++) { w.hour += .04 / catalog.SECONDS_PER_HOUR; ecology.tickEcology(w, .04); }
          return { x: c.x, z: c.z, task: c.task };
        }, phase);
        await page.waitForTimeout(70);
        sample.render = await page.evaluate(() => window.__eight.scene.getObjectByName('fauna-original-pick-proxy').parent.position.toArray());
        motion.push(sample);
        if (phase === 2) await page.screenshot({ path: path.join(out, `${device}-${kind}-moving.png`) });
      }
      check(`${device}-${kind}-real-ecology-motion`, motion.every(m => Math.hypot(m.render[0] - m.x, m.render[2] - m.z) < .001) && motion[2].x > motion[0].x + .5, { motion });
      // Weak-target fixture: normal combat code must create the death, not a task override.
      const killed = await page.evaluate(() => {
        const w = window.__ember.getWorld(), c = w.fauna[0], p = w.people[0], { player, catalog } = window.__eight;
        c.hp = 1; c.path = []; p.x = c.x; p.z = c.z + 1; p.path = []; w.player.workT = 0;
        const rejected = player.commandHunt(w, c.id), oldRandom = Math.random;
        let note = null, steps = 0;
        try { Math.random = () => .25; for (; steps < 100 && c.task !== 'dead'; steps++) { w.hour += .05 / catalog.SECONDS_PER_HOUR; note = player.tickPlayer(w, .05) ?? note; } }
        finally { Math.random = oldRandom; }
        // Publish through normal store tick; do not replace the fauna array to hide stale subscriptions.
        window.__ember.useGame.getState().tick(.13);
        return { rejected, task: c.task, hp: c.hp, note, steps, corpseUntil: c.corpseUntil, hour: w.hour, effects: player.getCombatFx() };
      });
      await page.waitForTimeout(200);
      const corpse = await page.evaluate(() => { const p = window.__eight.scene.getObjectByName('fauna-original-pick-proxy'); return { rx: p.parent.rotation.x, visible: p.visible, art: p.parent.children.some(o => o.name.startsWith('authored-')) }; });
      check(`${device}-${kind}-combat-kill`, killed.rejected === null && killed.hp === 0 && killed.task === 'dead' && killed.effects?.targetId === id, { killed });
      check(`${device}-${kind}-actual-death-pose`, Math.abs(corpse.rx - Math.PI / 2) < 1e-6 && corpse.art === (mode === 'candidate'), { corpse });
      await page.screenshot({ path: path.join(out, `${device}-${kind}-dead.png`) });
      report.cases.push({ device, kind, state, motion, killed, corpse }); flush();
      console.log(`${mode} ${device} ${kind} recorded`);
    }
    await context.close();
  }
  const unexpected = report.errors.filter(e => !(mode === 'failure' && e.type === 'console' && e.text.includes('503')));
  check('no-unexpected-runtime-errors', unexpected.length === 0, { unexpected });
  check('exact-case-coverage', report.cases.length === selected.length * 2 && new Set(report.cases.map(c => `${c.device}:${c.kind}`)).size === selected.length * 2);
  report.passed = report.checks.every(c => c.ok); if (!report.passed) process.exitCode = 1;
} catch (error) { report.passed = false; report.failure = error.stack; process.exitCode = 1; }
finally { clearTimeout(watchdog); flush(); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, cases: report.cases.length, checks: report.checks.length, failed: report.checks.filter(c => !c.ok).map(c => c.name), failure: report.failure, out }));
