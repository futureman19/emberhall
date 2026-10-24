import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const url = process.argv[2] ?? "http://127.0.0.1:8080";
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Local QA only');
const out = `screenshots/commissions-${new URL(url).port}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const results = [];
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: mobile, isMobile: mobile });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    await page.routeWebSocket('**', () => {});
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.__ember));
    await page.evaluate(() => window.__ember.useGame.getState().begin(false));
    await page.waitForFunction(() => window.__ember.useGame.getState().phase === 'playing');
    await page.waitForTimeout(1800);
    const id = await page.evaluate(() => {
      const s = window.__ember.useGame.getState(), w = window.__ember.getWorld();
      s.speed(0); s.setPanel('none');
      const p = w.people.find(p => p.isPlayer), n = w.people.find(p => p.role === 'provisioner');
      p.x = n.x; p.z = n.z; p.path = []; n.path = [];
      w.player.pack.board = 0; w.player.pack.log = 5;
      s.flash(''); s.select(n.id); return n.id;
    });
    const press = async name => { const b = page.getByRole('button', { name, exact: true }); if (mobile) await b.tap(); else await b.click(); };
    await press('Talk');
    await press('Accept commission');
    await press('Cancel order');
    await press('Accept commission');
    await press('Close');
    await page.getByTestId('commission-tracker').waitFor();
    assert.match(await page.getByTestId('commission-tracker').innerText(), /24h left/);
    await page.screenshot({ path: `${out}/${mobile ? 'mobile' : 'desktop'}-tracker.png` });
    const crafted = await page.evaluate(id => {
      const s = window.__ember.useGame.getState(), w = window.__ember.getWorld();
      const p = w.people.find(p => p.isPlayer), n = w.people.find(p => p.id === id), yard = w.buildings.find(b => b.kind === 'yard');
      p.x = yard.tx; p.z = yard.ty;
      const random = Math.random; Math.random = () => 0;
      try { s.makeRecipe('board'); } finally { Math.random = random; }
      p.x = n.x; p.z = n.z; s.flash(''); s.select(id);
      return { boards: w.player.pack.board, gold: w.gold };
    }, id);
    assert.equal(crafted.boards, 2);
    await page.screenshot({ path: `${out}/${mobile ? 'mobile' : 'desktop'}-deliver.png` });
    const feedbackInline = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const statuses = [...document.querySelectorAll('[role="status"]')].filter(e => e.textContent.includes('Carpentry rises'));
      return statuses.length > 0 && statuses.every(e => dialog.contains(e));
    });
    assert.equal(feedbackInline, true, 'Craft feedback must not float over the NPC commission');
    await press('Deliver goods');
    const done = await page.evaluate(() => { const w = window.__ember.getWorld(); return { status: w.player.commission.status, gold: w.gold, boards: w.player.pack.board, logged: w.log.some(l => l.text.includes('Commission complete')) }; });
    assert.deepEqual(done, { status: 'completed', gold: crafted.gold + 8, boards: 0, logged: true });
    assert.ok(await page.getByText('Delivered and paid. Talk again for another order.', { exact: true }).isVisible());
    const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, dialogBottom: document.querySelector('[role="dialog"]').getBoundingClientRect().bottom, height: innerHeight }));
    assert.equal(layout.overflow, false); assert.ok(layout.dialogBottom <= layout.height);
    assert.deepEqual(errors, []);
    results.push({ mobile, done, layout, errors, fixture: 'Paused real world; player repositioned near keeper/yard; funded logs; deterministic craft roll; store craft action. Native Talk/Accept/Cancel/Deliver click or emulated tap.' });
    await page.close();
  }
} finally { await browser.close(); }
await writeFile(`${out}/report.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ ok: true, results }, null, 2));
