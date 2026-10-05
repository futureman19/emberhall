import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {SAVE_KEY} from '../src/game/save.ts';

const url = process.argv[2] || 'http://127.0.0.1:64511';
assert(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
const out = path.resolve('art/verification/worldwide/worldwide-horizon-1-natural-grok-r1');
fs.mkdirSync(out, {recursive: true});
assert(!fs.existsSync(path.join(out, 'results.json')));
const raw = fs.readFileSync('art/verification/worldwide/vis-u1-smoke-v1/disposable-save.json', 'utf8');
const result = {url, cases: [], samples: [], errors: [], passed: false};
const flush = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));

const browser = await chromium.launch({headless: true, args: ['--use-angle=d3d11', '--enable-gpu']});
try {
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
      return true;
    });
    await page.waitForLoadState('networkidle');

    const site = await page.evaluate(async () => {
      const w = window.__ember.getWorld();
      const p = w.people.find(x => x.isPlayer);
      const s = window.__ember.useGame.getState();
      let shore = null, tallWater = null;
      for (let z = 2; z < 510; z++) {
        for (let x = 2; x < 510; x++) {
          const t = w.tiles[z][x];
          if (t.kind !== 'water') continue;
          if (t.h !== 0 && !tallWater) tallWater = {x, z, h: t.h};
          const land = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => {
            const n = w.tiles[z + dz][x + dx];
            return n && n.kind !== 'water';
          });
          if (land && t.h !== 0 && !shore) shore = {x, z, h: t.h};
        }
      }
      const t = shore || tallWater;
      if (!t) return {ok: false};
      p.x = t.x;
      p.z = t.z;
      p.story = 0;
      p.path = [];
      s.setPanel('none');
      s.closeCtx();
      s.tick(0.01);
      const origin = window.__emberCamera?.getTarget?.() || {x: p.x, y: 0, z: p.z};
      return {ok: true, tile: t, seed: w.seed, landRev: w.landRev, player: {x: p.x, z: p.z}, origin};
    });
    result.site = site;
    await page.waitForTimeout(1500);

    for (const weather of [{name: 'day', hour: 12, kind: 'clear', cloud: 0.06, wet: 0}, {name: 'rain', hour: 12, kind: 'rain', cloud: 0.95, wet: 0.8}]) {
      await page.evaluate(wthr => {
        const w = window.__ember.getWorld();
        const s = window.__ember.useGame.getState();
        w.hour = wthr.hour;
        Object.assign(w.weather, {kind: wthr.kind, cloud: wthr.cloud, wet: wthr.wet, wind: 0.4, untilHour: wthr.hour + 10});
        s.setPanel('none');
        s.tick(0.01);
        window.__ember.useGame.setState({toast: null});
      }, weather);
      await page.waitForTimeout(900);
      await page.screenshot({path: path.join(out, `${device}-${weather.name}.png`)});
      await page.screenshot({path: path.join(out, `${device}-${weather.name}-crop.png`), clip: {x: viewport.width * 0.25, y: viewport.height * 0.2, width: viewport.width * 0.5, height: viewport.height * 0.45}});
    }

    const samples = await page.evaluate(async () => {
      const w = window.__ember.getWorld();
      const {horizonSurfaceY} = await import('/src/components/game/horizon-water.ts');
      const {groundY} = await import('/src/game/height.ts');
      const p = w.people.find(x => x.isPlayer);
      const ox = p.x, oz = p.z;
      const rows = [];
      for (const [dx, dz] of [[0, 0], [8, 0], [40, 0], [80, 0], [160, 0], [0, 40], [40, 40], [120, 80]]) {
        const x = ox + dx + 0.25, z = oz + dz + 0.25;
        const dist = Math.hypot(x - ox, z - oz);
        const expected = horizonSurfaceY(w, x, z, dist);
        const x0 = Math.floor(x), z0 = Math.floor(z);
        const wet = [w.tiles[z0]?.[x0], w.tiles[z0]?.[x0 + 1], w.tiles[z0 + 1]?.[x0], w.tiles[z0 + 1]?.[x0 + 1]]
          .filter(Boolean).every(t => t.kind === 'water');
        const dry = [w.tiles[z0]?.[x0], w.tiles[z0]?.[x0 + 1], w.tiles[z0 + 1]?.[x0], w.tiles[z0 + 1]?.[x0 + 1]]
          .filter(Boolean).every(t => t.kind !== 'water');
        const gy = groundY(w, x, z);
        const waterExpected = gy - 0.08;
        rows.push({
          x, z, dist, expected, gy, wet, dry,
          waterDelta: expected - waterExpected,
          ok: !wet || Math.abs(expected - waterExpected) < 1e-5,
        });
      }
      const text = await (await fetch('/src/components/game/world-scene.tsx')).text();
      const f = text.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);
      const fiber = await import(f[1]);
      const scene = fiber._roots.get(document.querySelector('canvas')).store.getState().scene;
      let horizon = null;
      scene.traverse(o => {
        if (o.isMesh && o.geometry?.attributes?.position?.count === 51 * 51) horizon = o;
      });
      const rendered = [];
      if (horizon) {
        const pos = horizon.geometry.attributes.position;
        horizon.updateMatrixWorld(true);
        const {Vector3} = await import('/node_modules/three/build/three.module.js');
        const v = new Vector3();
        for (let i = 0; i < pos.count; i += 37) {
          v.fromBufferAttribute(pos, i).applyMatrix4(horizon.matrixWorld);
          const dist = Math.hypot(v.x - ox, v.z - oz);
          if (dist < 26 || dist > 390) continue;
          const exp = horizonSurfaceY(w, v.x, v.z, dist);
          const hole = v.y < -7;
          rendered.push({x: v.x, y: v.y, z: v.z, dist, exp, delta: v.y - exp, hole, ok: hole || Math.abs(v.y - exp) < 1e-3});
        }
      }
      return {rows, renderedCount: rendered.length, renderedOk: rendered.filter(r => r.ok).length, rendered: rendered.slice(0, 12), hasHorizonMesh: Boolean(horizon)};
    });
    result.cases.push({device, samples});
    flush();
    await context.close();
  }
  const unexpected = result.errors.filter(e => !String(e.text || e).includes('503'));
  const helperBad = result.cases.flatMap(c => c.samples.rows || []).filter(r => r.wet && !r.ok);
  result.unexpected = unexpected;
  result.passed = unexpected.length === 0 && helperBad.length === 0 && result.cases.length === 2;
} catch (e) {
  result.passed = false;
  result.failure = e.stack;
  process.exitCode = 1;
} finally {
  flush();
  await browser.close();
}
console.log(JSON.stringify({passed: result.passed, cases: result.cases.length, unexpected: (result.unexpected || []).length, site: result.site, failure: result.failure, out}));
