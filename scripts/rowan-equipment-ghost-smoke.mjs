// Bounded continuation: real equip commands and poison-tick death, never ghost flag toggles.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const url = process.argv[2];
const label = process.argv[3];
assert(['localhost', '127.0.0.1'].includes(new URL(url).hostname));
assert.match(label, /^[a-z0-9-]+$/);
const out = path.resolve(process.env.EMBERHALL_ARTIFACT_DIR, label);
fs.mkdirSync(out, { recursive: true });
assert(!fs.existsSync(path.join(out, 'results.json')), 'Never overwrite evidence');
const report = { url, label, scope: 'Fresh disposable save, seeded inventory and poison condition; native equip handlers, normal poison/death tick and real healer UI. Not natural combat acquisition or all equipment combinations.', checks: [], snapshots: {}, screenshots: [], errors: [], consoleErrors: [], requests: [] };
const flush = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
const check = (name, ok, data = {}) => { report.checks.push({ name, ok: !!ok, ...data }); flush(); };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const timer = setTimeout(() => browser.close(), 180000);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await context.routeWebSocket(/.*/, () => {});
  await context.route('**/*', route => route.request().method() === 'GET' ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('response', r => { if (r.url().endsWith('/rowan.glb')) report.requests.push({ url: r.url(), status: r.status() }); });
  await page.addInitScript(raw => { localStorage.clear(); localStorage.setItem('emberhall-save-v4', raw); }, fs.readFileSync('public/art/phase1-review-save.json', 'utf8'));
  await page.goto(url + '/?qa=1');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'playing');
  await page.evaluate(() => window.__ember.useGame.getState().speed(0));
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    const src = await (await fetch('/src/components/game/world-scene.tsx')).text();
    const match = src.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);
    const fiber = await import(match[1]);
    window.__rowanQA = fiber._roots.get(document.querySelector('canvas')).store.getState();
    const w = window.__ember.getWorld(), s = window.__ember.useGame.getState(), p = w.people.find(p => p.isPlayer), healer = w.people.find(p => p.role === 'healer');
    w.buildings = []; w.fauna = []; // Retain monotonic hour: resource-node timestamps are validated.
    for (let z = 280; z <= 310; z++) for (let x = 240; x <= 275; x++) w.tiles[z][x].kind = 'grass';
    w.landRev++; p.x = 256; p.z = 296; p.path = []; p.facing = 0;
    healer.x = 258; healer.z = 296; healer.path = []; w.people = [p, healer];
    w.player.wear = {}; w.player.intent.kind = 'none'; w.player.poisonUntil = 0;
    for (const item of ['hood', 'helm', 'cap', 'leather', 'mail', 'gloves', 'gauntlets', 'sword', 'shield', 'hatchet', 'heater']) w.player.pack[item] = 1;
    s.select(null); s.setPanel('none'); s.tick(0);
  });
  await page.waitForTimeout(700);
  const inspect = () => page.evaluate(() => {
    const w = window.__ember.getWorld(), p = w.people.find(p => p.isPlayer), scene = window.__rowanQA.scene, root = scene.getObjectByName('emberhall-player-figure');
    const meshes = [];
    root.traverse(o => {
      if (!o.isMesh) return;
      let visible = true, ancestor = o; const chain = [];
      while (ancestor && ancestor !== root) { visible &&= ancestor.visible; chain.push(ancestor.position.toArray()); ancestor = ancestor.parent; }
      meshes.push({ name: o.name, geometry: o.geometry.name, type: o.geometry.type, vertices: o.geometry.attributes.position?.count ?? 0, visible, chain, color: o.material.color?.getHexString(), opacity: o.material.opacity, transparent: o.material.transparent, depthWrite: o.material.depthWrite, emissive: o.material.emissive?.getHexString() });
    });
    let npcRowan = 0; scene.getObjectByName('emberhall-npc-figure')?.traverse(o => { if (o.isMesh && o.geometry.name.startsWith('rowan:')) npcRowan++; });
    return { meshes, npcRowan, ghost: !!p.ghost, playerGhost: !!w.player.ghost, hp: p.hp, wear: { ...w.player.wear }, corpseAt: w.player.corpseAt, gold: w.gold, piles: w.piles, shoulders: root.children.filter(o => Math.abs(Math.abs(o.position.x) - .32) < .0001).map(o => ({ position: o.position.toArray(), children: o.children.map(c => ({ position: c.position.toArray(), geometry: c.geometry?.name })) })) };
  });
  const capture = async name => { const file = path.join(out, name + '.png'); await page.screenshot({ path: file }); report.screenshots.push(file); flush(); };
  const snapshot = async name => { const data = await inspect(); report.snapshots[name] = data; flush(); return data; };
  const equip = async items => { await page.evaluate(items => { const s = window.__ember.useGame.getState(); for (const item of items) s.equip(item); s.speed(1); for (let i = 0; i < 80; i++) s.tick(.05); s.speed(0); }, items); await page.waitForTimeout(450); };
  const base = await snapshot('base');
  check('baseline-rowan-and-original-npc', base.meshes.some(m => m.geometry === 'rowan:head') && base.npcRowan === 0 && !base.ghost);
  for (const head of ['hood', 'helm', 'cap']) {
    await equip([head]); const data = await snapshot(head);
    check('headwear-' + head, data.wear.head === head && !data.meshes.some(m => m.geometry === 'rowan:hair_cap') && data.meshes.some(m => m.visible && m.color === ({ hood: '6a3a32', helm: '9a9286', cap: '6a4a32' })[head] && m.chain.length === 1), { wear: data.wear });
    await capture('desktop-' + head);
  }
  for (const [name, items, chest, hand] of [['leather-gloves', ['leather', 'gloves'], 'a85a42', 'c9a36a'], ['mail-gauntlets', ['mail', 'gauntlets'], '8a8680', '8a8680']]) {
    await equip(items); const data = await snapshot(name);
    check(name + '-rowan-materials', data.meshes.filter(m => m.geometry === 'rowan:torso' || m.geometry.startsWith('rowan:arm:')).length === 3 && data.meshes.filter(m => m.geometry === 'rowan:torso' || m.geometry.startsWith('rowan:arm:')).every(m => m.color === chest) && data.meshes.filter(m => m.geometry.startsWith('rowan:hand')).length === 2 && data.meshes.filter(m => m.geometry.startsWith('rowan:hand')).every(m => m.color === hand));
  }
  for (const [name, items, heldAt] of [['sword-shield', ['sword', 'shield'], [.02, -.44, .04]], ['hatchet-heater', ['hatchet', 'heater'], [.02, -.44, .04]]]) {
    await equip(items); const data = await snapshot(name);
    const near = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < .0001);
    const has = (m, pos) => m.chain.some(p => near(p, pos));
    check(name + '-attached-meshes', data.wear.main === items[0] && data.wear.off === items[1] && data.meshes.filter(m => m.visible && has(m, heldAt) && m.chain.some(p => Math.abs(p[0] - .32) < .0001)).length >= 2 && data.meshes.filter(m => m.visible && has(m, [-.02, -.28, .08]) && m.chain.some(p => Math.abs(p[0] + .32) < .0001)).length === 2);
    check(name + '-anchors-npc', data.npcRowan === 0 && data.shoulders.length === 2 && data.shoulders.every(s => s.children.some(c => near(c.position, [0, -.26, 0]))));
    await capture('desktop-' + name);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400); await capture('mobile-equipped');
  await page.setViewportSize({ width: 1440, height: 960 }); await page.waitForTimeout(300);
  // Seed a mortal poison condition, not a death/ghost flag. Native tick subtracts HP,
  // invokes dieAsGhost, creates corpse pile and applies gold spill atomically.
  const pre = await page.evaluate(() => {
    const w = window.__ember.getWorld(), p = w.people.find(p => p.isPlayer), s = window.__ember.useGame.getState();
    p.hp = 1; w.player.poisonUntil = w.hour + 1; w.player.poisonTickAt = w.hour; w.gold = 90;
    s.tick(0); return { hp: p.hp, ghost: !!p.ghost, gold: w.gold, corpseAt: w.player.corpseAt };
  });
  report.preDeath = pre; await capture('desktop-before-death');
  await page.evaluate(() => { const s = window.__ember.useGame.getState(); s.speed(1); s.tick(.05); s.speed(0); });
  await page.waitForTimeout(400); const ghost = await snapshot('ghost');
  check('native-poison-death-lifecycle', pre.hp === 1 && !pre.ghost && ghost.hp === 0 && ghost.ghost && ghost.playerGhost && ghost.gold === 60 && ghost.corpseAt?.tx === 256 && ghost.corpseAt?.ty === 296);
  const visible = ghost.meshes.filter(m => m.visible && m.type !== 'RingGeometry');
  check('ghost-rowan-and-equipment-translucency', visible.length > 10 && visible.some(m => m.geometry === 'rowan:head') && visible.every(m => m.transparent && m.opacity > 0 && m.opacity < 1 && !m.depthWrite), { visible });
  check('ghost-no-opaque-rowan-details', !ghost.meshes.some(m => m.name.startsWith('rowan-detail:')) && ghost.npcRowan === 0);
  await capture('desktop-ghost');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400); await capture('mobile-ghost');
  await page.evaluate(() => { const w = window.__ember.getWorld(); window.__ember.useGame.getState().select(w.people.find(p => p.role === 'healer').id); });
  await page.getByRole('button', { name: 'Return me', exact: true }).click();
  await page.evaluate(() => { const s = window.__ember.useGame.getState(); s.select(null); s.setPanel('none'); });
  await page.waitForTimeout(400); const restored = await snapshot('restored');
  check('healer-ui-restores-living-rowan', !restored.ghost && !restored.playerGhost && restored.hp > 0 && restored.meshes.some(m => m.name.startsWith('rowan-detail:')));
  const bodyMaterials = data => data.meshes.filter(m => m.geometry.startsWith('rowan:') && !m.name.startsWith('rowan-detail:')).map(({ geometry, color, opacity, transparent, depthWrite, emissive }) => ({ geometry, color, opacity, transparent, depthWrite, emissive }));
  check('restored-materials-exactly-match-equipped', JSON.stringify(bodyMaterials(restored)) === JSON.stringify(bodyMaterials(report.snapshots['hatchet-heater'])));
  await capture('mobile-restored');
  await page.setViewportSize({ width: 1440, height: 960 }); await page.waitForTimeout(400); await capture('desktop-restored');
  check('asset-request-and-runtime-errors', report.requests.some(r => r.status === 200) && report.errors.length === 0 && report.consoleErrors.length === 0);
  report.passed = report.checks.every(c => c.ok);
} catch (e) { report.passed = false; report.failure = e.stack; }
finally { clearTimeout(timer); flush(); await browser.close(); }
if (!report.passed) process.exitCode = 1;
console.log(JSON.stringify({ out, passed: report.passed, checks: report.checks.length, failures: report.checks.filter(c => !c.ok).map(c => c.name), failure: report.failure }));
