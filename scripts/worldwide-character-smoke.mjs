// Disposable role/class lineup; no production save is read or modified.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const [url = 'http://127.0.0.1:8123', label = 'candidate'] = process.argv.slice(2);
assert(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
assert.match(label, /^[a-z0-9-]+$/);
const out = path.resolve('art/verification/worldwide', `characters-${label}`);
assert(!fs.existsSync(path.join(out, 'results.json')), 'Preserve previous evidence');
fs.mkdirSync(out, { recursive: true });
const report = { url, label, scope: 'Disposable 8-NPC lineup, desktop GPU with mobile viewport; not generated-world or phone performance certification', checks: [], errors: [], samples: [] };
const flush = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
const check = (name, ok, evidence = {}) => { report.checks.push({ name, ok: !!ok, ...evidence }); flush(); assert(ok, name); };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
const watchdog = setTimeout(() => browser.close(), 150000);
try {
  const context = await browser.newContext();
  await context.routeWebSocket(/.*/, () => {});
  if (label.startsWith('baseline')) await context.route('**/src/components/game/civic-character.ts', route => route.fulfill({ contentType: 'application/javascript', body: 'export function civicCharacterArt(p){return p.isPlayer || (p.home !== null && ["banker","provisioner","healer"].includes(p.role ?? "") && Math.hypot(p.home.tx-256,p.home.ty-292)<=18)};export function civicVisualYaw(f,a){return a?f+Math.PI:f}' }));
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });
  await page.addInitScript(raw => localStorage.setItem('emberhall-save-v4', raw), fs.readFileSync('public/art/phase1-review-save.json', 'utf8'));
  await page.goto(url + '/?qa=1');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'playing');
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    const src = await (await fetch('/src/components/game/world-scene.tsx')).text();
    const match = src.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);
    const fiber = await import(match[1]);
    window.__worldArt = fiber._roots.get(document.querySelector('canvas')).store.getState();
    const w = window.__ember.getWorld(), s = window.__ember.useGame.getState(), p = w.people.find(p => p.isPlayer);
    s.speed(0); w.hour = 12; w.fauna = []; w.buildings = []; p.x = 256; p.z = 299; p.path = [];
    const roles = ['banker', 'provisioner', 'healer', null, null, null, null, null];
    const classes = ['merchant', 'merchant', 'mage', 'ranger', 'warrior', 'mage', 'rogue', 'merchant'];
    const npcs = roles.map((role, i) => ({ ...structuredClone(p), id: 'world-art-npc-' + i, name: role ?? classes[i], isPlayer: false, cls: classes[i], role, look: undefined, home: i % 2 ? null : { tx: 80, ty: 80 }, x: 253 + (i % 4) * 2, z: 297 - Math.floor(i / 4) * 2, facing: i * Math.PI / 2, path: [], ghost: false }));
    w.people = [p, ...npcs]; s.select(null); s.setPanel('none'); s.tick(0);
    window.__worldArtExpected = JSON.stringify(npcs);
  });
  for (const [device, viewport] of [['desktop', { width: 1440, height: 960 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport); await page.waitForTimeout(1000);
    const data = await page.evaluate(() => {
      const w = window.__ember.getWorld(), scene = window.__worldArt.scene;
      const entries = w.people.filter(p => !p.isPlayer).map(p => {
        let group; scene.traverse(o => { if (o.name === 'emberhall-npc-figure' && Math.hypot(o.position.x - p.x, o.position.z - p.z) < 0.01) group = o; });
        const meshes = []; group?.traverse(o => { if (o.isMesh) meshes.push({ vertices: o.geometry.attributes.position?.count, type: o.geometry.type, geometry: o.geometry.uuid, color: o.material.color?.getHexString(), transparent: o.material.transparent }); });
        return { id: p.id, role: p.role, cls: p.cls, found: !!group, facing: p.facing, yaw: group?.rotation.y, authored: meshes.some(m => m.type !== 'BoxGeometry' && m.vertices > 24), meshes };
      });
      return { entries, unchanged: JSON.stringify(w.people.filter(p => !p.isPlayer)) === window.__worldArtExpected };
    });
    check(device + '-all-eight-present', data.entries.length === 8 && data.entries.every(e => e.found), data);
    check(device + '-simulation-records-preserved', data.unchanged);
    for (const row of data.entries) {
      check(`${device}-${row.id}-geometry-policy`, row.authored === !label.startsWith('baseline'));
      const expected = row.facing + (label.startsWith('baseline') ? 0 : Math.PI);
      check(`${device}-${row.id}-forward-axis`, Math.abs(Math.sin(row.yaw - expected)) < 1e-6 && Math.cos(row.yaw - expected) > .999);
    }
    await page.screenshot({ path: path.join(out, device + '.png') });
    const sample = await page.evaluate(() => new Promise(resolve => {
      const values = []; let last;
      function frame(t) { if (last !== undefined) values.push(t - last); last = t; if (values.length < 180) return requestAnimationFrame(frame); const sorted = [...values].sort((a, b) => a - b), gl = window.__worldArt.gl, ctx = gl.getContext(), ext = ctx.getExtension('WEBGL_debug_renderer_info'); resolve({ frames: values.length, p50: sorted[90], p95: sorted[171], drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, renderer: ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER), values }); }
      requestAnimationFrame(frame);
    }));
    report.samples.push({ device, ...sample }); flush();
  }
  check('no-page-console-shader-errors', report.errors.length === 0, { errors: report.errors });
  report.passed = true;
} catch (error) { report.passed = false; report.failure = error.stack; process.exitCode = 1; }
finally { clearTimeout(watchdog); flush(); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, failure: report.failure, out }));
