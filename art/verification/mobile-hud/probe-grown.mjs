#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const url = process.env.EMBERHALL_URL || "http://127.0.0.1:4178/";
const outDir = dirname(fileURLToPath(import.meta.url));
mkdirSync(outDir, { recursive: true });

function overlap(a, b) {
  if (!a || !b) return { overlaps: false, area: 0 };
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.width, b.x + b.width);
  const btm = Math.min(a.y + a.height, b.y + b.height);
  const w = r - x;
  const h = btm - y;
  if (w <= 0 || h <= 0) return { overlaps: false, area: 0 };
  return { overlaps: true, area: w * h, x, y, width: w, height: h };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.setDefaultTimeout(30_000);
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__ember?.useGame));
await page.evaluate(() => {
  localStorage.setItem(
    "emberhall-minimap-layout-v1",
    JSON.stringify({ x: 200, y: 700, size: 220, minimized: false }),
  );
  window.__ember.useGame.setState({ phase: "playing" });
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__ember?.useGame));
await page.evaluate(() => window.__ember.useGame.setState({ phase: "playing" }));
await page.getByTestId("movable-minimap").waitFor();
await page.waitForTimeout(400);

const boxes = await page.evaluate(() => {
  const minimap = document.querySelector('[data-testid="movable-minimap"]');
  const dock = Array.from(document.querySelectorAll("div")).find(
    (el) =>
      el.className.includes("bottom-3") &&
      el.className.includes("left-1/2") &&
      el.querySelector('[aria-label="Guide"]'),
  );
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  };
  const buttons = {};
  for (const label of ["Guide", "Hold", "Spellbook", "Work"]) {
    buttons[label] = rect(document.querySelector(`[aria-label="${label}"]`));
  }
  return { minimap: rect(minimap), dock: rect(dock), buttons, layout: localStorage.getItem("emberhall-minimap-layout-v1") };
});

const png = join(outDir, "before-mobile-grown.png");
await page.screenshot({ path: png, fullPage: false });
const dockOverlap = overlap(boxes.minimap, boxes.dock);
const coveredButtons = Object.entries(boxes.buttons)
  .filter(([, box]) => overlap(boxes.minimap, box).overlaps)
  .map(([name]) => name);
const report = { ...boxes, dockOverlap, coveredButtons, screenshot: png };
writeFileSync(join(outDir, "before-grown.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(dockOverlap.overlaps ? 2 : 0);
