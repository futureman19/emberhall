import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const url = process.env.WEAPONS_SMOKE_URL || 'http://127.0.0.1:8080/';
const output = resolve(process.env.WEAPONS_SMOKE_OUTPUT || 'screenshots/pack2');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const verdict = { url, fixture: 'Real new world; paused player repositioned at forge with supplied materials and smithing 100; deterministic craft roll 0.5. Native controls perform crafting.', ok: true, viewports: {} };
try {
  for (const mobile of [false, true]) {
    const name = mobile ? 'mobile' : 'desktop';
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile });
    await context.routeWebSocket('**', () => {});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const act = async locator => { await locator.scrollIntoViewIfNeeded(); if (mobile) await locator.tap(); else await locator.click(); };
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__ember);
    await page.evaluate(() => window.__ember.useGame.getState().begin(false));
    await page.waitForFunction(() => window.__ember.useGame.getState().phase === 'playing', { timeout: 60000 });
    await page.evaluate(() => {
      const { getWorld, useGame } = window.__ember;
      useGame.getState().speed(0);
      const w = getWorld();
      const self = w.people.find(p => p.id === w.player.id);
      const forge = w.buildings.find(b => b.kind === 'forge');
      if (!self || !forge) throw new Error('missing fixture player/forge');
      self.x = forge.tx; self.z = forge.ty; self.path = []; self.task = 'idle';
      w.player.skills.smithing = w.player.skills.carpentry = 100;
      w.player.resources.stacks['highland_ore:ingot:choice'] = 20;
      w.player.resources.stacks['oak:board:sound'] = 20;
      w.player.resources.stacks['iron_ore:ingot:choice'] = 20;
      w.player.resources.stacks['ironwood:log:choice'] = 20;
      w.player.resources.stacks['common_cloth:cloth:sound'] = 20;
      Math.random = () => 0.5;
      useGame.getState().setPanel('none');
      useGame.setState({ openCraft: true });
      useGame.getState().tick(0.13);
    });
    const results = [];
    for (const [id, label, roles, keys, amounts, damage, hit, armor] of [
      ['mace', 'mace', ['body', 'hilt'], ['highland_ore:ingot:choice', 'oak:board:sound'], [6, 2], 10.5, 1, 0],
      ['war_hammer', 'war hammer', ['body', 'hilt'], ['highland_ore:ingot:choice', 'oak:board:sound'], [8, 3], 14.5, 1, 0],
      ['tower_shield', 'tower shield', ['plate', 'frame', 'binding'], ['iron_ore:ingot:choice', 'oak:board:sound', 'common_cloth:cloth:sound'], [6, 4, 2], 0, 0, 5.5],
      ['quarterstaff', 'quarterstaff', ['body', 'binding'], ['ironwood:log:choice', 'common_cloth:cloth:sound'], [5, 1], 7.5, 3, 0],
    ]) {
      if (id === 'quarterstaff') await page.evaluate(() => {
        const { getWorld, useGame } = window.__ember;
        const w = getWorld(), self = w.people.find(p => p.id === w.player.id), yard = w.buildings.find(b => b.kind === 'yard');
        self.x = yard.tx; self.z = yard.ty; useGame.getState().tick(.13);
      });
      const before = await page.evaluate(() => structuredClone(window.__ember.getWorld().player.resources.stacks));
      for (let i = 0; i < roles.length; i++) await act(page.locator(`input[name="material-${id}-${roles[i]}"][value="${keys[i]}"]`));
      const button = page.getByRole('button', { name: `Craft selected ${label}`, exact: true });
      await act(button);
      const state = await page.evaluate(id => {
        const w = window.__ember.getWorld();
        return { item: w.player.rares.find(r => r.base === id), resources: structuredClone(w.player.resources.stacks), toast: window.__ember.useGame.getState().toast };
      }, id);
      assert.equal(state.item?.formId, id);
      assert.equal(state.item?.workmanship, 'fine');
      assert.equal(state.item?.resolvedStats.damage, damage);
      assert.equal(state.item?.resolvedStats.hitBonus, hit);
      assert.equal(state.item?.resolvedStats.armor, armor);
      for (let i = 0; i < keys.length; i++) assert.equal(before[keys[i]] - (state.resources[keys[i]] ?? 0), amounts[i]);
      await page.screenshot({ path: resolve(output, `${name}-${id}.png`) });
      results.push({ id, state, nativeInput: mobile ? 'touch tap' : 'mouse click' });
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false); assert.deepEqual(errors, []);
    verdict.viewports[name] = { passed: true, errors, overflow, results };
    await context.close();
  }
} catch (error) { verdict.ok = false; verdict.error = String(error.stack); process.exitCode = 1; }
finally { await browser.close(); writeFileSync(resolve(output, 'verdict.json'), JSON.stringify(verdict, null, 2)); }
console.log(JSON.stringify(verdict, null, 2));
