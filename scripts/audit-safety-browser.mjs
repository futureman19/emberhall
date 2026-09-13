import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const out = new URL('../plans/safety-browser/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? {width:390,height:844} : {width:1280,height:800}, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    console.log('START',mobile);
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8180', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'title');
    await page.waitForTimeout(500);
    await page.getByRole('button', {name:'New hall', exact:true}).waitFor();
    assert.equal(await page.getByText('Sign in', {exact:true}).count(), 0);
    if (mobile) await page.getByRole('button',{name:'New hall',exact:true}).tap();
    else await page.getByRole('button',{name:'New hall',exact:true}).click();
    await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'intro');
    // Controlled intro bypass; this probe verifies save handling, not onboarding.
    await page.evaluate(() => window.__ember.useGame.setState({phase:'playing'}));
    await page.waitForTimeout(1500);
    const data = await page.evaluate(() => {
      const game = window.__ember.useGame;
      const world = window.__ember.getWorld();
      const valid = game.getState().saveNow();
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function() { throw new DOMException('controlled quota', 'QuotaExceededError'); };
      const failed = game.getState().saveNow();
      const message = game.getState().saveError;
      const toast = game.getState().toast;
      Storage.prototype.setItem = original;
      const retried = game.getState().saveNow();
      const cleared = game.getState().saveError;
      return {valid, failed, message, toast, retried, cleared, gold:world.gold};
    });
    assert.equal(data.valid,true); assert.equal(data.failed,false);
    assert.match(data.message,/could not be saved/); assert.equal(data.message,data.toast);
    assert.equal(data.retried,true); assert.equal(data.cleared,null);
    await page.screenshot({path:new URL(mobile?'portrait.png':'desktop.png',out).pathname.replace(/^\/(\w:)/,'$1')});
    console.log('SAVED',mobile);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Continue',exact:true}).waitFor();
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'playing');
    assert.equal(await page.evaluate(() => window.__ember.getWorld().gold),data.gold);
    assert.deepEqual(errors,[]);
    results.push({viewport:mobile?'portrait-emulated-touch':'desktop',nativeStart:true,controlledIntroBypass:true,controlledStorageFailure:data,continueReload:true,pageErrors:errors});
    await writeFile(new URL('results.json',out),JSON.stringify(results,null,2));
    console.log('PASS',mobile);
    await context.close();
  }
  await writeFile(new URL('results.json',out),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
