import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:8080/';
const output = resolve(process.argv[3] ?? 'screenshots/equipment-interactions');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const reports = [];
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, isMobile: width === 390, hasTouch: width === 390 });
    await context.routeWebSocket('**/*', () => {});
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    await page.getByRole('button', { name: 'Enter Godmode sandbox', exact: true }).click();
    await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'playing');
    await page.getByRole('region', { name: 'Guide, journal and roster', exact: true }).waitFor();
    await page.evaluate(() => {
      const { useGame, getWorld } = window.__ember;
      const w = getWorld();
      w.player.pack = { sword: 99, mace: 99, bread: 99 };
      w.player.wear = { main: 'hatchet' }; w.player.wearRare = {};
      w.player.rares = [{ uid: 'equipment-native-rare', base: 'sword', affixes: ['of force'], seed: 19, hour: 1, workmanship: 'ordinary', components: [], inlays: [], recipeId: 'loot', recipeVersion: 1, source: 'loot' }];
      useGame.getState().speed(0);
      useGame.setState({ panel: 'you', toast: null });
    });
    await page.getByTestId('you-drawer').waitFor();
    await page.waitForTimeout(600);
    const read = () => page.evaluate(() => {
      const w = window.__ember.getWorld(); const p = w.people.find(p => p.isPlayer);
      return { pack: w.player.pack, wear: w.player.wear, wearRare: w.player.wearRare, rares: w.player.rares, piles: w.piles, x: p.x, z: p.z, path: p.path, task: p.task };
    });
    const settle = async () => { await page.waitForTimeout(120); await page.evaluate(() => window.__ember.useGame.setState({ toast: null })); };
    const main = page.locator('[data-equipment-target="main"]');
    const head = page.locator('[data-equipment-target="head"]');
    const grid = page.getByTestId('pack-grid');
    const item = id => page.locator(`[data-equipment-item="${id}"]`);
    const rare = page.locator('[data-equipment-rare="equipment-native-rare"]');
    const action = verb => page.getByTestId('equipment-actions').getByRole('button', { name: verb, exact: true });
    const tabTo = async (locator, key = 'Tab') => {
      for (let i = 0; i < 40; i++) {
        if (await locator.evaluate(el => el === document.activeElement)) return;
        await page.keyboard.press(key);
      }
      assert.fail('keyboard target not reachable by tab traversal');
    };
    const before = await read();
    const drag = async (source, target, inspect = false, cancel = false) => {
      await source.scrollIntoViewIfNeeded();
      const a = await source.boundingBox(); const b = await target.boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down(); await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2, { steps: 4 });
      await page.mouse.move(b.x + b.width / 2, b.y + Math.min(22, b.height / 2), { steps: 12 });
      if (inspect) {
        assert.equal(await main.getAttribute('data-drop-state'), 'valid');
        assert.equal(await head.getAttribute('data-drop-state'), 'invalid');
        assert.notEqual(await main.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
        await page.screenshot({ path: resolve(output, 'desktop-drop-feedback.png') });
      }
      if (cancel) await page.keyboard.press('Escape');
      await page.mouse.up(); await settle();
    };
    if (width === 1280) {
      await drag(item('sword'), head);
      assert.deepEqual(await read(), before, 'incompatible drop changes nothing');
      await drag(item('sword'), main, true, true);
      assert.deepEqual(await read(), before, 'Escape cancels drag');
      await drag(item('sword'), main);
      let state = await read(); assert.equal(state.wear.main, 'sword'); assert.equal(state.pack.sword, 98); assert.equal(state.pack.hatchet, 1);
      await drag(main, grid);
      state = await read(); assert.equal(state.wear.main, undefined); assert.equal(state.pack.sword, 99);
      await item('mace').dblclick(); await settle(); assert.equal((await read()).wear.main, 'mace');
      await main.dblclick(); await settle(); assert.equal((await read()).pack.mace, 99);
      await rare.click({ button: 'right' });
      await page.getByRole('menuitem', { name: /^Equip / }).click(); await settle();
      assert.equal((await read()).wearRare.main, before.rares[0].uid);
      assert.equal(await rare.count(), 0, 'worn rare is not also shown in backpack');
      await main.click({ button: 'right' });
      await page.screenshot({ path: resolve(output, 'desktop-stow-menu.png') });
      await page.getByRole('menuitem', { name: /^Stow / }).click(); await settle();
      assert.equal((await read()).wearRare.main, undefined);
      await rare.dblclick(); await settle();
      await main.dblclick(); await settle();
      assert.equal((await read()).wearRare.main, undefined, 'double-click stows an equipped rare once');
      await rare.dblclick(); await settle();
      await drag(item('sword'), main);
      assert.equal((await read()).wearRare.main, undefined); assert.equal(await rare.count(), 1);
      await drag(rare, main); await drag(main, grid);
      assert.deepEqual((await read()).rares, before.rares);
      await page.getByTestId('you-drawer').focus(); await tabTo(item('sword')); await page.keyboard.press('Enter');
      await tabTo(action('Equip'), 'Shift+Tab'); await page.keyboard.press('Enter'); await settle();
      assert.equal((await read()).wear.main, 'sword');
      await tabTo(main, 'Shift+Tab'); await page.keyboard.press('Space');
      await tabTo(action('Stow'), 'Shift+Tab'); await page.keyboard.press('Enter'); await settle();
      assert.equal((await read()).pack.sword, 99);
      await item('sword').click({ button: 'right' });
      await page.getByRole('menuitem', { name: /^Equip / }).click(); await settle();
      await main.click({ button: 'right' });
      await page.getByRole('menuitem', { name: /^Stow / }).click(); await settle();
      assert.equal((await read()).pack.sword, 99, 'ordinary gear also uses the context menu');
      await item('sword').click({ button: 'right' }); await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('menu').count(), 0);
      await item('sword').click({ button: 'right' }); await page.mouse.click(300, 400);
      assert.equal(await page.getByRole('menu').count(), 0, 'outside click dismisses without reaching the world');
    } else {
      for (const source of [item('sword'), rare]) {
        await source.tap(); await action('Equip').tap(); await settle();
        await main.tap(); await action('Stow').tap(); await settle();
      }
      assert.equal((await read()).pack.sword, 99);
      assert.deepEqual((await read()).rares, before.rares);
      const initial = await read();
      const box = await item('mace').boundingBox();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 15, y: box.y + 15 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 15, y: box.y - 140 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.deepEqual(await read(), initial, 'phone scroll never equips');
    }
    const after = await read();
    const ordinaryTotals = state => {
      const totals = { ...state.pack };
      for (const id of Object.values(state.wear)) if (id) totals[id] = (totals[id] ?? 0) + 1;
      return totals;
    };
    assert.deepEqual(ordinaryTotals(after), ordinaryTotals(before), 'all ordinary gear conserved across swaps');
    assert.deepEqual(after.rares, before.rares);
    assert.deepEqual(after.piles, before.piles, 'stow never drops to world');
    assert.equal(after.x, before.x); assert.equal(after.z, before.z);
    assert.deepEqual(after.path, before.path); assert.equal(after.task, before.task, 'equipment input never queues a world action');
    await page.evaluate(() => { const { getWorld, useGame } = window.__ember; getWorld().player.ghost = true; getWorld().people.find(p => p.isPlayer).ghost = true; useGame.getState().speed(0); });
    const ghostBefore = await read();
    await item('sword').dblclick(); await settle();
    assert.deepEqual(await read(), ghostBefore, 'ghost cannot transfer');
    assert.equal(await item('sword').getAttribute('draggable'), 'false');
    await page.evaluate(() => { const { getWorld, useGame } = window.__ember; getWorld().player.ghost = false; getWorld().people.find(p => p.isPlayer).ghost = false; useGame.getState().speed(0); });
    await page.getByTestId('you-drawer').getByRole('button', { name: 'Put the paperdoll away' }).scrollIntoViewIfNeeded();
    await page.mouse.move(10, 500);
    await page.getByTestId('you-drawer').focus();
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(output, `${width}-paperdoll.png`) });
    assert.deepEqual(errors, []);
    reports.push({ width, nativeDrag: width === 1280, tapFallback: width === 390, rareIdentity: true, ghostGuard: true, noWorldDrop: true, errors });
    await context.close();
  }
  writeFileSync(resolve(output, 'verdict.json'), JSON.stringify({ url, reports }, null, 2));
  console.log(JSON.stringify({ url, reports }, null, 2));
} finally { await browser.close(); }
