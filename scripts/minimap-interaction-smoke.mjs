#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.env.EMBERHALL_URL || "http://127.0.0.1:8080/";
const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const viewport of viewports) {
    console.log(`[${viewport.name}] opening game`);
    const context = await browser.newContext({ viewport });
    let page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.__ember?.useGame));
    await page.evaluate(() => window.__ember.useGame.setState({ phase: "playing" }));

    const minimap = page.getByTestId("movable-minimap");
    await minimap.waitFor();
    console.log(`[${viewport.name}] dragging`);
    const initial = await minimap.boundingBox();
    assert.ok(initial, `${viewport.name}: mini-map should render`);

    const dragHandle = page.getByTestId("minimap-drag-handle");
    const dragBox = await dragHandle.boundingBox();
    assert.ok(dragBox, `${viewport.name}: drag handle should render`);
    await page.mouse.move(dragBox.x + 20, dragBox.y + 20);
    await page.mouse.down();
    await page.mouse.move(48, 72, { steps: 1 });
    await page.mouse.up();

    const moved = await minimap.boundingBox();
    assert.ok(moved, `${viewport.name}: moved mini-map should render`);
    assert.ok(Math.abs(moved.x - initial.x) > 10 || Math.abs(moved.y - initial.y) > 10, `${viewport.name}: drag should reposition the mini-map`);

    let resize = page.getByTestId("minimap-resize-handle");
    console.log(`[${viewport.name}] resizing to maximum`);
    let resizeBox = await resize.boundingBox();
    assert.ok(resizeBox, `${viewport.name}: resize handle should render`);
    await page.mouse.move(resizeBox.x + 30, resizeBox.y + 30);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x + 500, resizeBox.y + 500, { steps: 1 });
    await page.mouse.up();
    const maximum = await minimap.boundingBox();
    assert.ok(maximum && maximum.width === 320, `${viewport.name}: resize should stop at 320px`);

    resize = page.getByTestId("minimap-resize-handle");
    console.log(`[${viewport.name}] resizing to minimum`);
    resizeBox = await resize.boundingBox();
    assert.ok(resizeBox, `${viewport.name}: resized handle should render`);
    await page.mouse.move(resizeBox.x + 30, resizeBox.y + 30);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x - 500, resizeBox.y - 500, { steps: 1 });
    await page.mouse.up();
    const minimum = await minimap.boundingBox();
    assert.ok(minimum && minimum.width === 128, `${viewport.name}: resize should stop at 128px`);

    console.log(`[${viewport.name}] minimizing and restoring`);
    await page.getByRole("button", { name: "Minimize mini-map" }).click();
    const restore = page.getByTestId("minimap-restore");
    await restore.waitFor();
    assert.equal(await minimap.count(), 0, `${viewport.name}: expanded map should hide when minimized`);
    const icon = await restore.boundingBox();
    assert.ok(icon && icon.width === 44 && icon.height === 44, `${viewport.name}: minimized map should be a 44px icon`);

    await restore.click();
    await minimap.waitFor();
    const restored = await minimap.boundingBox();
    assert.ok(restored && restored.width === 128, `${viewport.name}: restoring should preserve the chosen size`);

    const savedBeforeReload = await page.evaluate(() => localStorage.getItem("emberhall-minimap-layout-v1"));
    console.log(`[${viewport.name}] reloading persisted layout`);
    assert.ok(savedBeforeReload, `${viewport.name}: layout should persist`);
    await page.close();
    page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForFunction(() => Boolean(window.__ember?.useGame));
    await page.evaluate(() => window.__ember.useGame.setState({ phase: "playing" }));
    await page.getByTestId("movable-minimap").waitFor();
    assert.equal(
      await page.evaluate(() => localStorage.getItem("emberhall-minimap-layout-v1")),
      savedBeforeReload,
      `${viewport.name}: reload should preserve layout`,
    );

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert.equal(overflow, false, `${viewport.name}: controls should not cause horizontal overflow`);
    assert.deepEqual(errors, [], `${viewport.name}: browser console should stay clean`);

    results.push({
      viewport: viewport.name,
      initial: { x: initial.x, y: initial.y, width: initial.width },
      moved: { x: moved.x, y: moved.y },
      bounds: { min: minimum.width, max: maximum.width },
      minimized: { width: icon.width, height: icon.height },
      persisted: true,
      consoleErrors: errors.length,
    });
    await context.close();
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
} finally {
  await browser.close();
}
