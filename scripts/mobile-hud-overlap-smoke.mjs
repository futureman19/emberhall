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
  await page.getByTestId("bottom-band").waitFor();
  await page.getByTestId("bottom-dock").waitFor();
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null; // hidden (display:none) chrome
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const buttons = {};
    for (const label of ["Guide", "Hold", "Spellbook", "Work"]) {
      buttons[label] = rect(document.querySelector(`[aria-label="${label}"]`));
    }
    return {
      minimap: rect(document.querySelector('[data-testid="docked-minimap"]')),
      band: rect(document.querySelector('[data-testid="bottom-band"]')),
      rail: rect(document.querySelector('[data-testid="right-rail"]')),
      dock: rect(document.querySelector('[data-testid="bottom-dock"]')),
      buttons,
      dockFlag: localStorage.getItem("emberhall-minimap-dock-v1"),
    };
  });
}

async function play(page) {
  await page.waitForFunction(() => Boolean(window.__ember?.useGame));
  await page.evaluate(() => window.__ember.useGame.setState({ phase: "playing" }));
}

function assertButtonsClear(boxes, minimap, band, prefix) {
  for (const [name, box] of Object.entries(boxes)) {
    assert.ok(box && box.width === 44 && box.height === 44, `${prefix} ${name} 44px`);
    if (minimap) assert.equal(overlap(minimap, box).overlaps, false, `${prefix} ${name} uncovered by minimap`);
    assert.ok(box.y + box.height <= band.y + band.height + 1, `${prefix} ${name} inside the band`);
  }
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
  assert.equal(mobileDefault.minimap, null, "mobile default: minimap starts collapsed");
  assert.equal(mobileDefault.rail, null, "mobile default: rail folds away");
  assert.ok(mobileDefault.band && mobileDefault.band.height >= 56, "mobile default: band present");
  assertButtonsClear(mobileDefault.buttons, mobileDefault.minimap, mobileDefault.band, "mobile default");
  report.cases.push({ name: "mobile-default", ...mobileDefault });

  await mobilePage.locator('button[aria-label="Show mini-map"]:visible').click();
  const mobileShown = await measure(mobilePage);
  await mobilePage.screenshot({ path: join(outDir, "after-mobile-map.png") });
  assert.ok(mobileShown.minimap, "mobile: map toggle expands the minimap");
  assert.equal(overlap(mobileShown.minimap, mobileShown.band).overlaps, false, "mobile: expanded minimap clears the band");
  assertButtonsClear(mobileShown.buttons, mobileShown.minimap, mobileShown.band, "mobile map shown");
  report.cases.push({ name: "mobile-map-shown", ...mobileShown });

  await mobilePage.evaluate(() => localStorage.setItem("emberhall-minimap-dock-v1", "0"));
  await mobilePage.reload({ waitUntil: "domcontentloaded" });
  await play(mobilePage);
  const mobileGrown = await measure(mobilePage);
  assert.ok(mobileGrown.minimap, "mobile persisted-open: minimap returns");
  assert.equal(overlap(mobileGrown.minimap, mobileGrown.band).overlaps, false, "mobile persisted-open: minimap clears the band");
  assertButtonsClear(mobileGrown.buttons, mobileGrown.minimap, mobileGrown.band, "mobile persisted-open");
  report.cases.push({ name: "mobile-persisted-open", ...mobileGrown });
  await mobile.close();

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const desktopPage = await desktop.newPage();
  desktopPage.setDefaultTimeout(30_000);
  await desktopPage.goto(url, { waitUntil: "domcontentloaded" });
  await desktopPage.evaluate(() => localStorage.removeItem("emberhall-minimap-dock-v1"));
  await desktopPage.reload({ waitUntil: "domcontentloaded" });
  await play(desktopPage);
  const desktopDefault = await measure(desktopPage);
  await desktopPage.screenshot({ path: join(outDir, "after-desktop.png") });
  assert.ok(desktopDefault.rail, "desktop default: rail present");
  assert.ok(desktopDefault.minimap, "desktop default: minimap expanded");
  assert.ok(Math.abs(desktopDefault.rail.y + desktopDefault.rail.height - desktopDefault.band.y) <= 1, "desktop: rail meets the band (L joint)");
  assert.equal(overlap(desktopDefault.minimap, desktopDefault.band).overlaps, false, "desktop default: minimap clears the band");
  assert.equal(overlap(desktopDefault.minimap, desktopDefault.rail).overlaps, false, "desktop default: minimap clears the rail");
  assertButtonsClear(desktopDefault.buttons, desktopDefault.minimap, desktopDefault.band, "desktop default");
  report.cases.push({ name: "desktop-default", ...desktopDefault });

  await desktopPage.getByTestId("right-rail").getByLabel("Hide mini-map").click();
  const desktopHidden = await measure(desktopPage);
  assert.equal(desktopHidden.minimap, null, "desktop: rail toggle collapses the minimap");
  assert.ok(desktopHidden.rail, "desktop: rail stays when the map hides");
  report.cases.push({ name: "desktop-map-hidden", ...desktopHidden });
  await desktop.close();
} finally {
  await browser.close();
}

writeFileSync(join(outDir, "after.json"), JSON.stringify({ ok: true, ...report }, null, 2));
console.log(JSON.stringify({ ok: true, cases: report.cases.map((c) => ({ name: c.name, dockFlag: c.dockFlag })) }, null, 2));
