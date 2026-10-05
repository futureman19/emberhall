#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const url = process.env.EMBERHALL_URL || "http://127.0.0.1:4178/";
const outDir = process.env.EMBERHALL_ARTIFACT_DIR || join(dirname(fileURLToPath(import.meta.url)), "../art/verification/mobile-hud");
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
  await page.evaluate(() => window.__ember.useGame.getState().begin(false));
  await page.waitForFunction(() => window.__ember.useGame.getState().phase === "playing");
  await page.evaluate(() => { window.__ember.useGame.getState().speed(0); window.__ember.useGame.setState({ panel: "none" }); });
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

async function classicCases(page, label, report) {
  const width = page.viewportSize().width;
  const guide = page.getByTestId("bottom-dock").getByLabel("Guide", { exact: true });
  for (const panel of ["help", "journal", "roster", "vale", "build"]) {
    await guide.click();
    if (panel !== "help") await page.evaluate((id) => window.__ember.useGame.setState({ panel: id }), panel);
    const drawer = page.locator(".drawer-shell");
    await drawer.waitFor();
    await page.waitForTimeout(220);
    const box = await drawer.boundingBox();
    const m = await measure(page);
    assert.ok(Math.abs(box.x + box.width - width) < 1, `${label} ${panel}: flush edge`);
    assert.equal(overlap(box, m.band).overlaps, false, `${label} ${panel}: band clear`);
    assert.equal(overlap(box, m.minimap).overlaps, false, `${label} ${panel}: corner clear`);
    assert.equal(await drawer.evaluate((el) => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.left + 24, r.top + 24)); }), true, `${label} ${panel}: drawer header unobscured`);
    assert.equal(await drawer.evaluate((el) => el.contains(document.activeElement)), true, `${label} ${panel}: focus enters`);
    const smallTargets = await drawer.locator("button:visible").evaluateAll((buttons) => buttons.filter((button) => { const r = button.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map((button) => button.textContent));
    assert.deepEqual(smallTargets, [], `${label} ${panel}: 44px targets`);
    assert.equal(await drawer.evaluate((el) => getComputedStyle(el).animationName), "drawer-in");

    if (panel === "help") {
      assert.equal(await drawer.evaluate((el) => el.classList.contains("parchment-panel")), true);
      const tab = page.getByRole("tab", { name: "Guide", exact: true });
      assert.equal(await tab.evaluate((el) => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true, "reading tabs not covered by vitals");
      assert.equal(await page.getByRole("tab", { name: "Roster", exact: true }).evaluate((el) => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.right - 4, r.top + 12)); }), true, "rail controls do not cover Roster tab");
      await page.screenshot({ path: join(outDir, `after-${label}-parchment.png`) });
      await page.getByRole("tab", { name: "Journal", exact: true }).click();
      await page.getByRole("tab", { name: "Roster", exact: true }).click();
    }
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "detached" });
    if (panel === "help") assert.equal(await guide.evaluate((el) => el === document.activeElement), true, "focus returns to opener");
    report.cases.push({ name: `${label}-${panel}-drawer`, box });
  }
  for (const surface of ["selected", "ghost"]) {
    await page.evaluate((kind) => {
      const store = window.__ember.useGame;
      const snap = store.getState().snap;
      if (kind === "selected") store.setState({ selectedId: snap.people.find((p) => p.isPlayer).id });
      else {
        const person = window.__ember.getWorld().people.find((p) => p.isPlayer);
        person.isPlayer = true;
        person.ghost = true;
        store.setState({ selectedId: null, snap: { ...snap, people: snap.people.map((p) => p.id === person.id ? { ...p, isPlayer: true, ghost: true } : p) } });
      }
    }, surface);
    const el = page.locator(`[data-ui-surface="${surface}"]`);
    await el.waitFor();
    await page.waitForTimeout(200);
    const box = await el.boundingBox();
    const m = await measure(page);
    assert.equal(overlap(box, m.band).overlaps, false);
    assert.equal(overlap(box, m.minimap).overlaps, false);
    assert.equal(await el.evaluate((node) => getComputedStyle(node).animationName), "surface-in");
    await page.locator(".classic-ui").evaluate((node) => node.setAttribute("data-effects", "reduced"));
    assert.equal(await el.evaluate((node) => getComputedStyle(node).animationName), "none");
    await page.locator(".classic-ui").evaluate((node) => node.removeAttribute("data-effects"));
    report.cases.push({ name: `${label}-${surface}-entrance`, box });
  }
  await page.evaluate(() => {
    const store = window.__ember.useGame;
    const snap = store.getState().snap;
    const person = window.__ember.getWorld().people.find((p) => p.isPlayer);
    person.ghost = false;

    store.setState({ selectedId: null, snap: { ...snap, people: snap.people.map((p) => p.id === person.id ? { ...p, ghost: false } : p) } });
  });
  await page.getByTestId("bottom-dock").getByLabel("Spellbook", { exact: true }).click();
  const book = page.locator(".parchment-panel");
  await book.waitFor();
  const box = await book.boundingBox();
  const m = await measure(page);
  assert.equal(overlap(box, m.band).overlaps, false);
  assert.equal(overlap(box, m.minimap).overlaps, false);
  assert.equal(overlap(box, m.rail).overlaps, false);
  assert.equal(await book.evaluate((el) => getComputedStyle(el).backgroundImage.includes("rgb(17, 17, 16)")), false, "parchment material wins over black frame gradient");
  await page.screenshot({ path: join(outDir, `after-${label}-spellbook.png`) });
  await page.evaluate(() => window.__ember.useGame.getState().closeBook());
  report.cases.push({ name: `${label}-spellbook-parchment`, box });
  for (const [name, state] of [["craft", "openCraft"], ["pets", "openPets"], ["vault", "openVault"], ["settings", "openSettings"]]) {
    await page.evaluate((key) => window.__ember.useGame.setState({ [key]: true }), state);
    const surface = page.locator(name === "craft" ? ".craft-panel" : name === "vault" ? '[data-testid="vault-panel"]' : name === "settings" ? '[role="dialog"][aria-label="Settings — sound, graphics and the Vault"]' : '[data-ui-surface="pets"]');
    await surface.waitFor();
    const bounds = await surface.boundingBox();
    const frame = await measure(page);
    assert.equal(overlap(bounds, frame.band).overlaps, false, `${label} ${name}: band clear`);
    assert.equal(overlap(bounds, frame.minimap).overlaps, false, `${label} ${name}: corner clear`);
    assert.equal(overlap(bounds, frame.rail).overlaps, false, `${label} ${name}: rail clear`);
    await page.evaluate((key) => window.__ember.useGame.setState({ [key]: false }), state);
    report.cases.push({ name: `${label}-${name}-clearance`, box: bounds });
  }
  const pointer = await page.locator(".classic-ui").evaluate((node) => ({ root: getComputedStyle(node).pointerEvents, island: getComputedStyle(node.querySelector('[data-testid="bottom-band"]')).pointerEvents }));
  assert.deepEqual(pointer, { root: "none", island: "auto" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await guide.click();
  assert.equal(await page.locator(".drawer-shell").evaluate((node) => getComputedStyle(node).animationName), "none");
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "no-preference" });
}

const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--enable-webgl", "--ignore-gpu-blocklist"] });
const report = { url, cases: [], pageErrors: [], errors: [] };

function watchErrors(page) {
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") report.errors.push(message.text()); });
}
try {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mobile.routeWebSocket(/.*/, () => {}); // freeze HMR while writing verification artifacts
  const mobilePage = await mobile.newPage();
  watchErrors(mobilePage);
  mobilePage.on("pageerror", (error) => report.pageErrors.push(error.message));
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
  await classicCases(mobilePage, "mobile", report);
  await mobile.close();

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await desktop.routeWebSocket(/.*/, () => {});
  const desktopPage = await desktop.newPage();
  watchErrors(desktopPage);
  desktopPage.on("pageerror", (error) => report.pageErrors.push(error.message));
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

  await classicCases(desktopPage, "desktop-map-open", report);
  await desktopPage.getByTestId("docked-minimap").getByLabel("Hide mini-map").click();
  const desktopHidden = await measure(desktopPage);
  await desktopPage.screenshot({ path: join(outDir, "after-desktop-map-hidden.png") });
  assert.equal(desktopHidden.minimap, null, "desktop: corner toggle collapses the block");
  assert.ok(Math.abs(desktopHidden.band.x + desktopHidden.band.width - 1440) <= 1, "desktop: band spans full width once the block tucks away");
  assert.ok(Math.abs(desktopHidden.rail.y + desktopHidden.rail.height - desktopHidden.band.y) <= 1, "desktop: rail meets the band when the block tucks away");
  report.cases.push({ name: "desktop-map-hidden", ...desktopHidden });
  await classicCases(desktopPage, "desktop", report);
  await desktop.close();
} finally {
  await browser.close();
}

assert.deepEqual(report.errors, [], "browser console and runtime are clean");
assert.deepEqual(report.pageErrors, [], "no uncaught browser errors");
writeFileSync(join(outDir, "after.json"), JSON.stringify({ ok: true, ...report }, null, 2));
console.log(JSON.stringify({ ok: true, cases: report.cases.map((c) => ({ name: c.name, dockFlag: c.dockFlag })) }, null, 2));
