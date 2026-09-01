#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.EMBERHALL_URL || "http://127.0.0.1:8080/";
const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

function qaUrl() {
  const url = new URL(baseUrl);
  url.searchParams.set("qa", "1");
  return url.toString();
}

async function enterGame(page) {
  await page.goto(qaUrl(), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__ember?.useGame && window.__emberGraphicsRuntime));
  await page.evaluate(() => window.__ember.useGame.getState().begin(true));
  await page.waitForFunction(() => window.__ember.getWorld().people.length > 0, undefined, { timeout: 30_000 });
  await page.waitForFunction(
    () => ["intro", "looking", "playing"].includes(window.__ember.useGame.getState().phase),
    undefined,
    { timeout: 30_000 },
  );
  await page.evaluate(() => window.__ember.useGame.setState({ phase: "playing" }));
  await page.waitForFunction(() => (window.__emberGraphicsRuntime?.getState().farTreeCount ?? 0) > 0);
}

const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const viewport of viewports) {
    console.log(`[${viewport.name}] opening graphics settings`);
    const context = await browser.newContext({ viewport });
    let page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const errors = [];
    const watch = (target) => {
      target.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      target.on("pageerror", (error) => errors.push(error.message));
    };
    watch(page);
    await enterGame(page);

    const initial = await page.evaluate(() => window.__emberGraphicsRuntime.getState());
    assert.equal(initial.shadows, true, `${viewport.name}: shadows should default on`);
    const canvasHost = page.locator('[data-graphics-shadows="on"]');
    await canvasHost.waitFor();

    await page.getByRole("button", { name: "Settings — sound, graphics and the Vault" }).click();
    await page.getByRole("dialog", { name: "Settings — sound, graphics and the Vault" }).waitFor();
    await page.getByText("Graphics", { exact: true }).waitFor();

    await page.getByRole("button", { name: "Dynamic shadows: on" }).click();
    await page.waitForFunction(() => window.__emberGraphicsRuntime?.getState().shadows === false);
    await page.locator('[data-graphics-shadows="off"]').waitFor();

    console.log(`[${viewport.name}] reducing distant trees`);
    await page.getByRole("button", { name: "Distant trees: 15% fewer" }).click();
    await page.locator('[data-horizon-tree-reduction="15"]').waitFor();
    await page.waitForTimeout(250);
    const reduced15 = await page.evaluate(() => window.__emberGraphicsRuntime.getState().farTreeCount);

    await page.getByRole("button", { name: "Distant trees: 30% fewer" }).click();
    await page.locator('[data-horizon-tree-reduction="30"]').waitFor();
    await page.waitForTimeout(250);
    const reduced30 = await page.evaluate(() => window.__emberGraphicsRuntime.getState().farTreeCount);
    assert.ok(reduced15 !== null && reduced30 !== null, `${viewport.name}: tree counts should be observable`);
    assert.ok(reduced15 <= initial.farTreeCount, `${viewport.name}: 15% setting should not increase trees`);
    assert.ok(reduced30 < reduced15, `${viewport.name}: 30% setting should process fewer trees than 15%`);

    const saved = await page.evaluate(() => localStorage.getItem("emberhall-graphics-v1"));
    assert.equal(saved, JSON.stringify({ shadows: false, horizonTreeReduction: 30 }), `${viewport.name}: graphics choices should persist`);

    console.log(`[${viewport.name}] checking screen-space rain`);
    await page.evaluate(() => {
      const world = window.__ember.getWorld();
      world.weather.kind = "storm";
      world.weather.cloud = 1;
      world.weather.untilHour = world.hour + 20;
      window.__ember.useGame.getState().tick(0.1);
    });
    const rain = page.getByTestId("screen-rain");
    await page.waitForFunction(() => document.querySelector('[data-testid="screen-rain"]')?.getAttribute("data-active") === "true");
    assert.equal(await rain.locator("span").count(), 2, `${viewport.name}: rain should use two viewport layers`);
    assert.ok(Number(await rain.evaluate((element) => getComputedStyle(element).opacity)) > 0, `${viewport.name}: storm rain should be visible`);
    assert.equal(
      await rain.locator("span").first().evaluate((element) => getComputedStyle(element).animationPlayState),
      "running",
      `${viewport.name}: visible rain should animate`,
    );

    await page.evaluate(() => {
      const world = window.__ember.getWorld();
      world.weather.kind = "clear";
      world.weather.cloud = 0.06;
      world.weather.untilHour = world.hour + 20;
      window.__ember.useGame.getState().tick(0.1);
    });
    await page.waitForFunction(() => document.querySelector('[data-testid="screen-rain"]')?.getAttribute("data-active") === "false");

    console.log(`[${viewport.name}] reopening persisted graphics`);
    await page.close();
    page = await context.newPage();
    page.setDefaultTimeout(20_000);
    watch(page);
    await enterGame(page);
    await page.waitForFunction(() => {
      const state = window.__emberGraphicsRuntime?.getState();
      return state?.shadows === false && document.querySelector('[data-horizon-tree-reduction="30"]');
    });
    const persisted = await page.evaluate(() => window.__emberGraphicsRuntime.getState());
    assert.equal(persisted.shadows, false, `${viewport.name}: shadow choice should survive reopening`);
    assert.equal(
      await page.locator('[data-horizon-tree-reduction="30"]').count(),
      1,
      `${viewport.name}: tree reduction should survive reopening`,
    );

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert.equal(overflow, false, `${viewport.name}: settings should not cause horizontal overflow`);
    assert.deepEqual(errors, [], `${viewport.name}: console should stay clean`);

    results.push({
      viewport: viewport.name,
      shadows: { initial: initial.shadows, persisted: persisted.shadows },
      farTrees: { full: initial.farTreeCount, reduced15, reduced30 },
      rainLayers: 2,
      persisted: true,
      consoleErrors: errors.length,
    });
    await context.close();
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
} finally {
  await browser.close();
}
