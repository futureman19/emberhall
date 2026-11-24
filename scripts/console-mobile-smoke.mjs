#!/usr/bin/env node
/**
 * Mobile onboarding usability pass for the director console (t_b3272cf4).
 * Local-only: owns an isolated deterministic host (injected fixture providers,
 * no live credentials) and drives the real UI at narrow touch viewports.
 *
 *   node --experimental-strip-types scripts/console-mobile-smoke.mjs
 *
 * The smoke owns the deterministic host on 127.0.0.1:5591. Point the dev
 * server's console proxy at it and serve the UI on the smoke's port:
 *   EMBERHALL_DIRECTOR_URL=http://127.0.0.1:5591 npm run dev -- --port 5589
 *
 * Env: SMOKE_URL (default http://127.0.0.1:5589), SMOKE_OUTPUT
 * (default screenshots/console-mobile), SMOKE_UPSTREAM for built-output runs
 * (same gateway pattern as phase4-runtime-smoke.mjs).
 *
 * Reports every check as {name, ok, detail}; exit 1 on any failure. Baseline
 * runs before fixes are expected to fail the keyboard/reload/a11y checks —
 * that failure list IS the before-evidence.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, request as httpRequest } from 'node:http';
import { chromium } from 'playwright';
import { createShard } from '../src/server/shard.ts';
import { createDirector } from '../src/server/accounts.ts';
import { createAgentRuntime } from '../src/server/agent-runtime.ts';
import { createTransport } from '../src/server/ws.ts';

const base = process.env.SMOKE_URL ?? 'http://127.0.0.1:5589';
assert.equal(new URL(base).hostname, '127.0.0.1');
const output = process.env.SMOKE_OUTPUT ?? 'screenshots/console-mobile';
mkdirSync(output, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'director-mobile-'));
const shard = createShard({ dataDir: dir, seed: 42, port: 5591, keys: [] }, { log() {} });
let runtime;
let wake = false;
const director = createDirector({ dataDir: dir, shard, secretKey: Buffer.alloc(32, 7), allowedOrigins: [base], log() {}, runtimeFactory: services => runtime = createAgentRuntime({
  shard, services, retryMs: [100], schedulerConfig: { riskGated: false },
  fetchImpl: async (url) => {
    if (String(url).includes('local.example') && !wake) throw new Error('fixture sleeping');
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ goals: ['Walk safely'], journalEntry: 'Fixture mind awake.', intentHints: [] }) } }] }));
  },
  backendFactory: () => ({ async decide(exchange) {
    const question = exchange.questions[0];
    const verbs = exchange.state.candidateVerbs;
    const pick = Math.max(0, verbs.indexOf('walk'));
    return { answers: [{ id: question.id, type: 'choice', pick, probabilities: question.options.map((_, i) => Number(i === pick)) }] };
  } }),
}) });
const transport = createTransport(shard, director);
let browser;
let gateway;
const checks = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); if (!ok) console.log('FAIL:', name, detail); };

/** Layout/a11y audit of whatever step is on screen. Retries across reloads. */
async function audit(page, label) {
  let r;
  for (let attempt = 0; ; attempt++) {
    try {
      r = await page.evaluate(() => {
        const overflow = document.documentElement.scrollWidth - window.innerWidth;
        const small = [];
        const unlabeled = [];
        for (const el of document.querySelectorAll('button, input, select, textarea')) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) continue; // not rendered
          if (b.height < 44) small.push(`${el.tagName.toLowerCase()}${el.dataset.testid ? '[' + el.dataset.testid + ']' : ''}=${Math.round(b.height)}px`);
          if (el.tagName !== 'BUTTON') {
            const id = el.id;
            const hasLabel = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
            if (!hasLabel && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) unlabeled.push(el.dataset.testid || id || el.tagName);
          }
        }
        const links = [...document.querySelectorAll('a')].map(a => ({ text: a.textContent.trim().slice(0, 24), h: Math.round(a.getBoundingClientRect().height) }));
        return { overflow, small, unlabeled, links, innerWidth: window.innerWidth };
      });
      break;
    } catch (e) {
      if (attempt >= 3 || !/context was destroyed|navigation/i.test(String(e))) throw e;
      await page.waitForTimeout(1500);
    }
  }
  check(`${label}: no horizontal overflow`, r.overflow <= 0, `scrollWidth exceeds innerWidth by ${r.overflow}px @${r.innerWidth}`);
  check(`${label}: touch targets >= 44px`, r.small.length === 0, r.small.join(', '));
  check(`${label}: form controls labeled`, r.unlabeled.length === 0, r.unlabeled.join(', '));
  return r;
}

async function shot(page, name) { await page.screenshot({ path: join(output, name + '.png'), fullPage: true }); }

/** Keyboard focus indicator: Tab to the first enabled button, read its style. */
async function focusRingCheck(page, label) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.focus();
  });
  let r = { found: false };
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    r = await page.evaluate(() => {
      const el = document.activeElement;
      if (!(el instanceof HTMLButtonElement) || el.disabled) return { found: false };
      const cs = getComputedStyle(el);
      return { found: true, testid: el.dataset.testid ?? null, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, boxShadow: cs.boxShadow };
    });
    if (r.found) break;
  }
  const visible = r.found && ((r.outlineStyle !== 'none' && r.outlineWidth !== '0px') || r.boxShadow !== 'none');
  check(`${label}: button focus indicator`, visible, JSON.stringify(r));
}

try {
  await transport.listen(5591); shard.start();
  if (process.env.SMOKE_UPSTREAM) {
    const upstream = new URL(process.env.SMOKE_UPSTREAM);
    assert.equal(upstream.hostname, '127.0.0.1');
    gateway = createServer((req, res) => {
      const target = new URL(req.url, req.url.startsWith('/api/v1/') ? 'http://127.0.0.1:5591' : upstream);
      const forward = httpRequest(target, { method: req.method, headers: req.headers }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
      forward.on('error', () => { res.writeHead(502); res.end(); });
      req.pipe(forward);
    });
    await new Promise(r => gateway.listen(Number(new URL(base).port), '127.0.0.1', r));
  }
  browser = await chromium.launch({ headless: true });

  for (const [vp, viewport, kind] of [
    ['390x844', { width: 390, height: 844 }, 'cloud'],
    ['320x568', { width: 320, height: 568 }, 'local'],
  ]) {
    wake = false;
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 200, body: '' }));
    const click = id => page.getByTestId(id).click();
    const text = () => page.locator('body').innerText();
    const P = `${vp}`;

    await page.goto(base + '/console', { waitUntil: 'load' });
    await page.waitForTimeout(3000); // first-load dep optimization can full-reload
    await page.getByTestId('create-account').waitFor({ timeout: 20000 });
    await page.waitForTimeout(800); // hydration settle
    await audit(page, `${P} account`);
    await focusRingCheck(page, `${P} account`);
    await shot(page, `${P}-01-account`);

    // Account creation + one-time token reveal reachable on mobile.
    await click('create-account');
    await page.getByTestId('owner-token').waitFor({ timeout: 10000 });
    const tokenVisible = await page.getByTestId('owner-token').isVisible();
    check(`${P}: owner token revealed`, tokenVisible);
    await audit(page, `${P} token-reveal`);
    await shot(page, `${P}-02-token`);
    await click('token-saved');

    // Validation: empty name must fail visibly without losing state.
    await page.getByTestId('name').waitFor();
    await click('save-name');
    await page.getByTestId('field-error-name').waitFor({ timeout: 5000 });
    check(`${P}: empty-name validation visible`, true);
    const ariaInvalid = await page.getByTestId('name').getAttribute('aria-invalid');
    check(`${P}: name input aria-invalid on error`, ariaInvalid === 'true', `aria-invalid=${ariaInvalid}`);
    const describedBy = await page.getByTestId('name').getAttribute('aria-describedby');
    check(`${P}: name error linked via aria-describedby`, !!describedBy, `aria-describedby=${describedBy}`);
    await shot(page, `${P}-03-name-error`);

    // Keyboard: Enter in the name field submits (mobile keyboard Go).
    const charName = `Mobile ${vp} ${kind}`;
    await page.getByTestId('name').fill(charName);
    await page.getByTestId('name').press('Enter');
    let advanced = false;
    try { await page.getByTestId('role-list').waitFor({ timeout: 4000 }); advanced = true; } catch { /* baseline defect */ }
    check(`${P}: Enter submits name step`, advanced, advanced ? '' : 'Enter did nothing; still on character step');
    if (!advanced) await click('save-name');
    await page.getByTestId('role-list').waitFor({ timeout: 5000 });
    await audit(page, `${P} role`);
    await shot(page, `${P}-04-role`);
    await click('role-ranger');

    // Directive: over-limit validation keeps the text.
    await page.getByTestId('directive').waitFor();
    const longDirective = 'Walk safely, fixture only. ' + 'x'.repeat(300);
    await page.getByTestId('directive').fill('y'.repeat(2001));
    const counter = await page.getByTestId('directive-counter').innerText();
    check(`${P}: directive counter flags over-limit`, /over the limit/.test(counter), counter);
    await click('save-directive');
    await page.getByTestId('field-error-directive').waitFor({ timeout: 5000 });
    const kept = await page.getByTestId('directive').inputValue();
    check(`${P}: over-limit directive text preserved`, kept.length === 2001, `len=${kept.length}`);
    await page.getByTestId('directive').fill(longDirective);
    await audit(page, `${P} directive`);
    await shot(page, `${P}-05-directive`);
    await click('save-directive');

    // Mind configuration.
    await page.getByTestId('mind-step').waitFor();
    if (kind === 'local') {
      await click('mind-kind-local');
      // Invalid URL: visible error, non-secret state survives.
      await page.getByTestId('mind-endpoint').fill('not a url');
      await page.getByTestId('mind-local-model').fill('fixture');
      await click('save-mind');
      await page.getByTestId('field-error-mind.endpointUrl').waitFor({ timeout: 5000 });
      const keptUrl = await page.getByTestId('mind-endpoint').inputValue();
      check(`${P}: bad endpoint error visible + value kept`, keptUrl === 'not a url', keptUrl);
      await shot(page, `${P}-06-mind-error`);
      // Long unbroken endpoint path: overflow probe for the review step.
      const longUrl = 'https://local.example/v1/' + 'a'.repeat(160);
      await page.getByTestId('mind-endpoint').fill(longUrl);
      // Keyboard: Enter in the endpoint field saves the mind.
      await page.getByTestId('mind-endpoint').press('Enter');
      let mindAdvanced = false;
      try { await page.getByTestId('review-name').waitFor({ timeout: 4000 }); mindAdvanced = true; } catch { /* baseline defect */ }
      check(`${P}: Enter submits mind step`, mindAdvanced, mindAdvanced ? '' : 'Enter did nothing');
      if (!mindAdvanced) await click('save-mind');
    } else {
      const keyInput = page.getByTestId('mind-key');
      check(`${P}: key field is password`, await keyInput.getAttribute('type') === 'password');
      check(`${P}: key field autocomplete off`, await keyInput.getAttribute('autocomplete') === 'off');
      await page.getByTestId('mind-model').fill('fixture');
      await keyInput.fill('noncredential-fixture-value');
      await audit(page, `${P} mind-cloud`);
      await shot(page, `${P}-06-mind`);
      await click('save-mind');
    }

    // Review: long strings must not overflow; unleash reachable.
    await page.getByTestId('review-name').waitFor({ timeout: 8000 });
    await audit(page, `${P} review`);
    await focusRingCheck(page, `${P} review`);
    await shot(page, `${P}-07-review`);
    const unleashBox = await page.getByTestId('unleash').boundingBox();
    check(`${P}: unleash action rendered`, !!unleashBox && unleashBox.height >= 44, JSON.stringify(unleashBox));
    try {
      await page.getByTestId('unleash').click({ timeout: 6000 });
      check(`${P}: unleash clickable with long strings`, true);
    } catch {
      check(`${P}: unleash clickable with long strings`, false, 'click intercepted — overflowing review text covers the primary action');
      await shot(page, `${P}-07b-unleash-blocked`);
      await page.getByTestId('unleash').dispatchEvent('click'); // continue the flow for later checks
    }

    // Status: asleep + autopilot (local) or awake (cloud); sleep/wake controls.
    await page.getByTestId('status-lifecycle').waitFor({ timeout: 10000 });
    await page.waitForTimeout(2500);
    const statusText = await text();
    check(`${P}: no mock label in HTTP mode`, !/Preview host \(contract mock\)/.test(statusText));
    if (kind === 'local') {
      check(`${P}: asleep status honest`, /mind is asleep/i.test(statusText), statusText.slice(0, 200));
      check(`${P}: autopilot banner while reflexes drive`, await page.getByTestId('banner-autopilot').count() === 1);
    } else {
      check(`${P}: awake status honest`, /awake/i.test(statusText));
    }
    await audit(page, `${P} status`);
    await shot(page, `${P}-08-status`);
    if (kind === 'local') {
      wake = true;
      await page.waitForFunction(() => document.querySelector('[data-testid=status-mind]')?.textContent === 'Awake', null, { timeout: 20000 });
      check(`${P}: wake observed`, true);
      await shot(page, `${P}-09-awake`);
    }
    await click('recall');
    await page.waitForTimeout(2200);
    check(`${P}: recall confirmed`, /Recalled/.test(await text()));
    await audit(page, `${P} recalled`);
    await shot(page, `${P}-10-recalled`);

    // Reload recovery: the persisted session token must restore the owner's
    // characters without a re-paste (token lives in sessionStorage).
    await page.reload();
    await page.waitForTimeout(2500);
    let restored = false;
    try {
      await page.getByTestId('character-list').waitFor({ timeout: 6000 });
      restored = (await text()).includes(charName);
    } catch { /* baseline defect: lands on account step */ }
    check(`${P}: reload restores session without re-paste`, restored, restored ? '' : 'after reload the character list is not shown; owner must re-paste the token');
    await shot(page, `${P}-11-after-reload`);
    await audit(page, `${P} after-reload`);
    if (restored) {
      // Resume the recalled character and unleash again from the restored list.
      await page.locator('[data-testid="character-list"] button').first().click();
      await page.getByTestId('review-name').waitFor({ timeout: 8000 });
      await click('unleash');
      await page.getByTestId('status-lifecycle').waitFor({ timeout: 10000 });
      check(`${P}: re-unleash after reload`, /Unleashed/.test(await text()));
      await click('recall');
      await page.waitForTimeout(1500);
    }

    // Focus walk: no trap — Tab moves through distinct controls.
    const visited = new Set();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => document.activeElement?.dataset?.testid || document.activeElement?.tagName);
      visited.add(id);
    }
    check(`${P}: focus not trapped`, visited.size >= 4, `visited ${visited.size} distinct stops`);

    check(`${P}: zero console errors`, errors.length === 0, errors.join(' | '));
    await context.close();
  }

  const failed = checks.filter(c => !c.ok);
  writeFileSync(join(output, 'verdict.json'), JSON.stringify({
    providerEvidence: 'deterministic injected fixtures; real HTTP director, shard, runtime; emulated mobile touch viewports',
    viewports: ['390x844', '320x568'],
    total: checks.length, failed: failed.length, checks,
  }, null, 2));
  console.log(JSON.stringify({ total: checks.length, failed: failed.length, failures: failed.map(f => f.name) }));
  assert.equal(failed.length, 0, `${failed.length} mobile usability checks failed`);
} finally {
  await browser?.close();
  if (gateway) { gateway.closeAllConnections(); await new Promise(r => gateway.close(r)); }
  runtime.stopAll(); await runtime.settled();
  await transport.close(); shard.stop(); rmSync(dir, { recursive: true, force: true });
}
