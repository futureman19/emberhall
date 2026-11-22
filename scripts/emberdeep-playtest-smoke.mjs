#!/usr/bin/env node
// Run: node --experimental-strip-types scripts/emberdeep-playtest-smoke.mjs http://127.0.0.1:PORT
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createWorld } from '../src/game/world.ts';
import { encodeSave, SAVE_KEY } from '../src/game/save.ts';
import { EMBERDEEP_ENTRY, EMBERDEEP_ROOMS } from '../src/game/emberdeep.ts';
import { dungeonSpawns } from '../src/game/furnace-warden.ts';
import { prepareVeteran } from './emberdeep-playtest-driver.mjs';

const url = process.argv[2] || process.env.EMBERDEEP_SMOKE_URL;
if (!url) throw new Error('Supply the explicitly allocated dev-server URL; no default shared port.');
const output = resolve(process.env.EMBERDEEP_SMOKE_OUTPUT_DIR || 'screenshots/emberdeep-playtest');
mkdirSync(output, { recursive: true });
const fixture = createWorld(41);
prepareVeteran(fixture, EMBERDEEP_ENTRY);
fixture.speed = 0;
fixture.weather.kind = 'rain'; fixture.weather.cloud = 1;
const raw = encodeSave(fixture);
const report = { url, passed: false, scope: 'Seed 41, 5000-HP veteran with sword and 100 swords/anatomy, positioned at entry ONCE. Real command paths, full live sim including hostile AI, all authored monsters at original HP. Native travel clicks, room clears, boss seal/victory, heart collection and save/reload. Not normal-character balance, physical-mobile or deployed proof.', runs: [], errors: [] };
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
  for (const [device, viewport] of [['desktop', { width: 1440, height: 960 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, hasTouch: device === 'mobile' });
    await context.routeWebSocket(/.*/, () => {});
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(`${device}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(`${device}: ${m.text()}`); });
    const target = new URL(url); target.searchParams.set('qa', '1');
    await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: SAVE_KEY, raw });
    await page.reload();
    const resume = async () => {
      await page.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 60000 });
      await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'playing', undefined, { timeout: 90000 });
      await page.evaluate(() => { const s = window.__ember.useGame.getState(); s.speed(0); s.setPanel('none'); s.closeCtx(); });
    };
    const capture = async name => {
      await page.waitForTimeout(700);
      const path = resolve(output, `${device}-${name}.png`);
      await page.screenshot({ path });
      return path;
    };
    const press = async name => {
      const button = page.getByRole('button', { name, exact: true });
      if (device === 'mobile') await button.tap(); else await button.click();
    };
    await resume();
    const run = { device, rooms: [], screenshots: [] }; report.runs.push(run);
    run.screenshots.push(await capture('entry'));
    assert.equal(await page.getByTestId('screen-rain').getAttribute('data-active'), 'true', 'fixture must exercise outdoor rain before entry');
    await press('Enter the Emberdeep');
    await page.waitForFunction(() => window.__ember.useGame.getState().snap.region.includes('Emberdeep'));
    assert.equal(await page.getByTestId('screen-rain').getAttribute('data-active'), 'false', 'underground rain must be hidden');
    await page.evaluate(async () => {
      const [driver, player, boss, piles] = await Promise.all([
        import('/scripts/emberdeep-playtest-driver.mjs'), import('/src/game/player.ts'),
        import('/src/game/furnace-warden.ts'), import('/src/game/piles.ts'),
      ]);
      const w = window.__ember.getWorld();
      window.__emberPlaytest = driver.createDriver(w, { ...player, ...boss, ...piles }, dt => window.__ember.useGame.getState().tick(dt));
      if (w.emberdeep.bossDoorOpen) throw new Error('Gate already open before kills');
    });
    for (const room of EMBERDEEP_ROOMS.filter(r => r.id !== 'furnace')) {
      console.log(`[${device}] ${room.id}`);
      run.rooms.push(await page.evaluate(room => {
        const s = window.__ember.useGame.getState();
        s.speed(1);
        try { window.__emberPlaytest.room(room); }
        finally { s.speed(0); }
        return { room: room.id, state: window.__ember.getWorld().emberdeep };
      }, room));
    }
    run.screenshots.push(await capture('unsealed'));
    await page.evaluate(() => {
      const s = window.__ember.useGame.getState(); s.speed(1);
      try { window.__emberPlaytest.boss(); } finally { s.speed(0); }
    });
    run.events = await page.evaluate(() => window.__emberPlaytest.events);
    assert.equal(await page.evaluate(() => window.__ember.getWorld().log.filter(e => /the furnace warden falls\./i.test(e.text)).length), 1, 'death announcement must not repeat');
    assert.equal(run.events.filter(e => e.action === 'kill').length, dungeonSpawns(fixture).length + 1);
    run.screenshots.push(await capture('victory'));
    assert.equal(await page.evaluate(() => window.__ember.useGame.getState().saveNow()), true);
    await page.reload(); await resume();
    run.restored = await page.evaluate(() => {
      const w = window.__ember.getWorld();
      return { heart: w.player.pack.furnace_heart, state: w.emberdeep, pendingHearts: w.piles.filter(p => p.items.furnace_heart).length };
    });
    assert.equal(run.restored.heart, 1);
    assert.equal(run.restored.pendingHearts, 0);
    assert.equal(run.restored.state.bossDefeated, true);
    assert.deepEqual(new Set(run.restored.state.cleared), new Set(EMBERDEEP_ROOMS.map(r => r.id)));
    for (const room of EMBERDEEP_ROOMS.filter(r => r.id !== 'furnace').reverse()) {
      await page.evaluate(async room => {
        const [driver, player] = await Promise.all([import('/scripts/emberdeep-playtest-driver.mjs'), import('/src/game/player.ts')]);
        const s = window.__ember.useGame.getState(); s.speed(1);
        try { driver.createDriver(window.__ember.getWorld(), player, dt => s.tick(dt)).walk(room.tx, room.ty); }
        finally { s.speed(0); }
      }, room);
    }
    await press('Leave the Emberdeep');
    await page.waitForFunction(() => !window.__ember.useGame.getState().snap.region.includes('Emberdeep'));
    run.exited = await page.evaluate(() => {
      const w = window.__ember.getWorld(), p = w.people.find(p => p.isPlayer);
      return { x: p.x, z: p.z, heart: w.player.pack.furnace_heart, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(run.exited.x, EMBERDEEP_ENTRY.tx); assert.equal(run.exited.z, EMBERDEEP_ENTRY.ty);
    assert.equal(run.exited.heart, 1); assert.equal(run.exited.overflow, false);
    run.screenshots.push(await capture('exit'));
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  writeFileSync(resolve(output, 'verdict.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
