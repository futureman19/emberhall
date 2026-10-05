import { chromium } from 'playwright';
import fs from 'node:fs';
const out = 'plans/audit-ui-os-motion';
fs.mkdirSync(out, { recursive: true });
const report = { cases: [], errors: [], scope: 'Disposable contexts; New hall, intro bypass, paused; no save requests or persistent browser profile.' };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
try {
  for (const initial of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: initial });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', e => report.errors.push(e.message));
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.__motionProbe = { records: [], frames: 0 };
      window.matchMedia = query => {
        const mql = original(query);
        if (query.includes('prefers-reduced-motion')) {
          const record = { mql, initial: mql.matches, events: [], registrations: 0 };
          window.__motionProbe.records.push(record);
          mql.addEventListener('change', e => record.events.push({ matches: e.matches, at: performance.now() }));
          const add = mql.addEventListener.bind(mql);
          mql.addEventListener = (...args) => { if (args[0] === 'change') record.registrations++; return add(...args); };
        }
        return mql;
      };
      window.__motionProbe.retained = window.matchMedia('(prefers-reduced-motion: reduce)');
    });
    await page.goto('http://127.0.0.1:8184/?qa=1');
    await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'title');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'New hall', exact: true }).tap();
    await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'intro');
    await page.evaluate(() => { window.__ember.useGame.setState({ phase: 'playing' }); window.__ember.useGame.getState().speed(0); });
    await page.locator('div[data-effects]').waitFor();
    const frames = async () => page.evaluate(() => new Promise(resolve => {
      let left = 5;
      const frame = () => { window.__motionProbe.frames++; if (--left) requestAnimationFrame(frame); else resolve(); };
      requestAnimationFrame(frame);
    }));
    const snapshot = async label => {
      const data = await page.evaluate(() => ({
        html: document.documentElement.getAttribute('data-effects'),
        renderer: document.querySelector('div[data-effects]')?.getAttribute('data-effects'),
        allEffects: [...document.querySelectorAll('[data-effects]')].map(e => ({ tag: e.tagName, effects: e.getAttribute('data-effects'), cls: e.className })),
        probeAt: performance.now(),
        fresh: matchMedia('(prefers-reduced-motion: reduce)').matches,
        retained: window.__motionProbe.retained.matches,
        frames: window.__motionProbe.frames,
        records: window.__motionProbe.records.map(r => ({ initial: r.initial, matches: r.mql.matches, events: r.events, registrations: r.registrations })),
      }));
      report.cases.push({ initial, label, ...data });
      fs.writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report.cases.at(-1)));
    };
    await frames(); await snapshot('initial-after-five-real-rAF');
    for (const target of initial === 'reduce' ? ['no-preference', 'reduce'] : ['reduce', 'no-preference']) {
      await page.emulateMedia({ reducedMotion: target });
      // Do not read .matches before the rendering update: Chromium may consume the pending change.
      await frames(); await snapshot(`five-real-rAF-${target}`);
      await page.waitForTimeout(300); await frames(); await snapshot(`settled-${target}`);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await frames();
    await page.evaluate(() => { for (const r of window.__motionProbe.records.filter(r => r.registrations)) r.mql.dispatchEvent(new MediaQueryListEvent('change', { matches: true, media: r.mql.media })); });
    await frames(); await snapshot('synthetic-change-reduce');
    await context.close();
  }
} catch (e) { report.errors.push(String(e.stack || e)); }
finally { await browser.close(); fs.writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2)); }
const settled = report.cases.filter(c => c.label.startsWith('settled-') || c.label.startsWith('initial-'));
report.pass = report.errors.length === 0 && settled.length === 6 && settled.every(c => c.renderer === (c.fresh ? 'reduced' : 'full') && c.retained === c.fresh);
fs.writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, settled: settled.length, errors: report.errors }));
process.exitCode = report.pass ? 0 : 1;
