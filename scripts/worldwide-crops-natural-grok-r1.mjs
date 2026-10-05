// Grok-owned natural-site seating QA for worldwide-crops-1. Not a product file.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {SAVE_KEY} from '../src/game/save.ts';

const url = process.argv[2] || 'http://127.0.0.1:64511';
assert(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
const out = path.resolve('art/verification/worldwide/worldwide-crops-1-natural-grok-r2');
fs.mkdirSync(out, {recursive: true});
assert(!fs.existsSync(path.join(out, 'results.json')));

const raw = fs.readFileSync('art/verification/worldwide/vis-u1-smoke-v1/disposable-save.json', 'utf8');
const sites = JSON.parse(fs.readFileSync('art/verification/worldwide/worldwide-crops-1/natural-sites.json', 'utf8'));
const result = {url, scope: 'natural herb seating supplement', cases: [], errors: [], passed: false};
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

    for (const herb of sites.herbs) {
      const originalUntil = await page.evaluate((id) => window.__ember.getWorld().herbs.find(h => h.id === id)?.until, herb.id);
      for (const state of ['ready', 'picked', 'restored']) {
        await page.evaluate(({herb, state, originalUntil}) => {
          const w = window.__ember.getWorld();
          const s = window.__ember.useGame.getState();
          const p = w.people.find(x => x.isPlayer);
          const original = w.herbs.find(h => h.id === herb.id);
          if (!original) return;
          if (state === 'picked') original.until = w.hour + 99;
          else original.until = originalUntil;
          w.herbs = w.herbs.slice();
          w.landRev = (w.landRev || 0) + 1;
          p.x = herb.tx;
          p.z = herb.ty;
          p.story = 0;
          p.path = [];
          s.tick(0.01);
        }, {herb, state, originalUntil});
        await page.waitForTimeout(1200);
        const measure = await page.evaluate(async ({herb}) => {
          const w = window.__ember.getWorld();
          const original = w.herbs.find(h => h.id === herb.id);
          if (!original) return {ok: false, error: 'missing-herb'};
          const {groundY} = await import('/src/game/height.ts');
          const text = await (await fetch('/src/components/game/world-scene.tsx')).text();
          const f = text.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);
          const fiber = await import(f[1]);
          const scene = fiber._roots.get(document.querySelector('canvas')).store.getState().scene;
          const three = await import('/node_modules/three/build/three.module.js');
          const meshes = [];
          scene.traverse(o => {
            if (o.name && o.name.startsWith('authored-herb-') && o.name.includes(herb.kind)) meshes.push(o);
          });
          const atTile = meshes.filter(o => {
            const b = new three.Box3().setFromObject(o);
            const cx = (b.min.x + b.max.x) / 2;
            const cz = (b.min.z + b.max.z) / 2;
            return Math.abs(cx - herb.tx) < 0.6 && Math.abs(cz - herb.ty) < 0.6;
          });
          const expected = groundY(w, herb.tx, herb.ty) + 0.006;
          const samples = atTile.map(o => {
            const b = new three.Box3().setFromObject(o);
            const scale = o.getWorldScale(new three.Vector3());
            return {
              name: o.name,
              minY: b.min.y,
              scale: scale.y,
              delta: b.min.y - expected,
              cx: (b.min.x + b.max.x) / 2,
              cz: (b.min.z + b.max.z) / 2,
            };
          });
          return {ok: samples.length > 0, expected, samples, until: original.until, hour: w.hour};
        }, {herb});
        const shot = path.join(out, `${device}-${herb.kind}-${state}.png`);
        await page.screenshot({path: shot});
        const sample = (measure.samples || [])[0];
        const scaleWant = state === 'picked' ? 0.62 : 1;
        const deltaOk = sample && Math.abs(sample.delta) <= 0.002;
        const scaleOk = sample && Math.abs(sample.scale - scaleWant) <= 0.02;
        result.cases.push({
          device,
          kind: herb.kind,
          id: herb.id,
          tile: {tx: herb.tx, ty: herb.ty},
          state,
          expectedY: measure.expected,
          rootScale: sample?.scale,
          baseDelta: sample?.delta,
          mesh: sample?.name,
          ok: Boolean(measure.ok && deltaOk && scaleOk),
          error: measure.error || (!measure.ok ? 'missing-mesh' : (!deltaOk ? 'seating-delta' : (!scaleOk ? 'scale' : null))),
          shot,
        });
        flush();
      }
    }
    await context.close();
  }
  const unexpected = result.errors.filter(e => !String(e.text || e).includes('503'));
  const failed = result.cases.filter(c => !c.ok);
  result.unexpected = unexpected;
  result.passed = unexpected.length === 0 && failed.length === 0 && result.cases.length === 30;
} catch (e) {
  result.passed = false;
  result.failure = e.stack;
  process.exitCode = 1;
} finally {
  flush();
  await browser.close();
}
console.log(JSON.stringify({passed: result.passed, cases: result.cases.length, failed: (result.cases || []).filter(c => !c.ok).length, unexpected: (result.unexpected || []).length, out}));
