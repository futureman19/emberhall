import fs from "node:fs";
import { chromium } from "playwright";
import { createWorld } from "../src/game/world.ts";
import { encodeSave, SAVE_KEY } from "../src/game/save.ts";
const [label = "before", device = "desktop"] = process.argv.slice(2);
const out = `${process.env.EMBER_PERF_OUTPUT_DIR || "screenshots/gameplay-lag"}/${label}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=d3d11", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const report = {
  label,
  device,
  seed: 42,
  warmupMs: 8000,
  sampleMs: 12000,
  scope:
    "Built app, fixed seeded stationary fixture, paused and normal speed. Mobile is desktop-GPU touch/viewport emulation, not phone FPS. No user save modified.",
  runs: [],
  errors: [],
};
try {
  for (const zone of ["town", "dungeon"])
    for (const speed of [0, 1]) {
      const w = createWorld(42);
      w.speed = 0;
      w.hour = 12;
      const you = w.people.find((p) => p.isPlayer);
      if (zone === "dungeon") {
        you.x = 650;
        you.z = 565;
      }
      const ctx = await browser.newContext(
        device === "mobile"
          ? {
              viewport: { width: 390, height: 844 },
              deviceScaleFactor: 3,
              isMobile: true,
              hasTouch: true,
              userAgent:
                "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
            }
          : { viewport: { width: 1440, height: 960 } },
      );
      await ctx.routeWebSocket(/.*/, () => {});
      await ctx.addInitScript(() => {
        window.__roots = [];
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
          supportsFiber: true,
          inject: () => 1,
          onCommitFiberRoot: (_, r) => {
            if (!window.__roots.includes(r)) window.__roots.push(r);
          },
          onCommitFiberUnmount: () => {},
        };
      });
      await ctx.addInitScript(
        ({ key, raw, graphics }) => {
          localStorage.setItem(key, raw);
          if (graphics) localStorage.setItem("emberhall-graphics-v1", graphics);
          Math.random = () => 0.4;
        },
        { key: SAVE_KEY, raw: encodeSave(w), graphics: process.env.EMBER_PERF_GRAPHICS || null },
      );
      const page = await ctx.newPage();
      page.on("pageerror", (e) => report.errors.push(e.message));
      await page.goto("http://127.0.0.1:8097/?qa=1");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.waitForFunction(() => window.__ember?.useGame.getState().phase === "playing");
      await page.evaluate(() => {
        const s = window.__ember.useGame.getState();
        s.speed(0);
        s.setPanel("none");
        s.closeCtx();
      });
      if (zone === "dungeon")
        await page.getByRole("button", { name: "Enter the Emberdeep", exact: true }).click();
      await page.waitForTimeout(8000);
      const graph = await page.evaluate(() => {
        let scene;
        const seen = new Set();
        function visit(f) {
          if (!f || seen.has(f)) return;
          seen.add(f);
          const o = f.stateNode?.object;
          if (o?.isObject3D) {
            let root = o;
            while (root.parent) root = root.parent;
            if (root.isScene) scene = root;
          }
          visit(f.child);
          visit(f.sibling);
        }
        for (const r of window.__roots) visit(r.current);
        if (!scene) return { error: "no scene" };
        window.__scene = scene;
        return scene.children
          .map((o) => {
            let count = 0,
              auto = 0;
            o.traverse((n) => {
              count++;
              auto += Number(n.matrixAutoUpdate);
            });
            return {
              name: o.name,
              type: o.type,
              count,
              auto,
              visible: o.visible,
              children: o.children
                .slice(0, 3)
                .map((c) => ({
                  name: c.name,
                  type: c.type,
                  children: c.children.slice(0, 3).map((n) => n.name),
                })),
            };
          })
          .sort((a, b) => b.count - a.count);
      });
      console.log("GRAPH", zone, JSON.stringify(graph));
      await page.evaluate(() => {
        window.__matrixTimes = [];
        const s = window.__scene,
          original = s.updateMatrixWorld;
        s.updateMatrixWorld = function (...args) {
          const t = performance.now();
          original.apply(this, args);
          window.__matrixTimes.push(performance.now() - t);
        };
      });
      await page.evaluate((speed) => window.__ember.useGame.getState().speed(speed), speed);
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.start");
      const data = await page.evaluate(
        () =>
          new Promise((resolve) => {
            let last, start;
            const times = [];
            function frame(t) {
              start ??= t;
              if (last !== undefined) times.push(t - last);
              last = t;
              if (t - start < 12000) return requestAnimationFrame(frame);
              const sorted = [...times].sort((a, b) => a - b);
              resolve({
                frames: times.length,
                p50: sorted[Math.floor(sorted.length * 0.5)],
                p95: sorted[Math.floor(sorted.length * 0.95)],
                times,
                graphics: window.__emberGraphicsRuntime?.getState(),
              });
            }
            requestAnimationFrame(frame);
          }),
      );
      const { profile } = await cdp.send("Profiler.stop");
      fs.writeFileSync(`${out}/${zone}-${speed}.cpuprofile`, JSON.stringify(profile));
      const counts = new Map();
      for (const n of profile.nodes) counts.set(n.id, n);
      const hits = {};
      for (const id of profile.samples ?? []) {
        const n = counts.get(id),
          key = `${n.callFrame.functionName} ${n.callFrame.url}:${n.callFrame.lineNumber}`;
        hits[key] = (hits[key] ?? 0) + 1;
      }
      report.runs.push({
        zone,
        speed,
        ...data,
        canvas: await page.evaluate(() => ({
          width: document.querySelector("canvas").width,
          height: document.querySelector("canvas").height,
          devicePixelRatio,
          settings: localStorage.getItem("emberhall-graphics-v1"),
        })),
        matrixTimes: await page.evaluate(() => window.__matrixTimes),
        graph,
        hotspots: Object.entries(hits)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 25),
      });
      await page.screenshot({ path: `${out}/${zone}-${speed}.png` });
      await ctx.close();
      fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
      console.log(
        JSON.stringify({
          zone,
          speed,
          ...data,
          times: undefined,
          hotspots: report.runs.at(-1).hotspots.slice(0, 12),
        }),
      );
    }
} finally {
  await browser.close();
}
