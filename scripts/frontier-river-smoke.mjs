import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { PerspectiveCamera, Vector3 } from "three";
import { createWorld } from "../src/game/world.ts";
import { writeSave, SAVE_KEY } from "../src/game/save.ts";
import { FRONTIER_ART } from "../src/game/frontier.ts";
import { MAP } from "../src/game/atlas.ts";
const [url = "http://127.0.0.1:8137", label = "dev", mode = "candidate"] = process.argv.slice(2);
assert(["127.0.0.1", "localhost"].includes(new URL(url).hostname));
assert.match(label, /^[a-z0-9-]+$/);
const out = path.resolve("art/verification/frontier-river", label);
fs.mkdirSync(out, { recursive: true });
const report = {
  url,
  mode,
  scope:
    "Disposable seed7 v4 save; actual game desktop and emulated mobile. Actor repositioning only for regional coverage; native ground input plus normal simulation across all three river fords. Not physical-phone performance.",
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
w.scars["270,320"] = { h: 2, kind: "dirt" };
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
    // Native camera zoom keeps full-bank crossing targets clear of HUD on narrow screens.
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    for (let i = 0; i < (device === "mobile" ? 18 : 8); i++) {
      await page.mouse.wheel(0, 180);
      await page.waitForTimeout(70);
    }
    const position = async (x, z) => {
      await page.evaluate(
        ({ x, z }) => {
          const s = window.__ember.useGame.getState(),
            w = window.__ember.getWorld(),
            p = w.people[0];
          s.setPanel("none");
          s.closeCtx();
          p.x = x;
          p.z = z;
          p.path = [];
          w.player.intent.kind = "none";
          s.tick(0.01);
        },
        { x, z },
      );
      await page.waitForTimeout(1000);
    };
    const capture = async (name) => {
      const file = path.join(out, `${device}-${name}.png`);
      await page.screenshot({ path: file, timeout: 30000 });
      report.screenshots.push(file);
      flush();
    };
    const clickGround = async (x, z) => {
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
      const point = new Vector3(x, 0.8, z).project(c);
      const input = {
        x: v.r.x + ((point.x + 1) * v.r.width) / 2,
        y: v.r.y + ((1 - point.y) * v.r.height) / 2,
      };
      if (device === "mobile") await page.touchscreen.tap(input.x, input.y);
      else await page.mouse.click(input.x, input.y);
      return input;
    };
    for (const ford of [
      { id: "snowmelt", x: 750, z: 268, span: 5 },
      { id: "reedwake", x: 952, z: 560, span: 3 },
      { id: "south", x: 940, z: 820, span: 10 },
    ]) {
      await position(ford.x - ford.span, ford.z);
      await capture(ford.id + "-before");
      for (const direction of [1, -1]) {
        const goal = ford.x + ford.span * direction;
        const input = await clickGround(goal, ford.z);
        const command = await page.evaluate(() =>
          structuredClone(window.__ember.getWorld().player.intent),
        );
        check(
          `${device}-${ford.id}-${direction}-native-input`,
          command.kind === "walk" && command.tx === goal && command.ty === ford.z,
          { command, input },
        );
        await page.evaluate(() => {
          const s = window.__ember.useGame.getState();
          s.speed(1);
          for (let i = 0; i < 500; i++) s.tick(0.05);
          s.speed(0);
        });
        const arrived = await page.evaluate(() => {
          const p = window.__ember.getWorld().people[0];
          return { x: p.x, z: p.z, path: p.path };
        });
        check(
          `${device}-${ford.id}-${direction}-arrived`,
          Math.hypot(arrived.x - goal, arrived.z - ford.z) < 0.1,
          { arrived },
        );
        await page.waitForTimeout(500);
      }
      await capture(ford.id + "-returned");
    }
    for (const [id, x, z] of [
      ["mountain-source", 738, 258],
      ["meander", 990, 660],
      ["south-mouth", 1100, 1134],
    ]) {
      await position(x + 15, z);
      await capture(id);
    }
    const scar = await page.evaluate(() => window.__ember.getWorld().tiles[320][270]);
    check(device + "-legacy-scar-preserved", scar.h === 2 && scar.kind === "dirt", { scar });
    await page.evaluate(() => window.__ember.useGame.getState().setPanel("vale"));
    await page.waitForTimeout(500);
    const colors = await page.evaluate(() => {
      const c = document.querySelector('[data-vale-map="chart"] canvas'),
        ctx = c.getContext("2d");
      return [
        [800, 340],
        [990, 660],
        [970, 940],
        [1100, 1134],
      ].map(([x, z]) => {
        const px = Math.round((x * 256) / 1145),
          py = Math.round((z * 256) / 1145);
        return { x, z, rgba: Array.from(ctx.getImageData(px, py, 1, 1).data) };
      });
    });
    check(
      device + "-chart-river-water-pixels",
      colors.every((p) => p.rgba.join(",") === "58,74,88,255"),
      { colors },
    );
    await capture("chart");
    check(
      device + "-no-horizontal-overflow",
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
    await context.close();
  }
  check("no-page-or-console-errors", report.errors.length === 0, { errors: report.errors });
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
