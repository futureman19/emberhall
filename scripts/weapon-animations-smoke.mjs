import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const url = process.argv[2] || 'http://127.0.0.1:8080/';
if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(url).hostname)) throw Error('Local-only animation QA');
const output = resolve(process.argv[3] || 'screenshots/weapon-animations');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const verdict = { ok: false, url, fixture: 'Paused real world, supplied weapons and durable target in cleared arena. Native Pack equip/stow; store hunt and bounded ticks. Runtime renderer transforms, desktop and emulated touch (not physical phone).', viewports: [] };
try {
  for (const mobile of [false, true]) {
    const name = mobile ? 'mobile' : 'desktop';
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile });
    await context.routeWebSocket('**', () => {});
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const act = async l => { await l.scrollIntoViewIfNeeded(); if (mobile) await l.tap(); else await l.click(); };
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__ember);
    await page.evaluate(() => window.__ember.useGame.getState().begin(false));
    await page.waitForFunction(() => window.__ember.useGame.getState().phase === 'playing', null, { timeout: 60000 });
    await page.evaluate(() => {
      const { getWorld, useGame } = window.__ember;
      const s = useGame.getState(); s.speed(0); s.setPanel('none');
      const w = getWorld(); const self = w.people.find(p => p.isPlayer);
      self.x = 324; self.z = 340; self.path = []; self.task = 'idle'; self.facing = Math.PI / 2;
      for (let z = 328; z <= 352; z++) for (let x = 312; x <= 336; x++) { const tile = w.tiles[z][x]; tile.kind = 'grass'; tile.h = 2; }
      w.landRev++; w.hour = 12;
      w.weather.kind = 'clear'; w.weather.untilHour = 100;
      w.player.pack.dagger = 1; w.player.pack.spear = 1; w.player.pack.war_axe = 1;
      w.player.skills.swords = 100;
      w.fauna.push({ id: 'weapon-qa-target', kind: 'wolf', x: 325.3, z: 340, hp: 9999, maxHp: 9999, path: [], task: 'idle', taskUntil: 999, corpseUntil: 0, home: { tx: 325, ty: 340 }, ownerId: null, loyalty: 0, stay: false });
      // One identity: the application-owned bridge works in dev AND built output.
      window.__weaponTick = s.tick;
      s.tick(0.13);
      useGame.setState({ tick: () => {} });
    });
    await page.waitForTimeout(1500);
    // Locate the existing R3F root; no production debug API or duplicate module imports.
    await page.waitForSelector('canvas');
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      const source = new URL(location.href).port === '8080' ? await (await fetch('/src/components/game/world-scene.tsx')).text() : '';
      const match = source.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);
      if (match) {
        const fiber = await import(match[1]);
        for (const canvas of document.querySelectorAll('canvas')) {
          const state = fiber._roots?.get(canvas)?.store?.getState();
          if (state) { window.__weaponScene = state; return; }
        }
      }
      const queue = []; const seen = new Set();
      for (const canvas of document.querySelectorAll('canvas')) for (let n = canvas; n; n = n.parentElement) for (const k of Object.keys(n)) if (k === '__r3f' || k.startsWith('__reactFiber') || k.startsWith('__reactContainer')) queue.push(n[k]);
      while (queue.length && seen.size < 80000) {
        const o = queue.shift(); if (!o || !['object', 'function'].includes(typeof o) || seen.has(o)) continue; seen.add(o);
        if (o.scene?.isScene && o.camera && o.gl && o.internal) { window.__weaponScene = o; break; }
        if (o.memoizedState && typeof o.memoizedState === 'object') for (const d of Object.values(Object.getOwnPropertyDescriptors(o.memoizedState))) if (d.value && typeof d.value === 'object') queue.push(d.value);
        if (typeof o.getState === 'function') { try { const s = o.getState(); if (s?.scene?.isScene) { window.__weaponScene = s; break; } } catch { /* not a store */ } }
        for (const k of ['child','sibling','return','stateNode','memoizedState','next','memoizedProps','root','store','current','value','children','_currentValue','_currentValue2','containerInfo','props','dependencies','firstContext','memoizedValue','context']) { const v = o[k]; if (Array.isArray(v)) queue.push(...v); else if (v && ['object','function'].includes(typeof v)) queue.push(v); }
      }
      if (!window.__weaponScene && new URL(location.href).port === '8080') throw Error('Dev R3F scene unavailable');
    });
    const capture = async (form, phase) => {
      await page.waitForTimeout(90);
      const state = await page.evaluate(form => {
        if (!window.__weaponScene) return { rigReadback: false, worn: window.__ember.getWorld().player.wear.main ?? null };
        const figure = window.__weaponScene.scene.getObjectByName('emberhall-player-figure');
        const arm = figure.getObjectByName('weapon-arm'); const held = figure.getObjectByName('weapon-held');
        const stow = figure.getObjectByName(`weapon-stow-${form}`);
        let meshes = 0; held.traverse(o => { if (o.isMesh) meshes++; });
        return { rigReadback: true, rotation: arm.rotation.toArray().slice(0,3), reach: arm.position.z, lean: figure.rotation.x, held: held.visible, meshes, stow: stow.visible, worn: window.__ember.getWorld().player.wear.main ?? null };
      }, form);
      await page.screenshot({ path: resolve(output, `${name}-${form}-${phase}.png`) });
      return state;
    };
    const clock = async seconds => page.evaluate(seconds => { window.__ember.getWorld().hour += seconds / 36; }, seconds);
    const results = [];
    for (const [form, label, draw, windup] of [['dagger','Dagger',0.48,0.78],['spear','Spear',0.7,0.56],['war_axe','War axe',0.82,0.7]]) {
      await page.evaluate(() => { const s=window.__ember.useGame.getState(); s.setPanel('you'); });
      await act(page.getByRole('button', { name: `${label} ×1`, exact: true }));
      await act(page.locator('[data-testid="pack-actions"] button').first());
      await page.evaluate(() => window.__ember.useGame.getState().setPanel('none'));
      await clock(draw * 0.25);
      const drawing = await capture(form, 'draw');
      assert.equal(drawing.worn, form); if (drawing.rigReadback) assert.ok(drawing.held && drawing.meshes >= 2);
      await clock(1.2);
      const idle = await capture(form, 'idle'); if (idle.rigReadback) assert.notDeepEqual(drawing.rotation, idle.rotation);
      await page.evaluate(() => {
        const w=window.__ember.getWorld(); const s=window.__ember.useGame.getState(); const self=w.people.find(p=>p.isPlayer); const target=w.fauna.find(c=>c.id==='weapon-qa-target');
        target.x=self.x+1.3; target.z=self.z; target.path=[]; target.task='idle'; target.taskUntil=999;
        s.hunt(target.id); self.path=[];
      });
      await page.evaluate(t => { window.__ember.getWorld().player.workT = t; }, 0.55 * windup);
      const anticipation = await capture(form, 'windup');
      await page.evaluate(() => { window.__ember.getWorld().player.workT = 0.55 * 0.97; });
      const strike = await capture(form, 'strike'); if (strike.rigReadback) assert.notDeepEqual(anticipation.rotation, strike.rotation);
      const hit = await page.evaluate(() => {
        const w=window.__ember.getWorld(); const s=window.__ember.useGame.getState(); const target=w.fauna.find(c=>c.id==='weapon-qa-target'); const before=target.hp;
        const random=Math.random; Math.random=()=>0.01;
        try { s.speed(1); window.__weaponTick(0.04); s.speed(0); } finally { Math.random=random; }
        return { before, after: target.hp, workT:w.player.workT };
      });
      assert.ok(hit.after < hit.before, 'actual combat hit must land');
      const landed = await capture(form, 'hit');
      await page.evaluate(() => { const w=window.__ember.getWorld(); w.player.intent.kind='none'; w.hour+=1/36; window.__ember.useGame.getState().setPanel('you'); });
      await act(page.getByRole('button', { name: `Unequip ${label}`, exact: true }));
      await page.evaluate(() => window.__ember.useGame.getState().setPanel('none'));
      await clock(draw * 0.3);
      const sheathe = await capture(form, 'sheathe'); assert.equal(sheathe.worn, null); if (sheathe.rigReadback) assert.equal(sheathe.stow, true);
      await clock(1.2);
      const stowed = await capture(form, 'stowed'); if (stowed.rigReadback) { assert.equal(stowed.stow, false); assert.equal(stowed.meshes, 0); }
      const rare = await page.evaluate(form => {
        const w=window.__ember.getWorld(); const s=window.__ember.useGame.getState();
        const rare={uid:`weapon-qa-${form}`,base:form,affixes:[],seed:17,hour:w.hour};
        w.player.rares.push(rare); s.equipRare(rare.uid);
        return { uid: w.player.wearRare.main, record: JSON.stringify(rare) };
      }, form);
      const rareDraw = await capture(form, 'rare-draw');
      assert.equal(rare.uid, `weapon-qa-${form}`); if (rareDraw.rigReadback) assert.equal(rareDraw.meshes, 2);
      const rareStow = await page.evaluate(form => {
        const s=window.__ember.useGame.getState(); s.unequip('main');
        const w=window.__ember.getWorld(); return { uid:w.player.wearRare.main ?? null, record:JSON.stringify(w.player.rares.find(r=>r.uid===`weapon-qa-${form}`)) };
      }, form);
      assert.equal(rareStow.uid, null); assert.equal(rareStow.record, rare.record);
      await clock(1.2);
      results.push({ form, drawing, idle, anticipation, strike, hit, landed, sheathe, stowed, rareDraw, rareStow });
    }
    assert.deepEqual(errors, []);
    verdict.viewports.push({ name, errors, results }); await context.close();
  }
  verdict.ok = true;
} catch (error) { verdict.error=String(error.stack); process.exitCode=1; }
finally { await browser.close(); writeFileSync(resolve(output,'verdict.json'),JSON.stringify(verdict,null,2)); }
console.log(JSON.stringify(verdict,null,2));
