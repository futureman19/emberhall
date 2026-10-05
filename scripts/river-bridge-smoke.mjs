import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { PerspectiveCamera, Vector3 } from "three";
import { createWorld } from "../src/game/world.ts";
import { writeSave, SAVE_KEY } from "../src/game/save.ts";
import { FRONTIER_ART } from "../src/game/frontier.ts";
import { groundY } from "../src/game/height.ts";
import { MAP } from "../src/game/atlas.ts";
const [url = "http://127.0.0.1:8137", label = "dev", mode = "candidate", scope = "river-bridge"] =
  process.argv.slice(2);
assert(["river-bridge", "reedwake-waterfront"].includes(scope));
const waterfront = scope === "reedwake-waterfront";
const ferryUrl = "/art/reedwake-waterfront/reedwake-crossing.glb";
assert(["127.0.0.1", "localhost"].includes(new URL(url).hostname));
assert.match(label, /^[a-z0-9-]+$/);
const out = path.resolve("art/verification", scope, label);
fs.mkdirSync(out, { recursive: true });
const report = {
  url,
  mode,
  scope:
    "Disposable seed7 v4 save; actual game desktop and emulated mobile. Actor repositioning only for regional coverage; native bridge-deck input and both-way bank traversal plus retained ford checks; dev-only actual player mesh height; built uses movement/screenshots. Not physical-phone performance.",
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
      await context.route("**/art/river-bridge/reedwake-bridge.glb", (route) => route.abort());
    if (mode === "fallback" && waterfront)
      await context.route("**" + ferryUrl, (route) => route.abort());
    const page = await context.newPage();
    page.on("requestfailed", (req) => {
      if (
        req.url().endsWith("/art/river-bridge/reedwake-bridge.glb") ||
        (waterfront && req.url().endsWith(ferryUrl))
      )
        report.rejected.push({ device, url: req.url() });
    });
    page.on("pageerror", (e) => report.errors.push({ device, type: "page", text: e.message }));
    page.on("console", (m) => {
      if (m.type() === "error") report.errors.push({ device, type: "console", text: m.text() });
    });
    page.on("response", (res) => {
      if (
        res.url().endsWith("/art/river-bridge/reedwake-bridge.glb") ||
        FRONTIER_ART.some((p) => res.url().endsWith(p.url))
      )
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
      const point = new Vector3(x, groundY(w, x, z), z).project(c);
      const input = {
        x: v.r.x + ((point.x + 1) * v.r.width) / 2,
        y: v.r.y + ((1 - point.y) * v.r.height) / 2,
      };
      if (device === "mobile") await page.touchscreen.tap(input.x, input.y);
      else await page.mouse.click(input.x, input.y);
      return input;
    };
    await position(947, 560);
    // Built mobile can still be downloading its nearby kit after the camera settles.
    // Wait on the actual request outcome, not a fixed 1.2s screenshot delay.
    for (let i = 0; i < 300; i++) {
      const settled =
        mode === "fallback"
          ? report.rejected.some(
              (r) => r.device === device && r.url.endsWith("/art/river-bridge/reedwake-bridge.glb"),
            )
          : report.requests.some(
              (r) => r.device === device && r.url.endsWith("/art/river-bridge/reedwake-bridge.glb"),
            );
      if (settled) break;
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(500);
    await capture("bridge-normal-camera");
    check(
      device + "-bridge-download",
      mode === "fallback"
        ? report.rejected.some(
            (r) => r.device === device && r.url.endsWith("/art/river-bridge/reedwake-bridge.glb"),
          )
        : report.requests.some(
            (r) =>
              r.device === device &&
              r.url.endsWith("/art/river-bridge/reedwake-bridge.glb") &&
              r.status === 200,
          ),
    );
    await clickGround(952, 560);
    const deckCommand = await page.evaluate(() =>
      structuredClone(window.__ember.getWorld().player.intent),
    );
    check(
      device + "-native-deck-input",
      deckCommand.kind === "walk" && deckCommand.tx === 952 && deckCommand.ty === 560,
      { deckCommand },
    );
    await page.evaluate(() => {
      const s = window.__ember.useGame.getState();
      s.speed(1);
      for (let i = 0; i < 180; i++) s.tick(0.05);
      s.speed(0);
    });
    await page.waitForTimeout(500);
    const deckActor = await page.evaluate(() => {
      const p = window.__ember.getWorld().people[0];
      return { x: p.x, z: p.z };
    });
    check(device + "-on-deck-arrival", Math.hypot(deckActor.x - 952, deckActor.z - 560) < 0.1, {
      deckActor,
      canonicalGroundY: groundY(w, deckActor.x, deckActor.z),
    });
    if (!label.startsWith("built")) {
      const actual = await page.evaluate(async () => {
        const entry = performance
          .getEntriesByType("resource")
          .find((e) => e.name.includes("@react-three_fiber"));
        if (!entry) throw new Error("R3F resource missing");
        const { _roots } = await import(entry.name);
        const scene = [..._roots.values()][0].store.getState().scene;
        scene.updateMatrixWorld(true);
        const player = scene.getObjectByName("emberhall-player-figure");
        const bridge = scene.getObjectByName("reedwake-river-bridge");
        const proxy = scene.getObjectByName("reedwake-deck-pick");
        return {
          playerY: player.matrixWorld.elements[13],
          bridgeY: bridge.matrixWorld.elements[13],
          proxyY: proxy.matrixWorld.elements[13],
          fallback: !!scene.getObjectByName("river-bridge-fallback"),
        };
      });
      check(
        device + "-rendered-feet-on-deck",
        Math.abs(actual.playerY - 1.2) < 0.03 &&
          actual.bridgeY === 0.6 &&
          actual.proxyY === 1.2 &&
          actual.fallback === (mode === "fallback"),
        { actual },
      );
    }
    if (waterfront) {
      for (let i = 0; i < 300; i++) {
        const records = mode === "fallback" ? report.rejected : report.requests;
        if (records.some((r) => r.device === device && r.url.endsWith(ferryUrl))) break;
        await page.waitForTimeout(100);
      }
      check(
        device + "-ferry-download",
        (mode === "fallback" ? report.rejected : report.requests).some(
          (r) =>
            r.device === device &&
            r.url.endsWith(ferryUrl) &&
            (mode === "fallback" || r.status === 200),
        ),
      );
      if (!label.startsWith("built")) {
        const ferry = await page.evaluate(async () => {
          const entry = performance
            .getEntriesByType("resource")
            .find((e) => e.name.includes("@react-three_fiber"));
          const { _roots } = await import(entry.name);
          const scene = [..._roots.values()][0].store.getState().scene;
          scene.updateMatrixWorld(true);
          const f = scene.getObjectByName("frontier-reedwake-crossing");
          return {
            position: f.matrixWorld.elements.slice(12, 15),
            fallback: !!scene.getObjectByName("waterfront-fallback"),
          };
        });
        check(
          device + "-ferry-world-placement",
          ferry.position.join(",") === "955,0,551" && ferry.fallback === (mode === "fallback"),
          { ferry },
        );
      }
      await page.waitForTimeout(500);
    }
    await capture("bridge-on-deck");
    // Native camera zoom keeps full-bank crossing targets clear of HUD on narrow screens.
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    for (let i = 0; i < (device === "mobile" ? 18 : 8); i++) {
      await page.mouse.wheel(0, 180);
      await page.waitForTimeout(70);
    }
    for (const ford of [
      { id: "snowmelt", x: 750, z: 268, span: 5 },
      { id: "reedwake", x: 952, z: 560, span: 6 },
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
  check(
    "no-page-or-console-errors",
    report.errors.filter(
      (e) => !(mode === "fallback" && e.type === "console" && e.text.includes("net::ERR_FAILED")),
    ).length === 0,
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
