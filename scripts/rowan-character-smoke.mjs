// Bounded local Rowan acceptance. Disposable storage; real app and WebGL, no outline.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://127.0.0.1:8080';
const label = process.argv[3] ?? 'candidate';
assert(['localhost', '127.0.0.1'].includes(new URL(url).hostname));
assert.match(label, /^[a-z0-9-]+$/);
const out = path.resolve('art/verification/rowan-integration', label);
fs.mkdirSync(out, { recursive: true });
assert(!fs.existsSync(path.join(out, 'results.json')), 'Preserve previous run');
const report = { url, label, scope: 'Local real-app loaded-save fixture; creator UI, walk and bounded action samples, not all animations or performance certification', checks: [], errors: [], screenshots: [], requests: [] };
const flush = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
const check = (name, ok, data = {}) => { report.checks.push({ name, ok: !!ok, ...data }); flush(); assert(ok, name); };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
const watchdog = setTimeout(() => browser.close(), 240000);
const rejected = label.startsWith('failure');
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await context.routeWebSocket(/.*/, () => {});
  if (rejected) await context.route('**/art/character-reimagined/rowan.glb', route => { report.requests.push('rejected-rowan'); return route.abort('failed'); });
  const page = await context.newPage(); page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.url().endsWith('/rowan.glb')) report.requests.push({ url: response.url(), status: response.status() }); });
  const fixture = fs.readFileSync('public/art/phase1-review-save.json', 'utf8');
  await page.addInitScript(raw => { if (!localStorage.getItem('emberhall-save-v4')) localStorage.setItem('emberhall-save-v4', raw); }, fixture);
  await page.goto(url + '/?qa=1');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'playing');
  await page.evaluate(() => window.__ember.useGame.getState().speed(0));
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    const src = await (await fetch('/src/components/game/world-scene.tsx')).text();
    const match = src.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);
    window.__rowanFiber = await import(match[1]);
    window.__rowanWorld = window.__rowanFiber._roots.get(document.querySelector('canvas')).store.getState();
    const w = window.__ember.getWorld(), s = window.__ember.useGame.getState(), p = w.people.find(p => p.isPlayer);
    // Flat disposable scene, not the user's save. Retain one original NPC to verify policy.
    w.buildings = []; w.fauna = []; w.hour = 12;
    for (let z = 280; z <= 310; z++) for (let x = 240; x <= 275; x++) w.tiles[z][x].kind = 'grass';
    w.landRev++; p.x = 256; p.z = 296; p.path = []; p.facing = 0;
    const npc = w.people.find(p => !p.isPlayer); npc.x = 258; npc.z = 296; npc.path = [];
    w.people = [p, npc]; w.player.wear = {}; s.select(null); s.setPanel('none'); s.tick(0);
  });
  await page.waitForTimeout(1000);
  const inspect = async (mirror = false) => page.evaluate(mirror => {
    const state = mirror ? window.__rowanFiber._roots.get(document.querySelector('[data-testid="look-gump"] canvas')).store.getState() : window.__rowanWorld;
    const root = mirror ? state.scene : state.scene.getObjectByName('emberhall-player-figure');
    const meshes = [];
    root?.traverse(o => { if (o.isMesh) meshes.push({ name: o.geometry.name, type: o.geometry.type, vertices: o.geometry.attributes.position?.count ?? 0, color: o.material.color?.getHexString(), parent: o.parent.name, position: o.position.toArray(), matrix: o.matrixWorld.toArray() }); });
    let npcRowan = 0; state.scene.getObjectByName('emberhall-npc-figure')?.traverse(o => { if (o.isMesh && o.geometry.name.startsWith('rowan:')) npcRowan++; });
    const shoulders = root?.children.filter(o => Math.abs(Math.abs(o.position.x) - .32) < .0001).map(o => ({ x: o.position.x, rotation: o.rotation.toArray(), children: o.children.map(c => ({ geometry: c.geometry?.name, position: c.position.toArray(), children: c.children.length })) }));
    return { meshes, npcRowan, shoulders, yaw: root?.rotation.y };
  }, mirror);
  const screenshot = async name => { const target = path.join(out, name + '.png'); await page.screenshot({ path: target }); report.screenshots.push(target); flush(); };
  const body = await inspect();
  check('player-model-and-npc-isolation', body.meshes.some(m => m.name === 'rowan:head') === !rejected && body.npcRowan === 0, body);
  check('original-shoulder-anchors-retained', body.shoulders.length === 2 && body.shoulders.every(s => s.children.some(c => Math.abs(c.position[1] + .26) < .0001)), { shoulders: body.shoulders });
  await screenshot('desktop-world');
  // Real creator UI on the loaded disposable world (not procedural new-world onboarding).
  await page.evaluate(() => window.__ember.useGame.setState({ phase: 'looking' }));
  await page.getByTestId('look-name').fill('Rowan QA');
  await page.getByTestId('look-next').click(); await page.getByTestId('look-next').click();
  await page.waitForTimeout(800);
  const mirror = await inspect(true);
  check('creator-model-parity', mirror.meshes.some(m => m.name === 'rowan:head') === !rejected, mirror);
  await screenshot('desktop-creator');
  for (const style of ['bald', 'shag', 'tail', 'long', 'crop']) {
    await page.getByTestId('look-hairstyle-' + style).click(); await page.waitForTimeout(100);
    const data = await inspect(true);
    check('creator-hair-' + style, data.meshes.some(m => m.name === 'rowan:hair_cap') === (!rejected && style !== 'bald'));
  }
  for (const prefix of ['look-skin-', 'look-haircolor-', 'look-garb-']) await page.locator(`[data-testid^="${prefix}"]`).nth(2).click();
  await page.waitForTimeout(150);
  const chosen = await inspect(true);
  await screenshot('desktop-creator-custom');
  await page.getByTestId('look-done').click();
  await page.waitForFunction(() => window.__ember.useGame.getState().phase === 'playing');
  await page.waitForTimeout(500);
  const world = await inspect();
  if (!rejected) for (const part of ['head', 'torso', 'hair_cap']) check('selected-color-parity-' + part, chosen.meshes.find(m => m.name === 'rowan:' + part).color === world.meshes.find(m => m.name === 'rowan:' + part).color);
  check('look-saved', await page.evaluate(() => { const raw = localStorage.getItem('emberhall-save-v4'); return raw.includes('Rowan QA') && raw.includes('hairColor'); }));
  // Real walk command via useTile and normal fixed simulation steps, not root animation.
  const before = await page.evaluate(() => { const p = window.__ember.getWorld().people.find(p => p.isPlayer); window.__ember.useGame.getState().useTile(260, 296); return { x: p.x, z: p.z }; });
  await page.evaluate(() => { const s = window.__ember.useGame.getState(); s.speed(1); for (let i = 0; i < 8; i++) s.tick(.05); s.speed(0); });
  await page.waitForTimeout(150);
  const walking = await inspect();
  const after = await page.evaluate(() => { const p = window.__ember.getWorld().people.find(p => p.isPlayer); return { x: p.x, z: p.z, path: p.path.length, facing: p.facing }; });
  check('walk-displacement-and-facing', Math.hypot(after.x - before.x, after.z - before.z) > .01 && Math.cos(walking.yaw - after.facing - Math.PI) > .999, { before, after, shoulders: walking.shoulders });
  await screenshot('desktop-walk');
  // Bounded real hunt command with durable dummy target; retained equipment subtree.
  await page.evaluate(() => {
    const w = window.__ember.getWorld(), s = window.__ember.useGame.getState(), p = w.people.find(p => p.isPlayer);
    p.path = []; w.player.wear.main = 'sword';
    w.fauna.push({ id: 'rowan-qa-target', kind: 'deer', x: p.x + .7, z: p.z, hp: 999, maxHp: 999, path: [], task: 'idle', taskUntil: w.hour + 99, corpseUntil: 0, home: { tx: Math.floor(p.x), ty: Math.floor(p.z) }, ownerId: null, loyalty: 0, stay: false });
    s.hunt('rowan-qa-target'); s.speed(1); for (let i = 0; i < 4; i++) s.tick(.05); s.speed(0);
  });
  await page.waitForTimeout(500);
  const action = await inspect();
  check('action-shoulder-pose-and-equipment', action.shoulders.some((s, i) => Math.abs(s.rotation[0] - body.shoulders[i].rotation[0]) > .02) && action.shoulders.find(s => s.x > 0).children.some(c => c.children > 0 && !c.geometry), { shoulders: action.shoulders });
  await screenshot('desktop-action');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500); await screenshot('mobile-world');
  check('actual-asset-request', rejected ? report.requests.includes('rejected-rowan') : report.requests.some(r => r.status === 200), { requests: report.requests });
  check('no-uncaught-page-errors', report.errors.length === 0, { errors: report.errors });
  report.passed = true;
} catch (error) { report.passed = false; report.failure = error.stack; process.exitCode = 1; }
finally { clearTimeout(watchdog); flush(); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, failure: report.failure, out }));
