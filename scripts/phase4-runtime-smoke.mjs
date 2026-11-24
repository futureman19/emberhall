#!/usr/bin/env node
/** Local-only real host/UI smoke. Injected deterministic providers: NOT live-provider acceptance. */
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
const output = process.env.SMOKE_OUTPUT ?? 'screenshots/phase4-runtime-dev';
mkdirSync(output, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'director-ui-'));
const shard = createShard({ dataDir: dir, seed: 42, port: 5591, keys: [] }, { log() {} });
let runtime;
let wake = false;
const prompts = [];
const director = createDirector({ dataDir: dir, shard, secretKey: Buffer.alloc(32, 7), allowedOrigins: [base], log() {}, runtimeFactory: services => runtime = createAgentRuntime({
  shard, services, retryMs: [100], schedulerConfig: { riskGated: false },
  fetchImpl: async (url, init) => {
    prompts.push(JSON.parse(init.body));
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
const results = [];
try {
  await transport.listen(5591); shard.start();
  if (process.env.SMOKE_UPSTREAM) {
    const upstream = new URL(process.env.SMOKE_UPSTREAM);
    assert.equal(upstream.hostname, '127.0.0.1');
    assert.equal(upstream.protocol, 'http:');
    gateway = createServer((req, res) => {
      const target = new URL(req.url, req.url.startsWith('/api/v1/') ? 'http://127.0.0.1:5591' : upstream);
      const forward = httpRequest(target, { method: req.method, headers: req.headers }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
      forward.on('error', () => { res.writeHead(502); res.end(); });
      req.pipe(forward);
    });
    await new Promise(r => gateway.listen(Number(new URL(base).port), '127.0.0.1', r));
  }
  browser = await chromium.launch({ headless: true });
  for (const [name, viewport, kind] of [['desktop', { width: 1366, height: 900 }, 'cloud'], ['mobile', { width: 390, height: 844 }, 'local']]) {
    const context = await browser.newContext({ viewport, isMobile: name === 'mobile', hasTouch: name === 'mobile' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 200, body: '' }));
    await page.goto(base + '/console');
    await page.waitForTimeout(2500); // SSR controls exist before client hydration.
    const click = id => page.getByTestId(id).click();
    await click('create-account');
    try { await page.getByTestId('owner-token').waitFor({ timeout: 10000 }); } catch (e) { console.log(await page.locator('body').innerText()); console.log(errors); throw e; }
    await click('token-saved');
    await page.getByTestId('name').fill('Fixture ' + name);
    await click('save-name'); await click('role-ranger');
    await page.getByTestId('directive').fill('Walk safely, fixture only.');
    await click('save-directive');
    if (kind === 'local') {
      await click('mind-kind-local');
      await page.getByTestId('mind-endpoint').fill('https://local.example/v1');
      await page.getByTestId('mind-local-model').fill('fixture');
    } else {
      await page.getByTestId('mind-model').fill('fixture');
      await page.getByTestId('mind-key').fill('noncredential-fixture-value');
    }
    await click('save-mind'); await click('unleash');
    await page.getByTestId('status-lifecycle').waitFor();
    await page.waitForTimeout(2500);
    assert.equal(await page.getByText('Preview host (contract mock)', { exact: false }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const text = await page.locator('body').innerText();
    if (kind === 'local') assert.match(text, /mind is asleep/i);
    else assert.match(text, /awake/i);
    await page.screenshot({ path: join(output, name + '.png'), fullPage: true });
    if (kind === 'local') {
      wake = true;
      await page.waitForFunction(() => document.querySelector('[data-testid=status-mind]')?.textContent === 'Awake', null, { timeout: 15000 });
    }
    await click('recall');
    await page.waitForTimeout(2200);
    assert.match(await page.locator('body').innerText(), /Recalled/);
    assert.deepEqual(errors, []);
    results.push({ name, connector: kind, passed: true, errors });
    await context.close();
  }
  assert.ok(prompts.every(p => JSON.stringify(p).includes('Walk safely, fixture only.')));
  writeFileSync(join(output, 'verdict.json'), JSON.stringify({ providerEvidence: 'deterministic injected fixtures; real HTTP director, shard, runtime and native browser UI', results }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser?.close();
  if (gateway) { gateway.closeAllConnections(); await new Promise(r => gateway.close(r)); }
  runtime.stopAll(); await runtime.settled();
  await transport.close(); shard.stop(); rmSync(dir, { recursive: true, force: true });
}
