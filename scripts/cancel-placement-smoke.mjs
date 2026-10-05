#!/usr/bin/env node
/**
 * Smoke: an armed shade lets go via Esc, right-click and touch long-press —
 * and a quick tap does NOT cancel. Uses trusted input (Playwright mouse/
 * keyboard + CDP touch) against the dev server.
 *
 * Module identity matters: after HMR the app imports ?t=-stamped modules, so
 * bare "/src/game/store.ts" would be a SECOND zustand instance. We resolve the
 * exact specifiers the served hud.tsx uses and import those everywhere.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const url = process.env.CANCEL_SMOKE_URL || "http://127.0.0.1:8080/";
const output = resolve(process.env.CANCEL_SMOKE_OUTPUT_DIR || "screenshots/cancel-placement-smoke");
mkdirSync(output, { recursive: true });

const verdict = { url, ok: true, steps: {}, errors: [] };
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  page.on("pageerror", (error) => verdict.errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") verdict.errors.push(`console: ${message.text()}`);
  });
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.getByText("New hall").waitFor({ state: "visible", timeout: 45000 });

  const mods = await page.evaluate(async () => {
    const src = await (await fetch("/src/components/game/hud.tsx")).text();
    return {
      store: src.match(/from "(\/src\/game\/store\.ts[^"]*)"/)?.[1] ?? "/src/game/store.ts",
      live: src.match(/from "(\/src\/game\/live\.ts[^"]*)"/)?.[1] ?? "/src/game/live.ts",
    };
  });
  verdict.steps.modules = mods;

  // Fixture: playing world, sim frozen so no frame-driven DOM churn.
  await page.evaluate(async ({ live, store }) => {
    const liveMod = await import(live);
    const storeMod = await import(store);
    liveMod.resetWorld();
    storeMod.useGame.setState({ phase: "playing", panel: "none", snap: liveMod.snapshot(liveMod.getWorld()) });
    storeMod.useGame.getState().tick = () => {};
  }, mods);
  await page.waitForTimeout(500);

  // The R3F world canvas = the largest canvas on screen (minimap etc. are smaller).
  const world = await page.evaluate(() => {
    let best = null;
    for (const c of document.querySelectorAll("canvas")) {
      const r = c.getBoundingClientRect();
      if (!best || r.width * r.height > best.area) best = { area: r.width * r.height, x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return best ? { cx: best.x + best.w / 2, cy: best.y + best.h / 2 } : null;
  });
  if (!world) throw new Error("no canvas found");
  verdict.steps.canvas = world;

  const arm = () =>
    page.evaluate(async ({ store }) => {
      const storeMod = await import(store);
      storeMod.useGame.getState().armBuild("dormitory");
      return storeMod.useGame.getState().buildKind;
    }, mods);
  const armedKind = () =>
    page.evaluate(async ({ store }) => (await import(store)).useGame.getState().buildKind, mods);

  // 1. Quick tap: shade stays (tap = place intent, not cancel).
  verdict.steps.armed1 = await arm();
  {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: world.cx, y: world.cy, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await page.waitForTimeout(150);
  verdict.steps.tap_keeps_shade = await armedKind();

  // 2. Long-press (700ms > TOUCH_HOLD_MS 550): shade lets go.
  {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: world.cx, y: world.cy, id: 2 }] });
    await page.waitForTimeout(700);
    verdict.steps.long_press_mid_hold = await armedKind();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await page.waitForTimeout(150);
  verdict.steps.long_press_after = await armedKind();

  // 3. Right-click lets it go.
  verdict.steps.armed3 = await arm();
  await page.mouse.click(world.cx, world.cy, { button: "right" });
  await page.waitForTimeout(150);
  verdict.steps.right_click_after = await armedKind();

  // 4. Escape lets it go.
  verdict.steps.armed4 = await arm();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  verdict.steps.escape_after = await armedKind();

  const screenshot = resolve(output, "mobile.png");
  await page.screenshot({ path: screenshot, fullPage: false });

  const s = verdict.steps;
  const passed =
    response?.ok() &&
    s.armed1 === "dormitory" &&
    s.tap_keeps_shade === "dormitory" &&
    s.long_press_after === null &&
    s.armed3 === "dormitory" &&
    s.right_click_after === null &&
    s.armed4 === "dormitory" &&
    s.escape_after === null &&
    verdict.errors.length === 0;
  verdict.ok = passed;
  verdict.screenshot = screenshot;
  await page.close();
} finally {
  await browser.close();
}

writeFileSync(resolve(output, "verdict.json"), JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
if (!verdict.ok) process.exitCode = 1;
