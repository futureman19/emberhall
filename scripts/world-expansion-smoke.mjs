import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { PerspectiveCamera, Vector3 } from "three";
import { createWorld } from "../src/game/world.ts";
import { writeSave, SAVE_KEY } from "../src/game/save.ts";
import { FRONTIER_SITES, FRONTIER_ART } from "../src/game/frontier.ts";
import { MAP } from "../src/game/atlas.ts";
const [url = "http://127.0.0.1:8137", label = "dev", mode = "candidate"] = process.argv.slice(2);
assert(["127.0.0.1", "localhost"].includes(new URL(url).hostname));
assert.match(label, /^[a-z0-9-]+$/);
const out = path.resolve("art/verification/world-expansion", label);
fs.mkdirSync(out, { recursive: true });
const report = {
  url,
  mode,
  scope:
    "Disposable seed7 v4 save; actual game desktop and emulated mobile. Actor repositioning only for regional coverage; native ground input plus normal simulation for camp entrance. Not physical-phone performance.",
  checks: [],
  errors: [],
  requests: [],
  rejected: [],
  screenshots: [],
};
const flush = () =>
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(report, null, 2));
const check = (name, ok, detail = {}) => {
  report.checks.push({ name, ok: !!ok, ...detail });
  flush();
  assert(ok, name);
};
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, v),
};
const random = Math.random;
Math.random = () => 7 / 1e9;
const w = createWorld();
Math.random = random;
w.hour = 12;
w.speed = 0;
w.people[0].look = {
  schema: "emberhall.look/1",
  hairStyle: "crop",
  skin: "#96795d",
  garb: "#526b54",
};
writeSave(w);
const raw = storage.get(SAVE_KEY);
assert(raw);
fs.writeFileSync(path.join(out, "disposable-save.json"), raw);
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=d3d11", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const watchdog = setTimeout(() => browser.close(), 300000);
try {
  for (const [device, viewport] of [
    ["desktop", { width: 1440, height: 960 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({
      viewport,
      hasTouch: device === "mobile",
      deviceScaleFactor: 1,
    });
    await context.routeWebSocket(/.*/, () => {});
    if (mode === "fallback")
      await context.route("**/art/orc-encampment/grimroot-camp.glb", (route) => route.abort());
    const page = await context.newPage();
    page.on("requestfailed", (req) => {
      if (req.url().endsWith("/art/orc-encampment/grimroot-camp.glb"))
        report.rejected.push({ device, url: req.url() });
    });
    page.on("pageerror", (e) => report.errors.push({ device, type: "page", text: e.message }));
    page.on("console", (m) => {
      if (m.type() === "error") report.errors.push({ device, type: "console", text: m.text() });
    });
    page.on("response", (res) => {
      if (FRONTIER_ART.some((p) => res.url().endsWith(p.url)))
        report.requests.push({ device, url: res.url(), status: res.status() });
    });
    await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), {
      key: SAVE_KEY,
      raw,
    });
    await page.goto(url + "/?qa=1", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByRole("button", { name: "Continue", exact: true }).click({ timeout: 60000 });
    await page.waitForFunction(
      () => {
        if (window.__ember?.useGame.getState().phase !== "playing" || !window.__emberCamera)
          return false;
        window.__ember.useGame.getState().speed(0);
        return true;
      },
      {},
      { timeout: 90000 },
    );
    await page.evaluate(() => {
      const s = window.__ember.useGame.getState(),
        w = window.__ember.getWorld(),
        p = w.people.find((p) => p.isPlayer);
      w.people = [p];
      w.fauna = [];
      w.hour = 12;
      p.hunger = 0;
      p.energy = 100;
      s.setPanel("none");
      s.closeCtx();
      s.select(null);
      s.tick(0.01);
    });
    const state = await page.evaluate(() => {
      const w = window.__ember.getWorld();
      return { side: w.tiles.length, width: w.tiles[0].length, look: w.people[0].look };
    });
    check(
      device + "-expanded-save-and-look",
      state.side === MAP && state.width === MAP && state.look.skin === "#96795d",
      { state },
    );
    const sites =
      mode === "fallback" ? FRONTIER_SITES.filter((p) => p.id === "grimroot") : FRONTIER_SITES;
    for (const site of sites) {
      await page.evaluate(({ tx, ty }) => {
        const s = window.__ember.useGame.getState(),
          w = window.__ember.getWorld(),
          p = w.people.find((p) => p.isPlayer);
        p.x = tx;
        p.z = ty;
        p.path = [];
        w.player.intent.kind = "none";
        s.tick(0.01);
      }, site);
      await page.waitForTimeout(1100);
      await page.waitForLoadState("networkidle", { timeout: 20000 });
      const file = path.join(out, `${device}-${site.id}.png`);
      await page.screenshot({ path: file, timeout: 30000 });
      report.screenshots.push(file);
      flush();
    }
    // Clear southern approach -> through the camp gate; scenery cannot steal this ground input.
    await page.evaluate(() => {
      const s = window.__ember.useGame.getState(),
        w = window.__ember.getWorld(),
        p = w.people.find((p) => p.isPlayer);
      p.x = 900;
      p.z = 268;
      p.path = [];
      w.player.intent.kind = "none";
      s.tick(0.01);
    });
    await page.waitForTimeout(900);
    const v = await page.evaluate(() => {
      const r = document.querySelector("canvas").getBoundingClientRect();
      return {
        c: window.__emberCamera.getCamera(),
        t: window.__emberCamera.getTarget(),
        r: { x: r.x, y: r.y, width: r.width, height: r.height },
      };
    });
    const c = new PerspectiveCamera(48, v.r.width / v.r.height, 0.2, 480);
    c.position.set(v.c.x, v.c.y, v.c.z);
    c.lookAt(v.t.x, v.t.y, v.t.z);
    c.updateMatrixWorld(true);
    const point = new Vector3(900, 0.8, 264).project(c);
    const input = {
      x: v.r.x + ((point.x + 1) * v.r.width) / 2,
      y: v.r.y + ((1 - point.y) * v.r.height) / 2,
    };
    if (device === "mobile") await page.touchscreen.tap(input.x, input.y);
    else await page.mouse.click(input.x, input.y);
    const command = await page.evaluate(() =>
      structuredClone(window.__ember.getWorld().player.intent),
    );
    check(
      device + "-native-ground-command",
      command.kind === "walk" && command.tx === 900 && command.ty === 264,
      { command, input },
    );
    await page.evaluate(() => {
      const s = window.__ember.useGame.getState();
      s.speed(1);
      for (let i = 0; i < 180; i++) s.tick(0.05);
      s.speed(0);
    });
    const arrived = await page.evaluate(() => {
      const p = window.__ember.getWorld().people.find((p) => p.isPlayer);
      return { x: p.x, z: p.z, path: p.path };
    });
    check(
      device + "-normal-movement-through-gate",
      Math.hypot(arrived.x - 900, arrived.z - 264) < 0.1,
      { arrived },
    );
    const file = path.join(out, `${device}-gate-arrived.png`);
    await page.screenshot({ path: file });
    report.screenshots.push(file);
    await page.evaluate(() => window.__ember.useGame.getState().setPanel("vale"));
    await page
      .getByRole("button", { name: "The Elder Circle", exact: true })
      .scrollIntoViewIfNeeded();
    const chartFile = path.join(out, `${device}-chart.png`);
    await page.screenshot({ path: chartFile });
    report.screenshots.push(chartFile);
    await page.getByRole("button", { name: "The Elder Circle", exact: true }).click();
    const travel = await page.evaluate(() =>
      structuredClone(window.__ember.getWorld().player.intent),
    );
    check(
      device + "-named-chart-destination",
      travel.kind === "walk" && travel.tx === 1020 && travel.ty === 1000,
      { travel },
    );
    if (mode === "fallback")
      check(
        device + "-actual-download-rejected",
        report.rejected.some((q) => q.device === device),
      );
    check(
      device + "-no-horizontal-overflow",
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
    if (mode !== "fallback")
      check(
        device + "-all-placed-assets-requested",
        FRONTIER_ART.every((p) =>
          report.requests.some(
            (q) => q.device === device && q.url.endsWith(p.url) && q.status === 200,
          ),
        ),
      );
    await context.close();
  }
  if (mode === "candidate")
    check("no-page-or-console-errors", report.errors.length === 0, { errors: report.errors });
  else
    check(
      "fallback-no-page-errors",
      report.errors.every((e) => e.type !== "page"),
      { errors: report.errors },
    );
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.failure = e.stack;
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  flush();
  await browser.close();
}
console.log(
  JSON.stringify({
    passed: report.passed,
    checks: report.checks.length,
    failure: report.failure,
    out,
  }),
);
