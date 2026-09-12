#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const url = process.env.EMBERHALL_URL || "http://127.0.0.1:4178/";
const outDir = join(dirname(fileURLToPath(import.meta.url)), "../art/verification/mobile-hud");
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

async function measure(page) {
  await page.getByTestId("movable-minimap").waitFor();
  await page.getByTestId("bottom-dock").waitFor();
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const buttons = {};
    for (const label of ["Guide", "Hold", "Spellbook", "Work"]) {
      buttons[label] = rect(document.querySelector(`[aria-label="${label}"]`));
    }
    return {
      minimap: rect(document.querySelector('[data-testid="movable-minimap"]')),
      dock: rect(document.querySelector('[data-testid="bottom-dock"]')),
      buttons,
      layout: localStorage.getItem("emberhall-minimap-layout-v1"),
    };
  });
}

async function play(page) {
  await page.waitForFunction(() => Boolean(window.__ember?.useGame));
  await page.evaluate(() => window.__ember.useGame.setState({ phase: "playing" }));
}

const browser = await chromium.launch({ headless: true });
const report = { url, cases: [] };

try {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage();
  mobilePage.setDefaultTimeout(30_000);
  await mobilePage.goto(url, { waitUntil: "domcontentloaded" });
  await play(mobilePage);
  const mobileDefault = await measure(mobilePage);
  await mobilePage.screenshot({ path: join(outDir, "after-mobile.png") });
  assert.equal(overlap(mobileDefault.minimap, mobileDefault.dock).overlaps, false, "mobile default: minimap vs dock");
  for (const [name, box] of Object.entries(mobileDefault.buttons)) {
    assert.ok(box && box.width === 44 && box.height === 44, `mobile default ${name} 44px`);
    assert.equal(overlap(mobileDefault.minimap, box).overlaps, false, `mobile default ${name} uncovered`);
  }
  report.cases.push({ name: "mobile-default", ...mobileDefault, dockOverlap: overlap(mobileDefault.minimap, mobileDefault.dock) });

  await mobilePage.evaluate(() => {
    localStorage.setItem(
      "emberhall-minimap-layout-v1",
      JSON.stringify({ x: 200, y: 700, size: 220, minimized: false }),
    );
  });
  await mobilePage.reload({ waitUntil: "domcontentloaded" });
  await play(mobilePage);
  const mobileGrown = await measure(mobilePage);
  await mobilePage.screenshot({ path: join(outDir, "after-mobile-grown.png") });
  assert.equal(overlap(mobileGrown.minimap, mobileGrown.dock).overlaps, false, "mobile grown: minimap vs dock");
  assert.equal(mobileGrown.minimap.width, 220, "grown size preserved");
  for (const [name, box] of Object.entries(mobileGrown.buttons)) {
    assert.ok(box && box.width === 44 && box.height === 44, `mobile grown ${name} 44px`);
    assert.equal(overlap(mobileGrown.minimap, box).overlaps, false, `mobile grown ${name} uncovered`);
  }
  report.cases.push({ name: "mobile-grown", ...mobileGrown, dockOverlap: overlap(mobileGrown.minimap, mobileGrown.dock) });
  await mobile.close();

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const desktopPage = await desktop.newPage();
  desktopPage.setDefaultTimeout(30_000);
  await desktopPage.goto(url, { waitUntil: "domcontentloaded" });
  await play(desktopPage);
  const desktopDefault = await measure(desktopPage);
  await desktopPage.screenshot({ path: join(outDir, "after-desktop.png") });
  assert.equal(desktopDefault.minimap.x, 1268, "desktop default x unchanged");
  assert.equal(desktopDefault.minimap.y, 720, "desktop default y unchanged");
  assert.equal(desktopDefault.minimap.width, 160, "desktop default size unchanged");
  assert.equal(overlap(desktopDefault.minimap, desktopDefault.dock).overlaps, false, "desktop default: minimap vs dock");
  for (const [name, box] of Object.entries(desktopDefault.buttons)) {
    assert.ok(box && box.width === 44 && box.height === 44, `desktop ${name} 44px`);
  }
  report.cases.push({ name: "desktop-default", ...desktopDefault, dockOverlap: overlap(desktopDefault.minimap, desktopDefault.dock) });
  await desktop.close();
} finally {
  await browser.close();
}

writeFileSync(join(outDir, "after.json"), JSON.stringify({ ok: true, ...report }, null, 2));
console.log(JSON.stringify({ ok: true, cases: report.cases }, null, 2));
