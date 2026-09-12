// Built-output check, no /src imports or speculative bundled React traversal.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PerspectiveCamera, Vector3 } from 'three';
import { chromium } from 'playwright';
const [url = 'http://127.0.0.1:8124', label = 'eight-built-v1', only = 'original'] = process.argv.slice(2);
assert(['127.0.0.1', 'localhost'].includes(new URL(url).hostname)); assert.match(label, /^[a-z0-9-]+$/);
const original = ['hare', 'hart', 'pine_lynx', 'brine_seal', 'cavern_bat', 'stonefang_ogre', 'cinder_drake', 'grave_lich'];
const species = only === 'original' ? original : only.split(',');
const catalogKinds = new Set(JSON.parse(fs.readFileSync('public/art/lanternwood/fauna-manifest.json', 'utf8')).species.map(s => s.kind));
assert(species.length && species.every(k => catalogKinds.has(k)) && new Set(species).size === species.length);
const out = path.resolve('art/verification/worldwide', label); assert(!fs.existsSync(path.join(out, 'results.json'))); fs.mkdirSync(out, { recursive: true });
const report = { url, selected: species, scope: 'Built output: GLB HTTP/hash, default-camera screenshots and actual mouse/touch hunt input for selected disposable catalog creatures. No bundled mesh counts or FPS claim.', checks: [], errors: [], captures: [] };
const flush = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
const check = (name, ok, data = {}) => { report.checks.push({ name, ok: !!ok, ...data }); flush(); assert(ok, name); };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
try {
 for (const [device, viewport] of [['desktop', { width: 1440, height: 960 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport, hasTouch: device === 'mobile' }); await ctx.routeWebSocket(/.*/, () => {});
  const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.addInitScript(raw => localStorage.setItem('emberhall-save-v4', raw), fs.readFileSync('public/art/phase1-review-save.json', 'utf8'));
  await page.goto(url + '/?qa=1'); await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'playing' && window.__emberCamera); await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    const w = window.__ember.getWorld(), s = window.__ember.useGame.getState(), p = w.people.find(p => p.isPlayer);
    s.speed(0); w.hour = 12; w.people = [p]; w.buildings = []; w.piles = []; w.herbs = []; w.plots = []; w.saplings = [];
    for (let z = 435; z <= 459; z++) for (let x = 98; x <= 122; x++) w.tiles[z][x].kind = 'dirt';
    w.landRev++; window.__builtCreatureTemplate = structuredClone(w.fauna[0]);
  });
  for (const kind of species) {
    const response = await ctx.request.get(url + `/art/lanternwood/fauna-${kind}.glb`);
    const bytes = await response.body(), local = fs.readFileSync(`public/art/lanternwood/fauna-${kind}.glb`);
    check(`${device}-${kind}-built-asset`, response.ok() && createHash('sha256').update(bytes).digest('hex') === createHash('sha256').update(local).digest('hex'), { status: response.status(), bytes: bytes.length });
    await page.evaluate(kind => {
      const w = window.__ember.getWorld(), s = window.__ember.useGame.getState(), p = w.people[0];
      p.x = 110; p.z = 451; p.path = []; w.player.intent.kind = 'none'; w.player.workT = 0;
      w.fauna = [{ ...window.__builtCreatureTemplate, id: 'built-' + kind, kind, x: 110, z: 447, task: 'wander', taskUntil: 999, path: [], hp: 100, maxHp: 100, home: { tx: 110, ty: 447 } }];
      s.closeCtx(); s.select(null); s.setPanel('none'); s.flash(''); s.tick(.13);
    }, kind);
    await page.waitForTimeout(700);
    const view = await page.evaluate(() => {
      const w = window.__ember.getWorld(), t = w.tiles[447][110], h = (t.h * 4 + w.tiles[447][109].h + w.tiles[447][111].h + w.tiles[446][110].h + w.tiles[448][110].h) / 8 * .2;
      const r = document.querySelector('canvas').getBoundingClientRect();
      return { camera: window.__emberCamera.getCamera(), target: window.__emberCamera.getTarget(), ground: h, rect: { x: r.x, y: r.y, width: r.width, height: r.height } };
    });
    // Source camera contract is fov48/near.2/far480; public QA probe supplies actual pose.
    const cam = new PerspectiveCamera(48, view.rect.width / view.rect.height, .2, 480);
    cam.position.set(view.camera.x, view.camera.y, view.camera.z); cam.lookAt(view.target.x, view.target.y, view.target.z); cam.updateMatrixWorld(true);
    const point = new Vector3(110, view.ground, 447).project(cam), x = view.rect.x + (point.x + 1) * view.rect.width / 2, y = view.rect.y + (1 - point.y) * view.rect.height / 2;
    const image = `${device}-${kind}.png`; await page.screenshot({ path: path.join(out, image) }); report.captures.push(image);
    if (device === 'mobile') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    const intent = await page.evaluate(() => window.__ember.getWorld().player.intent);
    check(`${device}-${kind}-built-input`, intent.kind === 'hunt' && intent.targetId === 'built-' + kind, { intent, x, y, view });
  }
  await ctx.close();
 }
 check('no-page-console-shader-errors', report.errors.length === 0, { errors: report.errors });
 check('all-selected-on-both-layouts', report.captures.length === species.length * 2 && new Set(report.captures).size === species.length * 2);
 report.passed = true;
} catch (e) { report.passed = false; report.failure = e.stack; process.exitCode = 1; }
finally { flush(); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, failure: report.failure, out }));
