import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createWorld } from '../src/game/world.ts';
import { encodeSave, SAVE_KEY, SANDBOX_SAVE_KEY } from '../src/game/save.ts';
import { ITEM_META, SKILL_META } from '../src/game/catalog.ts';
import { RESOURCE_CATALOG } from '../src/game/resources/catalog.ts';
import { SPELL_META } from '../src/game/magery.ts';
const url = process.argv[2] ?? 'http://127.0.0.1:8080';
const output = resolve(process.argv[3] ?? 'screenshots/godmode-dev');
mkdirSync(output, { recursive: true });
const normal = createWorld(1);
normal.gold = 1234;
const original = encodeSave(normal);
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const reports = [];
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width === 390, hasTouch: width === 390 });
    await context.routeWebSocket('**/*', () => {});
    await context.addInitScript(({ original, key }) => {
      if (!localStorage.getItem('godmode-qa-seeded')) {
        localStorage.setItem(key, original);
        localStorage.setItem('godmode-qa-seeded', '1');
      }
    }, { original, key: SAVE_KEY });
    const page = await context.newPage();
    const activate = async (locator) => { await locator.scrollIntoViewIfNeeded(); return width === 390 ? locator.tap() : locator.click(); };
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
    await page.screenshot({ path: resolve(output, `${width}-entry.png`) });
    await activate(page.getByRole('button', { name: 'Enter Godmode sandbox', exact: true }));
    await page.getByRole('button', { name: 'Godmode sandbox settings', exact: true }).waitFor({ timeout: 120000 });
    const settings = () => page.getByRole('button', { name: 'Settings — sound, graphics and the Vault', exact: true });
    const openSettings = async () => {
      const guide = page.getByRole('region', { name: 'Guide, journal and roster', exact: true });
      if (await guide.isVisible()) { await guide.focus(); await page.keyboard.press('Escape'); await guide.waitFor({ state: 'hidden' }); }
      await activate(settings());
    };
    await openSettings();
    await activate(page.getByRole('button', { name: 'Replenish sandbox supplies', exact: true }));
    const read = () => page.evaluate(({ normalKey, sandboxKey }) => ({ normal: localStorage.getItem(normalKey), sandbox: JSON.parse(localStorage.getItem(sandboxKey)) }), { normalKey: SAVE_KEY, sandboxKey: SANDBOX_SAVE_KEY });
    let saved = await read();
    assert.equal(saved.normal, original);
    assert.equal(saved.sandbox.sandbox, true);
    for (const id of Object.keys(ITEM_META)) assert.ok(saved.sandbox.player.pack[id] >= 99, id);
    for (const id of Object.keys(SKILL_META)) assert.equal(saved.sandbox.player.skills[id], 100, id);
    let stacks = 0;
    for (const d of Object.values(RESOURCE_CATALOG)) for (const f of d.forms) for (const q of d.qualityType === 'clarity' ? ['cracked','flawed','cut','flawless','perfect'] : ['rough','sound','choice','pristine']) {
      assert.ok(saved.sandbox.player.resources.stacks[`${d.id}:${f}:${q}`] >= 999); stacks++;
    }
    assert.equal(await page.getByText('The Vault', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Return to normal hall', exact: true }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(3500); // let the transient replenishment toast clear
    await page.screenshot({ path: resolve(output, `${width}-settings.png`) });
    await activate(page.getByRole('dialog', { name: 'Settings — sound, graphics and the Vault' }).getByRole('button', { name: 'Close', exact: true }));
    let castWorked = false;
    for (let attempt = 0; attempt < 3 && !castWorked; attempt++) {
      await activate(page.getByRole('button', { name: 'Spellbook', exact: true }));
      for (const spell of Object.values(SPELL_META)) assert.equal(await page.getByText(spell.label, { exact: true }).count(), 1, spell.label);
      await activate(page.getByRole('button', { name: /^Night Sight / }));
      await page.waitForTimeout(1500);
      await activate(page.getByRole('button', { name: 'Close', exact: true }));
      await openSettings();
      await activate(page.getByRole('button', { name: 'Replenish sandbox supplies', exact: true }));
      const castSave = (await read()).sandbox;
      castWorked = castSave.player.nightSightUntil > castSave.hour;
      await activate(page.getByRole('dialog', { name: 'Settings — sound, graphics and the Vault' }).getByRole('button', { name: 'Close', exact: true }));
    }
    assert.ok(castWorked, 'native Night Sight cast takes effect');
    await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
    await page.getByRole('button', { name: 'Godmode sandbox settings', exact: true }).waitFor({ timeout: 120000 });
    const guideAfterReload = page.getByRole('region', { name: 'Guide, journal and roster', exact: true });
    if (await guideAfterReload.isVisible()) { await guideAfterReload.focus(); await page.keyboard.press('Escape'); await guideAfterReload.waitFor({ state: 'hidden' }); }
    await page.screenshot({ path: resolve(output, `${width}-sandbox.png`) });
    assert.equal((await read()).normal, original);
    await openSettings();
    await activate(page.getByRole('button', { name: 'Return to normal hall', exact: true }));
    await settings().waitFor({ timeout: 120000 });
    assert.equal(await page.getByRole('button', { name: 'Godmode sandbox settings', exact: true }).count(), 0);
    saved = await read();
    assert.equal(saved.normal, original, 'normal bytes preserved through return');
    await openSettings();
    await activate(page.getByRole('button', { name: 'Enter Godmode sandbox', exact: true }));
    await page.getByRole('button', { name: 'Godmode sandbox settings', exact: true }).waitFor({ timeout: 120000 });
    const returned = JSON.parse((await read()).normal);
    assert.equal(returned.seed, normal.seed);
    assert.equal(returned.gold, normal.gold);
    assert.deepEqual(returned.player.pack, normal.player.pack);
    assert.deepEqual(returned.player.skills, normal.player.skills);
    assert.equal(returned.sandbox, undefined);
    assert.deepEqual(errors, []);
    reports.push({ width, items: Object.keys(ITEM_META).length, skills: Object.keys(SKILL_META).length, resourceStacks: stacks, spells: Object.keys(SPELL_META).length, nativeNightSight: castWorked, reload: true, returnPreserved: true, repeatSafe: true, errors });
    await context.close();
  }
  writeFileSync(resolve(output, 'verdict.json'), JSON.stringify({ url, reports }, null, 2));
  console.log(JSON.stringify({ url, reports }, null, 2));
} finally { await browser.close(); }
