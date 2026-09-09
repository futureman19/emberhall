#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const url = process.env.EMBERHALL_URL || "http://127.0.0.1:4178/";
const outDir = dirname(fileURLToPath(import.meta.url));
mkdirSync(outDir, { recursive: true });

function overlap(a, b) {
  if (!a || !b) return null;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.width, b.x + b.width);
  const btm = Math.min(a.y + a.height, b.y + b.height);
  const w = r - x;
  const h = btm - y;
  if (w <= 0 || h <= 0) return { overlaps: false, area: 0 };
  return { overlaps: true, area: w * h, x, y, width: w, height: h };
}

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 960 },
];

const browser = await chromium.launch({ headless: true });
const report = { url, capturedAt: new Date().toISOString(), viewports: [] };

try {
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.__ember?.useGame));
    await page.evaluate(() => window.__ember.useGame.setState({ phase: "playing" }));
    await page.getByTestId("movable-minimap").waitFor();
    await page.waitForTimeout(400);

    const boxes = await page.evaluate(() => {
      const minimap = document.querySelector('[data-testid="movable-minimap"]');
      const dock = Array.from(document.querySelectorAll("div")).find(
        (el) =>
          el.className.includes("absolute") &&
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
        const btn = document.querySelector(`[aria-label="${label}"]`);
        buttons[label] = rect(btn);
      }
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        minimap: rect(minimap),
        dock: rect(dock),
        buttons,
        layout: localStorage.getItem("emberhall-minimap-layout-v1"),
      };
    });

    const hit = overlap(boxes.minimap, boxes.dock);
    const coveredButtons = Object.entries(boxes.buttons)
      .filter(([, box]) => overlap(boxes.minimap, box)?.overlaps)
      .map(([name]) => name);

    const png = join(outDir, `before-${vp.name}.png`);
    await page.screenshot({ path: png, fullPage: false });

    report.viewports.push({
      name: vp.name,
      ...boxes,
      dockOverlap: hit,
      coveredButtons,
      screenshot: png,
    });
    await context.close();
  }
} finally {
  await browser.close();
}

writeFileSync(join(outDir, "before.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
const mobile = report.viewports.find((v) => v.name === "mobile");
process.exit(mobile?.dockOverlap?.overlaps ? 2 : 0);
