import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {SAVE_KEY} from '../src/game/save.ts';

const url = process.argv[2] || 'http://127.0.0.1:64511';
assert(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
const out = path.resolve('art/verification/worldwide/worldwide-ore-1-natural-grok-r3');
fs.mkdirSync(out, {recursive: true});
assert(!fs.existsSync(path.join(out, 'results.json')));
const raw = fs.readFileSync('art/verification/worldwide/vis-u1-smoke-v1/disposable-save.json', 'utf8');
const result = {url, scope: 'natural rock seating supplement', sites: [], cases: [], errors: [], passed: false};
const flush = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));

const browser = await chromium.launch({headless: true, args: ['--use-angle=d3d11', '--enable-gpu']});
try {
  const pickContext = await browser.newContext({viewport: {width: 1440, height: 960}});
  const pickPage = await pickContext.newPage();
  await pickPage.addInitScript(({raw, key}) => localStorage.setItem(key, raw), {raw, key: SAVE_KEY});
  await pickPage.goto(url + '/?qa=1');
  await pickPage.getByRole('button', {name: 'Continue', exact: true}).click();
  await pickPage.waitForFunction(() => window.__ember?.useGame.getState().phase === 'playing');
  const sites = await pickPage.evaluate(async () => {
    const w = window.__ember.getWorld();
    const {resolveResourceVisual} = await import('/src/components/game/resource-visuals.ts');
    const {groundY} = await import('/src/game/height.ts');
    const rocks = [];
    for (let ty = 0; ty < 512; ty++) {
      for (let tx = 0; tx < 512; tx++) {
        const t = w.tiles[ty]?.[tx];
        if (!t || t.kind !== 'rock') continue;
        const vis = resolveResourceVisual({seed: w.seed, tx, ty, nodeKind: 'rock'});
        const shape = vis.shape;
        const n = [w.tiles[ty][tx - 1], w.tiles[ty][tx + 1], w.tiles[ty - 1]?.[tx], w.tiles[ty + 1]?.[tx]].filter(Boolean);
        rocks.push({
          tx, ty, height: shape?.height, width: shape?.width, depth: shape?.depth, yaw: shape?.yaw,
          identity: vis.id || vis.kind, ground: groundY(w, tx, ty), tileH: t.h,
          slope: n.some(o => Math.abs((o.h || 0) - t.h) >= 1),
        });
      }
    }
    rocks.sort((a, b) => a.height - b.height);
    const small = rocks[0] || null;
    const medium = rocks[Math.floor(rocks.length / 2)] || null;
    const large = rocks[rocks.length - 1] || null;
    const slope = rocks.find(r => r.slope) || null;
    if (small) small.size = 'small';
    if (medium) medium.size = 'medium';
    if (large) large.size = 'large';
    return {small, medium, large, slope, nRocks: rocks.length};
  });
  await pickContext.close();
  result.sites = sites;

  const chosen = ['small', 'medium', 'large'].map(k => sites[k]).filter(Boolean);
  if (sites.slope && !chosen.some(s => s.tx === sites.slope.tx && s.ty === sites.slope.ty)) {
    chosen[chosen.length - 1] = sites.slope;
    chosen[chosen.length - 1].size = (sites.slope.size || 'medium') + '+slope';
  }

  for (const [device, viewport] of [['desktop', {width: 1440, height: 960}], ['mobile', {width: 390, height: 844}]]) {
    const context = await browser.newContext({viewport, hasTouch: device === 'mobile', deviceScaleFactor: 1});
    await context.routeWebSocket(/.*/, () => {});
    const page = await context.newPage();
    page.on('pageerror', e => result.errors.push({device, type: 'page', text: e.message}));
    page.on('console', m => { if (m.type() === 'error') result.errors.push({device, type: 'console', text: m.text()}); });
    await page.addInitScript(({raw, key}) => localStorage.setItem(key, raw), {raw, key: SAVE_KEY});
    await page.goto(url + '/?qa=1');
    await page.getByRole('button', {name: 'Continue', exact: true}).click();
    await page.waitForFunction(() => {
      if (!window.__emberCamera || window.__ember?.useGame.getState().phase !== 'playing') return false;
      window.__ember.useGame.getState().speed(0);
      window.__ember.useGame.getState().setPanel?.('none');
      window.__ember.useGame.getState().closeCtx?.();
      return true;
    });
    await page.waitForLoadState('networkidle');

    for (const site of chosen) {
      for (const state of ['idle', 'marked']) {
        await page.evaluate(({site, state}) => {
          const w = window.__ember.getWorld();
          const s = window.__ember.useGame.getState();
          const p = w.people.find(x => x.isPlayer);
          p.x = site.tx;
          p.z = site.ty;
          p.story = 0;
          p.path = [];
          w.player.wear.main = 'pick';
          if (state === 'marked') {
            w.player.intent.kind = 'mine';
            w.player.intent.tx = site.tx;
            w.player.intent.ty = site.ty;
          } else {
            w.player.intent.kind = 'none';
          }
          s.setPanel?.('none');
          s.closeCtx?.();
          s.select(null);
          w.landRev++;
          s.tick(0.01);
        }, {site, state});
        await page.waitForTimeout(1200);
        const measure = await page.evaluate(async ({site}) => {
          const w = window.__ember.getWorld();
          const {groundY} = await import('/src/game/height.ts');
          const text = await (await fetch('/src/components/game/world-scene.tsx')).text();
          const f = text.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);
          const fiber = await import(f[1]);
          const scene = fiber._roots.get(document.querySelector('canvas')).store.getState().scene;
          const three = await import('/node_modules/three/build/three.module.js');
          let mesh = null;
          scene.traverse(o => { if (o.name === 'authored-field-rocks') mesh = o; });
          if (!mesh || !mesh.instanceMatrix) return {ok: false, error: 'missing-mesh'};
          const expected = groundY(w, site.tx, site.ty) + 0.006;
          let hit = null;
          const im = mesh.instanceMatrix;
          const world = new three.Matrix4();
          const local = new three.Matrix4();
          const v = new three.Vector3();
          const pos = mesh.geometry.attributes.position;
          for (let i = 0; i < mesh.count; i++) {
            local.fromArray(im.array, i * 16);
            const tx = local.elements[12];
            const tz = local.elements[14];
            if (Math.abs(tx - site.tx) > 0.6 || Math.abs(tz - site.ty) > 0.6) continue;
            world.copy(mesh.matrixWorld).multiply(local);
            let minY = Infinity;
            for (let vi = 0; vi < pos.count; vi++) {
              v.fromBufferAttribute(pos, vi).applyMatrix4(world);
              if (v.y < minY) minY = v.y;
            }
            hit = {index: i, tx, tz, minY, delta: minY - expected, elements: Array.from(local.elements)};
            break;
          }
          return {ok: Boolean(hit), expected, hit, intent: structuredClone(w.player.intent)};
        }, {site});
        const shot = path.join(out, `${device}-${site.size}-${state}.png`);
        await page.screenshot({path: shot});
        const deltaOk = measure.hit && Math.abs(measure.hit.delta) <= 0.002;
        result.cases.push({
          device, size: site.size, tx: site.tx, ty: site.ty, state,
          identity: site.identity, ground: site.ground, expectedY: measure.expected,
          minY: measure.hit?.minY, baseDelta: measure.hit?.delta, instance: measure.hit?.index,
          intent: measure.intent, ok: Boolean(measure.ok && deltaOk),
          error: measure.error || (!measure.ok ? 'missing-instance' : (!deltaOk ? 'seating-delta' : null)),
          shot,
        });
        flush();
      }
      const mine = await page.evaluate(({site}) => {
        const w = window.__ember.getWorld();
        w.player.intent.kind = 'none';
        window.__ember.useGame.getState().tick(0.01);
        return structuredClone(w.player.intent);
      }, {site});
      result.cases[result.cases.length - 1].intentRestored = mine;
    }
    await context.close();
  }
  const unexpected = result.errors.filter(e => !String(e.text || e).includes('503'));
  const failed = result.cases.filter(c => !c.ok);
  result.unexpected = unexpected;
  result.passed = unexpected.length === 0 && failed.length === 0 && result.cases.length >= 12;
} catch (e) {
  result.passed = false;
  result.failure = e.stack;
  process.exitCode = 1;
} finally {
  flush();
  await browser.close();
}
console.log(JSON.stringify({passed: result.passed, cases: result.cases.length, failed: (result.cases || []).filter(c => !c.ok).length, sites: result.sites, unexpected: (result.unexpected || []).length, out}));
