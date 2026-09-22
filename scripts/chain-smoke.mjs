#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const url = process.env.CHAIN_SMOKE_URL || "http://127.0.0.1:8080/";
const output = resolve(process.env.CHAIN_SMOKE_OUTPUT_DIR || "screenshots/chain-smoke");
mkdirSync(output, { recursive: true });

const originLook = `${"a".repeat(64)}.0`;
const originLook2 = `${"d".repeat(64)}.0`;
const originPart = `${"b".repeat(64)}.0`;
const originListed = `${"c".repeat(64)}.0`;
const lookV1 = {
  app: "emberhall", v: 4, type: "look", name: "Ada Vale", calling: "mage",
  look: { schema: "emberhall.look/1", cls: "mage", skin: "#8b5f42", hairStyle: "tail", hairColor: "#d7c6a5", garb: "#3d526e" },
  world: 77, hour: 8, revision: 1,
};
const lookV2 = {
  ...lookV1,
  name: "Ada Ash",
  look: { ...lookV1.look, hairStyle: "long" },
  revision: 2,
  predecessor: originLook.replace(".0", "_0"),
};
const lookMalformed = {
  ...lookV1,
  name: "Ada Ruin",
  look: { ...lookV1.look, hairStyle: "crop" },
  revision: 3,
  predecessor: originLook2.replace(".0", "_0"),
  calling: "bard",
};
const part = (id, name, slot) => ({
  app: "emberhall", v: 4, type: "part", world: 77, hour: 8,
  part: {
    schema: "emberhall.part/1", id, name, slot,
    voxels: [{ x: 1, y: 0, z: 1, c: "#e8b96a" }, { x: 2, y: 0, z: 1, c: "#a85a42" }],
    createdAt: 42, author: "Ada Vale", rarity: "common",
  },
});
const pointer = (origin) => origin.replace(".0", "_0");
const payloads = new Map([
  [pointer(originLook), lookV1],
  [pointer(originPart), part("chain-crown", "Chain Crown", "hair")],
  [pointer(originListed), part("market-cloak", "Market Cloak", "back")],
]);
const walletOutputs = [
  { satoshis: 1, spendable: true, outpoint: originLook, tags: ["id:look-now", "origin", "type:application/json"] },
  { satoshis: 1, spendable: true, outpoint: originPart, tags: ["id:part-now", "origin", "type:application/json"] },
  { satoshis: 1, spendable: true, outpoint: originListed, tags: ["id:part-listed", "origin", "type:application/json", "ordlock", "price:75"] },
];

function attachConsole(page) {
  const errors = [];
  const expectedDevFallbacks = [];
  const blockedExternal = [];
  page.on("pageerror", (error) => {
    const message = error.message;
    if (message.includes("Switched to client rendering")) expectedDevFallbacks.push(message);
    errors.push(`page: ${message}`);
  });
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  return { errors, expectedDevFallbacks, blockedExternal };
}

async function installContentRoute(page) {
  await page.route("https://api.1sat.app/content/**", async (route) => {
    const key = route.request().url().split("/").at(-1);
    const payload = payloads.get(key);
    await route.fulfill(payload ? { status: 200, contentType: "application/json", body: JSON.stringify(payload) } : { status: 404, body: "" });
  });
}

async function openHall(browser, viewport, { walletOutputs: outputs } = {}) {
  const page = await browser.newPage({ viewport });
  const consoleState = attachConsole(page);
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* Storage is unavailable before origin navigation. */ } });
  if (outputs) {
    await page.addInitScript(({ rows }) => {
      localStorage.setItem("onesat_wallet_provider", JSON.stringify({ providerType: "emberhall-smoke" }));
      window.__EMBERHALL_SMOKE_WALLET__ = {
        listOutputs: async ({ offset = 0, limit = 100 }) => ({ outputs: rows.slice(offset, offset + limit), totalOutputs: rows.length }),
      };
    }, { rows: outputs });
  }
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === new URL(url).origin) return route.continue();
    // Isolate non-chain third-party presentation requests without synthetic
    // ERR_BLOCKED_BY_CLIENT console errors. Chain actions still fail closed.
    consoleState.blockedExternal.push(`${route.request().method()} ${requestUrl.origin}${requestUrl.pathname}`);
    if (route.request().method() === 'GET' && !/1sat|gorillapool|whatsonchain/i.test(requestUrl.hostname)) {
      return route.fulfill({ status: 200, contentType: route.request().resourceType() === 'script' ? 'application/javascript' : 'text/plain', body: '' });
    }
    return route.abort("blockedbyclient");
  });
  await installContentRoute(page);
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  return { page, response, ...consoleState };
}

async function enterHall(page, { withPart = true } = {}) {
  await page.getByText("New hall").waitFor({ state: "visible", timeout: 45000 });
  await page.evaluate(async ({ withPart: saveBench }) => {
    const live = await import("/src/game/live.ts");
    const parts = await import("/src/game/look/parts.ts");
    const store = await import("/src/game/store.ts");
    const world = live.resetWorld();
    const self = world.people.find(({ isPlayer }) => isPlayer);
    self.name = "Local Ash";
    self.cls = "ranger";
    self.look = { schema: "emberhall.look/1", cls: "ranger" };
    if (saveBench) {
      parts.savePart({
        schema: "emberhall.part/1", id: "bench-pin", name: "Bench Pin", slot: "trinket",
        voxels: [{ x: 0, y: 0, z: 0, c: "#e8b96a" }], createdAt: 7, author: "Local Ash", rarity: "common",
      });
    }
    store.useGame.setState({ phase: "playing", openVault: true, panel: "none", snap: live.snapshot(world) });
  }, { withPart });
  await page.getByTestId("vault-panel").waitFor({ state: "visible", timeout: 15000 });
}

// QA SDK adapters only: production UI, oneSat.ts, parsers and local transitions
// are unmodified. These do NOT prove real signing, broadcast or chain finality.
async function installActionAdapters(page) {
  await page.evaluate(async () => {
    const moduleText = await (await fetch('/src/chain/oneSat.ts')).text();
    const moduleUrl = moduleText.match(/["']([^"']*\/@1sat_actions\.js[^"']*)["']/)?.[1];
    if (!moduleUrl) throw new Error('QA could not locate exact Vite SDK module identity');
    const sdk = await import(moduleUrl);
    const wallet = window.__EMBERHALL_SMOKE_WALLET__;
    window.__qa = { mintCalls: [], burnCalls: [], pending: null };
    const defer = (kind, input) => new Promise((resolve) => {
      window.__qa[`${kind}Calls`].push(input);
      window.__qa.pending = { kind, resolve };
    });
    wallet.burn = (input) => defer('burn', input);
    wallet.mint = (input) => defer('mint', input);
    sdk.burnOrdinals.execute = (_ctx, input) => wallet.burn(input);
    sdk.inscribe.execute = (_ctx, input) => wallet.mint(input);
  });
}
async function state(page) {
  return page.evaluate(async () => {
    const live = await import('/src/game/live.ts');
    const parts = await import('/src/game/look/parts.ts');
    const self = live.getWorld().people.find(p => p.isPlayer);
    return { name: self.name, cls: self.cls, look: self.look, parts: parts.listParts() };
  });
}
function check(result, name, passed, expected, actual) {
  result.assertions.push({ name, passed: Boolean(passed), expected, actual });
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const originBad = `${'e'.repeat(64)}.0`;
const originForeign = `${'f'.repeat(64)}.0`;
payloads.set(pointer(originLook2), lookV2);
payloads.set(pointer(originBad), lookMalformed);
payloads.set(pointer(originForeign), { ...lookV1, app: 'foreign-app' });
const row = (origin) => ({ satoshis: 1, spendable: true, outpoint: origin,
  tags: [`id:${origin[0]}-fixture`, 'origin', 'type:application/json'] });
const verdict = { url, ok: true, scope: 'Track A: local browser, fake wallet, no funds or broadcast',
  adapterDisclosure: 'Only @1sat/actions inscribe.execute and burnOrdinals.execute are browser-mocked to deferred fake wallet hooks; app functions under test are unmodified. No real transaction validation claimed.',
  cases: {}, issues: [] };
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
async function runCase(name, docLine, outputs, test, viewport = { width: 1280, height: 800 }) {
  const result = { docLine, assertions: [], errors: [], passed: false };
  verdict.cases[name] = result;
  let page;
  try {
    const opened = await openHall(browser, viewport, { walletOutputs: outputs });
    page = opened.page;
    page.setDefaultTimeout(45000);
    result.errors = opened.errors;
    result.expectedDevFallbacks = opened.expectedDevFallbacks;
    result.blockedExternal = opened.blockedExternal;
    check(result, 'HTTP success', opened.response?.ok(), 200, opened.response?.status());
    await enterHall(page);
    await test(page, result);
  } catch (error) {
    result.exception = error.stack;
  } finally {
    if (page) {
      result.screenshot = resolve(output, `${name}.png`);
      await page.screenshot({ path: result.screenshot }).catch(error => { result.screenshotError = error.message; });
      result.visibleText = await page.locator('body').innerText().catch(() => 'unavailable');
      await page.close();
    }
    result.contractPassed = !result.exception && result.assertions.every(a => a.passed);
    result.passed = result.contractPassed && result.errors.length === 0;
    if (!result.passed) verdict.ok = false;
    for (const failure of result.assertions.filter(a => !a.passed)) verdict.issues.push({ severity: 'contract-failure', case: name, docLine, ...failure });
    for (const error of result.errors) verdict.issues.push({ severity: 'runtime-console-error', case: name, docLine, error });
    writeFileSync(resolve(output, 'verdict.json'), `${JSON.stringify(verdict, null, 2)}\n`);
    console.log(`${name}: contract=${result.contractPassed} consoleErrors=${result.errors.length}${result.exception ? ` exception=${result.exception}` : ''}`);
  }
}
try {
  await runCase('walletless-mint-refusal', 15, undefined, async (page, result) => {
    const before = await state(page);
    const button = page.getByTestId('vault-mint-part-bench-pin');
    const count = await button.count();
    const blocked = count === 0 || await button.isDisabled();
    if (count) await button.dispatchEvent('click');
    const after = await state(page);
    check(result, 'Walletless mint UI refuses action', blocked && await page.getByRole('button', { name: 'Connect a BSV wallet' }).isVisible(), 'absent/disabled mint; connect prompt', { count, blocked });
    check(result, 'No local mutation', same(before, after), before, after);
    result.coverage = 'UI gate only: no walletless mint button is exposed; no synthetic direct mint call claimed.';
  });
  await runCase('corrupt-foreign-look-fallback', 7, [row(originBad), row(originForeign)], async (page, result) => {
    await page.getByTestId('vault-look-section').waitFor();
    await page.waitForFunction(() => !document.body.innerText.includes('Reading wallet'));
    const scan = await page.evaluate(async () => {
      const chain = await import('/src/chain/oneSat.ts');
      return chain.listEmberhallNfts(chain.oneSatCtx(window.__EMBERHALL_SMOKE_WALLET__));
    });
    const after = await state(page);
    const text = await page.getByTestId('vault-panel').innerText();
    check(result, 'Malformed and foreign ignored', scan.length === 0, [], scan);
    check(result, 'Local identity remains fallback', after.name === 'Local Ash' && after.cls === 'ranger', 'Local Ash/ranger', after);
    check(result, 'No accusatory UX', !/cheat|tamper|fraud|banned|forgery|dishonest/i.test(text), 'neutral UI', text);
  });
  await runCase('look-successor-highest-valid', 7, [row(originLook), row(originLook2), row(originBad)], async (page, result) => {
    await page.getByTestId('vault-restore-look').click();
    const after = await state(page);
    const encoded = await page.evaluate(async (previous) => {
      const a = await import('/src/game/chain-artifacts.ts');
      const live = await import('/src/game/live.ts');
      const w = live.getWorld();
      return a.encodeCharacterLookInscription(w, w.people.find(p => p.isPlayer), previous);
    }, { revision: 1, outpoint: originLook });
    check(result, 'Successor revision/predecessor', encoded.revision === 2 && encoded.predecessor === pointer(originLook), { revision: 2, predecessor: pointer(originLook) }, encoded);
    check(result, 'Highest valid look restored by UI', after.name === 'Ada Ash' && after.look.hairStyle === 'long', 'Ada Ash/long', after);
    result.coverage = 'Successor encoder and wallet read/restore UI, not an on-chain look mint.';
  });
  await runCase('look-malformed-later-ignored', 7, [row(originLook), row(originBad)], async (page, result) => {
    await page.getByTestId('vault-restore-look').click();
    const after = await state(page);
    check(result, 'V1 alone restored, malformed V3 ignored', after.name === 'Ada Vale' && after.look.hairStyle === 'tail', 'Ada Vale/tail', after);
  });
  await runCase('duplicate-part-mint', 11, walletOutputs, async (page, result) => {
    await page.getByTestId('vault-restore-look').waitFor();
    await installActionAdapters(page);
    await page.getByTestId('vault-wear-part-bench-pin').click();
    const before = await state(page);
    const mint = page.getByTestId('vault-mint-part-bench-pin');
    await mint.click();
    await page.waitForFunction(() => window.__qa.pending?.kind === 'mint');
    await mint.dispatchEvent('click');
    const pending = await state(page);
    check(result, 'Pending mint preserves bench and outfit', same(before, pending), before, pending);
    await page.evaluate(() => window.__qa.pending.resolve({ txid: '9'.repeat(64) }));
    await mint.waitFor({ state: 'detached' });
    const after = await state(page);
    const evidence = await page.evaluate(async () => {
      const a = await import('/src/game/chain-artifacts.ts');
      const live = await import('/src/game/live.ts');
      return { calls: window.__qa.mintCalls.length, duplicate: a.applyMintPart(live.getWorld(), 'bench-pin') };
    });
    check(result, 'Single mint and removed part/outfit; duplicate refused', evidence.calls === 1 && evidence.duplicate === 'No such sculpture.' && !after.parts.some(p => p.id === 'bench-pin') && !after.look.parts?.includes('bench-pin'), 'one fake wallet mint; no bench/outfit duplicate', { evidence, after });
  });
  await runCase('redeem-exact-part-and-tamper', 11, walletOutputs, async (page, result) => {
    await page.getByTestId('vault-redeem-part-chain-crown').waitFor();
    await installActionAdapters(page);
    const before = await state(page);
    await page.getByTestId('vault-redeem-part-chain-crown').click();
    await page.waitForFunction(() => window.__qa.pending?.kind === 'burn');
    const pending = await state(page);
    const burnInput = await page.evaluate(() => window.__qa.burnCalls);
    check(result, 'Actual UI awaits fake wallet burn before restore', same(before, pending) && burnInput.length === 1 && burnInput[0].ids[0] === 'part-now', 'no local restore while wallet burn promise pending', { before, pending, burnInput });
    await page.evaluate(() => window.__qa.pending.resolve({ txid: '8'.repeat(64) }));
    await page.waitForFunction(async () => (await import('/src/game/look/parts.ts')).listParts().some(p => p.name === 'Chain Crown'));
    const after = await state(page);
    const restored = after.parts.find(p => p.name === 'Chain Crown');
    const expected = payloads.get(pointer(originPart)).part;
    check(result, 'Exact SAME original part ID', restored?.id === expected.id, expected.id, restored?.id);
    check(result, 'Exact slot/voxels/colors/metadata', same({ ...restored, id: expected.id }, expected), expected, restored);
    await page.getByTestId(`vault-wear-part-${restored.id}`).click();
    const worn = await state(page);
    check(result, 'Restored part wearable', worn.look.parts?.includes(restored.id), restored.id, worn.look.parts);
    const tamper = await page.evaluate(async (original) => {
      const a = await import('/src/game/chain-artifacts.ts');
      const changed = structuredClone(original);
      changed.part.voxels[0].c = '#112233'; // valid unique voxel, unchanged ID
      const invalid = structuredClone(original);
      invalid.part.voxels[1] = { ...invalid.part.voxels[0] };
      return { original: a.decodePartInscription(original), changed, decoded: a.decodePartInscription(changed), malformedDecoded: a.decodePartInscription(invalid) };
    }, payloads.get(pointer(originPart)));
    check(result, 'Same-ID valid voxel tamper rejected', tamper.original !== null && tamper.decoded === null, 'changed color under same ID rejected', tamper);
    check(result, 'Malformed duplicate coordinates still rejected', tamper.malformedDecoded === null, null, tamper.malformedDecoded);
    result.tamperScope = 'Acceptance expectation is stronger than doc line 15 silent client-beta structural parsing; report mismatch, not a cryptographic security claim.';
  });
  // Preserve the prior desktop/mobile layout and listed-item affordance intent.
  for (const viewport of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'mobile', width: 390, height: 844 }]) {
    await runCase(viewport.name, 11, walletOutputs, async (page, result) => {
      await page.getByTestId('vault-restore-look').click();
      const restored = await state(page);
      check(result, 'Fixture look restored', restored.name === 'Ada Vale', 'Ada Vale', restored.name);
      const listedRow = page.getByText('Market Cloak', { exact: false }).first().locator('..').locator('..');
      const cancel = await listedRow.getByRole('button', { name: 'Cancel listing' }).isVisible();
      const redeem = await page.getByTestId('vault-redeem-part-market-cloak').count();
      check(result, 'Listed item cancel, not redeem', cancel && redeem === 0, 'cancel only', { cancel, redeem });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      const scroll = await page.getByTestId('vault-panel').evaluate(panel => {
        const canScroll = panel.scrollHeight > panel.clientHeight;
        panel.scrollTop = panel.scrollHeight;
        return { canScroll, reachedBottom: panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1 };
      });
      check(result, 'No horizontal overflow and panel scrolls to bottom', !overflow && scroll.canScroll && scroll.reachedBottom, 'scrollable, no overflow', { overflow, scroll });
    }, viewport);
  }
} finally {
  await browser.close();
  writeFileSync(resolve(output, 'verdict.json'), `${JSON.stringify(verdict, null, 2)}\n`);
}
console.log(JSON.stringify({ ok: verdict.ok, cases: Object.keys(verdict.cases), issues: verdict.issues }, null, 2));
if (!verdict.ok) process.exitCode = 1;
