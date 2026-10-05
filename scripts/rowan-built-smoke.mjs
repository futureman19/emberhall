// Built-output confirmation only. Detailed transform/pose evidence is in the dev harness.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://127.0.0.1:8137';
assert(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
const out = path.resolve('art/verification/rowan-integration/built-v1');
fs.mkdirSync(out, { recursive: true });
assert(!fs.existsSync(path.join(out, 'results.json')), 'Preserve evidence');
const report = { url, scope: 'Built app creator and player visual check, fresh storage; no Fiber source introspection', checks: [], errors: [], requests: [], screenshots: [] };
const flush = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
const check = (name, ok, data = {}) => { report.checks.push({ name, ok: !!ok, ...data }); flush(); assert(ok, name); };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
const watchdog = setTimeout(() => browser.close(), 150000);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await context.routeWebSocket(/.*/, () => {});
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
  await shot('desktop-creator');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await shot('mobile-creator');
  await page.getByTestId('look-done').click(); await page.waitForFunction(() => window.__ember.useGame.getState().phase === 'playing');
  await page.waitForTimeout(400); await shot('mobile-world');
  await page.setViewportSize({ width: 1440, height: 960 }); await page.waitForTimeout(300); await shot('desktop-world');
  const served = await page.request.get(url + '/art/character-reimagined/rowan.glb');
  const digest = b => createHash('sha256').update(b).digest('hex');
  const servedHash = digest(await served.body()), localHash = digest(fs.readFileSync('public/art/character-reimagined/rowan.glb'));
  check('built-rowan-identical-to-approved-asset', served.status() === 200 && servedHash === localHash, { servedHash, localHash });
  check('actual-renderer-rowan-request', report.requests.some(r => r.status === 200), { requests: report.requests });
  check('creator-finished-and-saved', await page.evaluate(() => localStorage.getItem('emberhall-save-v4').includes('Rowan Built QA')));
  check('no-page-console-errors', report.errors.length === 0, { errors: report.errors });
  report.passed = true;
} catch (e) { report.passed = false; report.failure = e.stack; process.exitCode = 1; }
finally { clearTimeout(watchdog); flush(); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, failure: report.failure, out }));
