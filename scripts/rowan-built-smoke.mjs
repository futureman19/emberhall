// Built-output confirmation only. Detailed transform/pose evidence is in the dev harness.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://127.0.0.1:8137';
assert(['127.0.0.1', 'localhost'].includes(new URL(url).hostname) || (process.env.ROWAN_ALLOW_REMOTE === '1' && new URL(url).protocol === 'https:'));
const out = path.resolve(process.env.EMBERHALL_ARTIFACT_DIR, process.argv[3] ?? 'built-v1');
fs.mkdirSync(out, { recursive: true });
assert(!fs.existsSync(path.join(out, 'results.json')), 'Preserve evidence');
const report = { url, scope: 'Built app creator and player visual check, fresh storage; no Fiber source introspection', checks: [], errors: [], requests: [], screenshots: [] };
const flush = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
const check = (name, ok, data = {}) => { report.checks.push({ name, ok: !!ok, ...data }); flush(); assert(ok, name); };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const watchdog = setTimeout(() => browser.close(), 150000);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await context.routeWebSocket(/.*/, () => {});
  await context.route('**/*', route => {
    const request = route.request();
    // Read-only assets and anonymous session discovery; all network mutations denied.
    if (request.method() === 'GET') return route.continue();
    report.requests.push({ blocked: request.url(), method: request.method() });
    return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(25000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('response', r => { if (r.url().endsWith('/rowan.glb')) report.requests.push({ url: r.url(), status: r.status() }); });
  await page.addInitScript(raw => localStorage.setItem('emberhall-save-v4', raw), fs.readFileSync('public/art/phase1-review-save.json', 'utf8'));
  await page.goto(url + '/?qa=1');
  check('bundled-scripts', await page.locator('script[src*="/assets/"]').count() > 0);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'playing');
  await page.evaluate(() => { window.__ember.useGame.getState().speed(0); window.__ember.useGame.setState({ phase: 'looking' }); });
  await page.getByTestId('look-name').fill('Rowan Built QA');
  await page.getByTestId('look-next').click(); await page.getByTestId('look-next').click();
  await page.waitForLoadState('networkidle');
  const shot = async name => { const p = path.join(out, name + '.png'); await page.screenshot({ path: p }); report.screenshots.push(p); flush(); };
  for (const style of ['bald', 'shag', 'tail', 'long', 'crop']) await page.getByTestId('look-hairstyle-' + style).click();
  const colors = [];
  for (const prefix of ['look-skin-', 'look-haircolor-', 'look-garb-']) {
    const swatch = page.locator(`[data-testid^="${prefix}"]`).nth(2);
    colors.push(await swatch.evaluate(el => el.style.background)); await swatch.click();
  }
  report.chosenColors = colors;
  await shot('desktop-creator');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await shot('mobile-creator');
  await page.getByTestId('look-done').scrollIntoViewIfNeeded();
  check('mobile-creator-navigation-reachable', await page.getByTestId('look-done').evaluate(el => { const r=el.getBoundingClientRect(); return r.top>=0 && r.bottom<=innerHeight && el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }));
  await shot('mobile-creator-navigation');
  await page.getByTestId('look-done').click(); await page.waitForFunction(() => window.__ember.useGame.getState().phase === 'playing');
  await page.waitForTimeout(400); await shot('mobile-world');
  await page.setViewportSize({ width: 1440, height: 960 }); await page.waitForTimeout(300); await shot('desktop-world');
  const served = await page.request.get(url + '/art/character-reimagined/rowan.glb');
  const digest = b => createHash('sha256').update(b).digest('hex');
  const servedHash = digest(await served.body()), localHash = digest(fs.readFileSync('public/art/character-reimagined/rowan.glb'));
  check('built-rowan-identical-to-approved-asset', served.status() === 200 && servedHash === localHash, { servedHash, localHash });
  check('actual-renderer-rowan-request', report.requests.some(r => r.status === 200), { requests: report.requests });
  check('creator-finished-and-saved', await page.evaluate(() => localStorage.getItem('emberhall-save-v4').includes('Rowan Built QA')));
  const look = await page.evaluate(() => window.__ember.getWorld().people.find(p => p.isPlayer).look);
  const expectedColors = colors.map(color => '#' + color.match(/\d+/g).slice(0,3).map(value => Number(value).toString(16).padStart(2,'0')).join(''));
  const persistedLook = await page.evaluate(() => JSON.parse(localStorage.getItem('emberhall-save-v4')).people.find(p => p.isPlayer).look);
  check('appearance-saved', !!look && look.hairStyle === 'crop' && [look.skin,look.hairColor,look.garb].every((color,i) => color===expectedColors[i]) && JSON.stringify(look)===JSON.stringify(persistedLook), { look, persistedLook, expectedColors });
  await page.evaluate(() => {
    const w = window.__ember.getWorld(), s = window.__ember.useGame.getState(), p = w.people.find(p => p.isPlayer), healer = w.people.find(p => p.role === 'healer');
    w.buildings = []; w.fauna = []; // Retain monotonic hour: resource-node timestamps are validated.
    for (let z = 280; z <= 310; z++) for (let x = 240; x <= 275; x++) w.tiles[z][x].kind = 'grass';
    w.landRev++; p.x = 256; p.z = 296; p.path = []; p.facing = 0;
    healer.x = 258; healer.z = 296; healer.path = []; w.people = [p, healer];
    w.player.wear = {}; w.player.intent.kind = 'none'; w.player.poisonUntil = 0;
    for (const item of ['helm', 'mail', 'gauntlets', 'sword', 'shield']) w.player.pack[item] = 1;
    s.select(null); s.setPanel('none'); s.tick(0);
  });
  await page.waitForTimeout(400);
  const walking = await page.evaluate(() => {
    const s = window.__ember.useGame.getState(), w = window.__ember.getWorld(), p = w.people.find(p => p.isPlayer), before = p.x;
    s.useTile(260, 296); s.speed(1); for (let i = 0; i < 8; i++) s.tick(.05); s.speed(0);
    return { before, after: p.x, path: p.path.length };
  });
  check('native-walk', walking.after > walking.before, walking); await shot('desktop-walk');
  const equipped = await page.evaluate(() => {
    const s = window.__ember.useGame.getState(), w = window.__ember.getWorld(), p = w.people.find(p => p.isPlayer);
    p.path = []; for (const item of ['helm', 'mail', 'gauntlets', 'sword', 'shield']) s.equip(item);
    s.speed(1); for (let i = 0; i < 80; i++) s.tick(.05); s.speed(0); return {...w.player.wear};
  });
  check('native-equip-all-slots', ['helm','mail','gauntlets','sword','shield'].every(v => Object.values(equipped).includes(v)), { equipped });
  await page.waitForTimeout(400); await shot('desktop-equipped');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await shot('mobile-equipped');
  const action = await page.evaluate(() => {
    const w = window.__ember.getWorld(), s = window.__ember.useGame.getState(), p = w.people.find(p => p.isPlayer);
    w.fauna.push({ id: 'rowan-built-target', kind: 'hart', x: p.x + .7, z: p.z, hp: 999, maxHp: 999, path: [], task: 'idle', taskUntil: w.hour + 99, corpseUntil: 0, home: {tx: Math.floor(p.x), ty: Math.floor(p.z)}, ownerId: null, loyalty: 0, stay: false });
    s.hunt('rowan-built-target'); s.speed(1); for(let i=0;i<4;i++) s.tick(.05); s.speed(0); return {...w.player.intent};
  });
  check('action-fixture-save-valid', await page.evaluate(() => {window.__ember.useGame.getState().saveNow(); return !window.__ember.useGame.getState().saveError;}));
  check('native-action', action.kind === 'hunt', {action}); await page.waitForTimeout(300); await shot('mobile-action');
  const pre = await page.evaluate(() => {
    const w = window.__ember.getWorld(), p = w.people.find(p=>p.isPlayer), s = window.__ember.useGame.getState();
    w.fauna = []; w.player.intent.kind = 'none'; p.path = []; p.hp=1; w.player.poisonUntil=w.hour+1; w.player.poisonTickAt=w.hour; w.gold=90; s.tick(0);
    return {hp:p.hp, ghost:!!p.ghost, tx:Math.floor(p.x),ty:Math.floor(p.z)};
  });
  const ghost = await page.evaluate(() => {
    const s=window.__ember.useGame.getState(), w=window.__ember.getWorld(), p=w.people.find(p=>p.isPlayer);
    s.speed(1); s.tick(.05); s.speed(0); return {hp:p.hp,ghost:!!p.ghost,playerGhost:!!w.player.ghost,gold:w.gold,corpseAt:w.player.corpseAt};
  });
  check('native-seeded-poison-death', pre.hp===1 && !pre.ghost && ghost.hp===0 && ghost.ghost && ghost.playerGhost && ghost.gold===60 && ghost.corpseAt.tx===pre.tx && ghost.corpseAt.ty===pre.ty, {pre,ghost});
  await page.waitForTimeout(400); await shot('mobile-ghost');
  await page.evaluate(() => {const w=window.__ember.getWorld(); window.__ember.useGame.getState().select(w.people.find(p=>p.role==='healer').id);});
  await page.getByRole('button',{name:'Return me',exact:true}).click();
  check('healer-ui-restore', await page.evaluate(() => {const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer); return p.hp>0 && !p.ghost && !w.player.ghost;}));
  await page.evaluate(() => {const s=window.__ember.useGame.getState();s.select(null);s.setPanel('none');});
  await page.waitForTimeout(400); await shot('mobile-restored');
  await page.setViewportSize({width:1440,height:960}); await page.waitForTimeout(300); await shot('desktop-restored');
  check('restored-fixture-save-valid', await page.evaluate(() => { window.__ember.useGame.getState().saveNow();return !window.__ember.useGame.getState().saveError; }));
  check('no-page-console-errors', report.errors.length === 0, { errors: report.errors });
  report.bundles = [];
  for (const src of await page.locator('script[src*="/assets/"]').evaluateAll(nodes => nodes.map(n => n.src))) {
    const response = await page.request.get(src);
    report.bundles.push({ url: src, status: response.status(), sha256: digest(await response.body()) });
  }
  const fallback = await browser.newContext({ viewport: {width:390,height:844} });
  await fallback.routeWebSocket(/.*/, () => {});
  const failures = [], fallbackErrors = [];
  await fallback.route('**/*', route => route.request().method() === 'GET' ? route.continue() : route.abort());
  await fallback.route('**/art/character-reimagined/rowan.glb', route => { failures.push(route.request().url()); return route.abort('failed'); });
  const fp = await fallback.newPage(); fp.on('pageerror', e => fallbackErrors.push(e.message));
  await fp.addInitScript(raw => localStorage.setItem('emberhall-save-v4', raw), fs.readFileSync('public/art/phase1-review-save.json','utf8'));
  await fp.goto(url+'/?qa=1'); await fp.getByRole('button',{name:'Continue',exact:true}).click();
  await fp.waitForFunction(() => window.__ember?.useGame.getState().phase === 'playing');
  await fp.evaluate(() => {window.__ember.useGame.getState().speed(0);window.__ember.useGame.setState({phase:'looking'});});
  await fp.getByTestId('look-name').fill('Fallback QA');
  await fp.getByTestId('look-next').click(); await fp.getByTestId('look-next').click(); await fp.waitForTimeout(800);
  for (const [width,height,label] of [[390,844,'mobile'],[1440,960,'desktop']]) {
    await fp.setViewportSize({width,height}); await fp.waitForTimeout(300);
    const file=path.join(out,label+'-fallback-creator.png');await fp.screenshot({path:file});report.screenshots.push(file);
  }
  await fp.getByTestId('look-done').click();
  await fp.waitForFunction(() => window.__ember.useGame.getState().phase === 'playing'); await fp.waitForTimeout(400);
  const fallbackFile=path.join(out,'desktop-fallback-world.png');await fp.screenshot({path:fallbackFile});report.screenshots.push(fallbackFile);
  check('built-rejected-request-fallback-ui-survives', failures.length === 1 && fallbackErrors.length === 0 && await fp.evaluate(() => localStorage.getItem('emberhall-save-v4').includes('Fallback QA')), {failures,fallbackErrors,scope:'Visual fallback only; exact original geometry proven by dev context'});
  await fallback.close();
  report.passed = true;
} catch (e) { report.passed = false; report.failure = e.stack; process.exitCode = 1; }
finally { clearTimeout(watchdog); flush(); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, failure: report.failure, out }));
