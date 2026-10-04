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
      drawer: rect(document.querySelector('[data-testid="you-drawer"]')),
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

function assertButtonsClear(boxes, minimap, prefix) {
  for (const [name, box] of Object.entries(boxes)) {
    assert.ok(box && box.width === 44 && box.height === 44, `${prefix} ${name} 44px`);
    if (minimap) assert.equal(overlap(minimap, box).overlaps, false, `${prefix} ${name} uncovered by minimap`);
  }
}

function assertCorner(m, vw, vh, prefix) {
  assert.ok(m.minimap, `${prefix}: corner block present`);
  assert.ok(Math.abs(m.minimap.x + m.minimap.width - vw) <= 1, `${prefix}: block flush to the right edge`);
  assert.ok(Math.abs(m.minimap.y + m.minimap.height - vh) <= 1, `${prefix}: block flush to the bottom edge`);
  assert.ok(Math.abs(m.band.x + m.band.width - m.minimap.x) <= 1, `${prefix}: band ends at the block's left edge`);
  if (m.rail) assert.ok(Math.abs(m.rail.y + m.rail.height - m.minimap.y) <= 1, `${prefix}: rail ends at the block's top`);
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
  assertButtonsClear(mobileDefault.buttons, mobileDefault.minimap, "mobile default");
  report.cases.push({ name: "mobile-default", ...mobileDefault });

  await mobilePage.locator('button[aria-label="Show mini-map"]:visible').click();
  const mobileShown = await measure(mobilePage);
  await mobilePage.screenshot({ path: join(outDir, "after-mobile-map.png") });
  assertCorner(mobileShown, 390, 844, "mobile map shown");
  assertButtonsClear(mobileShown.buttons, mobileShown.minimap, "mobile map shown");
  report.cases.push({ name: "mobile-map-shown", ...mobileShown });

  await mobilePage.locator('button[aria-label="You — pack, paperdoll, skills"]:visible').click();
  const mobileDrawer = await measure(mobilePage);
  await mobilePage.screenshot({ path: join(outDir, "after-mobile-drawer.png") });
  assert.ok(mobileDrawer.drawer, "mobile: You pops the drawer");
  assert.ok(Math.abs(mobileDrawer.drawer.x + mobileDrawer.drawer.width - 390) <= 1, "mobile: drawer flush to the right edge");
  assert.equal(overlap(mobileDrawer.drawer, mobileDrawer.band).overlaps, false, "mobile: drawer clears the band");
  await mobilePage.keyboard.press("Escape");
  const mobileDrawerClosed = await measure(mobilePage);
  assert.equal(mobileDrawerClosed.drawer, null, "mobile: Escape puts the drawer away");
  report.cases.push({ name: "mobile-drawer", ...mobileDrawer });

  await mobilePage.reload({ waitUntil: "domcontentloaded" });
  await play(mobilePage);
  const mobilePersist = await measure(mobilePage);
  assertCorner(mobilePersist, 390, 844, "mobile persisted-open");
  assertButtonsClear(mobilePersist.buttons, mobilePersist.minimap, "mobile persisted-open");
  report.cases.push({ name: "mobile-persisted-open", ...mobilePersist });
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
  assertCorner(desktopDefault, 1440, 960, "desktop default");
  assertButtonsClear(desktopDefault.buttons, desktopDefault.minimap, "desktop default");
  assert.equal(overlap(desktopDefault.minimap, desktopDefault.band).overlaps, false, "desktop: block and band share an edge, not area");
  report.cases.push({ name: "desktop-default", ...desktopDefault });

  await desktopPage.locator('button[aria-label="You — pack, paperdoll, skills"]:visible').click();
  const desktopDrawer = await measure(desktopPage);
  await desktopPage.screenshot({ path: join(outDir, "after-desktop-drawer.png") });
  assert.ok(desktopDrawer.drawer, "desktop: You pops the drawer");
  assert.ok(Math.abs(desktopDrawer.drawer.x + desktopDrawer.drawer.width - 1440) <= 1, "desktop: drawer flush to the right edge");
  assert.equal(overlap(desktopDrawer.drawer, desktopDrawer.band).overlaps, false, "desktop: drawer clears the band");
  assert.equal(overlap(desktopDrawer.drawer, desktopDrawer.minimap).overlaps, false, "desktop: drawer clears the corner block");
  await desktopPage.keyboard.press("Escape");
  const desktopDrawerClosed = await measure(desktopPage);
  assert.equal(desktopDrawerClosed.drawer, null, "desktop: Escape puts the drawer away");
  report.cases.push({ name: "desktop-drawer", ...desktopDrawer });

  await desktopPage.getByTestId("docked-minimap").getByLabel("Hide mini-map").click();
  const desktopHidden = await measure(desktopPage);
  await desktopPage.screenshot({ path: join(outDir, "after-desktop-map-hidden.png") });
  assert.equal(desktopHidden.minimap, null, "desktop: corner toggle collapses the block");
  assert.ok(Math.abs(desktopHidden.band.x + desktopHidden.band.width - 1440) <= 1, "desktop: band spans full width once the block tucks away");
  assert.ok(Math.abs(desktopHidden.rail.y + desktopHidden.rail.height - desktopHidden.band.y) <= 1, "desktop: rail meets the band when the block tucks away");
  report.cases.push({ name: "desktop-map-hidden", ...desktopHidden });
  await desktop.close();
} finally {
  await browser.close();
}

writeFileSync(join(outDir, "after.json"), JSON.stringify({ ok: true, ...report }, null, 2));
console.log(JSON.stringify({ ok: true, cases: report.cases.map((c) => ({ name: c.name, dockFlag: c.dockFlag })) }, null, 2));
