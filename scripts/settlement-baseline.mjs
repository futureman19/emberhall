import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "art/verification/baseline", process.env.BASELINE_LABEL || "phase0");
fs.mkdirSync(out, { recursive: true });
const fixturePath = path.join(root, "art/verification/baseline/baseline-save.json");
const fixture = fs.readFileSync(fixturePath, "utf8");
const url = process.argv[2] || "http://127.0.0.1:8093";
const reference = "https://emberhall-vale-jqdd64bla-andrews-projects-ffe8a9fd.vercel.app";
const scenes = [
  { id: "starting-town", x: 256, z: 293 },
  { id: "dense-woodland", x: 248, z: 148 },
  { id: "capital-interior", x: 176, z: 320 },
  { id: "combat-arena", x: 248, z: 291, combat: true },
  { id: "distant-biome", x: 250, z: 48 },
];
const result = {
  started: new Date().toISOString(),
  url,
  reference,
  commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  fixtureSha256: crypto.createHash("sha256").update(fixture).digest("hex"),
  host: {
    platform: os.platform(),
    release: os.release(),
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    totalMemory: os.totalmem(),
  },
  browser: null,
  settings: {
    hour: 12,
    speed: 0,
    weather: {
      kind: "clear",
      cloud: 0.06,
      wet: 0,
      wind: 0.12,
      untilHour: 99999,
      rolls: 1,
      douseHour: 0,
    },
    frames: 180,
    dpr: 1,
    camera: "unchanged normal gameplay camera; follow translates to fixture player",
    scenes,
  },
  loads: [],
  samples: [],
  errors: [],
};
const persist = () =>
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(result, null, 2));
persist();
const browserArgs = process.env.ART_SOFTWARE_GPU === "1" ? [] : ["--use-angle=d3d11", "--enable-gpu"];
result.settings.browserArgs = browserArgs;
const browser = await chromium.launch({ headless: true, args: browserArgs });
result.browser = browser.version();
const bounded = (promise, ms, name) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`${name} timeout ${ms}ms`)), ms);
      timer.unref();
    }),
  ]);
const snap = async (page, name) => {
  const cdp = await page.context().newCDPSession(page);
  try {
    const image = await bounded(
      cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }),
      12000,
      name,
    );
    fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(image.data, "base64"));
  } finally {
    await cdp.detach();
  }
};
function errors(page, label) {
  page.on("pageerror", (e) => {
    result.errors.push({ label, type: "pageerror", text: e.message });
    persist();
  });
  page.on("console", (m) => {
    if (m.type() === "error" || /WebGL|shader|GLSL/.test(m.text())) {
      result.errors.push({ label, type: m.type(), text: m.text() });
      persist();
    }
  });
  page.on("requestfailed", (r) => {
    result.errors.push({ label, type: "requestfailed", url: r.url(), error: r.failure() });
    persist();
  });
}
async function load(page, target, label) {
  const start = performance.now();
  await page.addInitScript((save) => localStorage.setItem("emberhall-save-v4", save), fixture);
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(() => !!window.__ember, null, { timeout: 30000 });
  await page.evaluate((s) => localStorage.setItem("emberhall-save-v4", s), fixture);
  const beforeContinue = performance.now();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__ember.useGame.getState().phase === "playing" && !!document.querySelector("canvas"),
    null,
    { timeout: 30000 },
  );
  await page.evaluate((weather) => {
    const s = window.__ember.useGame.getState(),
      w = window.__ember.getWorld();
    s.speed(0);
    s.setPanel("none");
    w.hour = 12;
    w.weather = weather;
    s.flash("");
  }, result.settings.weather);
  await page.waitForTimeout(1000);
  result.loads.push({
    label,
    navigationToPlayableSettledMs: performance.now() - start,
    continueToPlayableSettledMs: performance.now() - beforeContinue,
    includesFixedSettleMs: 1000,
    navigation: await page.evaluate(() => performance.getEntriesByType("navigation")[0]?.toJSON()),
  });
  persist();
}
async function place(page, scene) {
  await page.evaluate(
    ({ scene, weather }) => {
      const w = window.__ember.getWorld(),
        s = window.__ember.useGame.getState(),
        p = w.people.find((p) => p.isPlayer);
      if (window.__baselineFauna) w.fauna = structuredClone(window.__baselineFauna);
      p.x = scene.x;
      p.z = scene.z;
      p.path = [];
      p.facing = 0;
      p.story = 0;
      w.hour = 12;
      w.weather = weather;
      w.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
      if (scene.combat) {
        const t = w.fauna.find((f) => !f.ownerId);
        t.x = p.x + 1.5;
        t.z = p.z;
        t.path = [];
        t.task = "idle";
        w.player.intent = {
          kind: "hunt",
          tx: Math.round(t.x),
          ty: Math.round(t.z),
          targetId: t.id,
          spell: null,
        };
      }
      s.speed(0);
      s.setPanel("none");
      s.flash("");
    },
    { scene, weather: result.settings.weather },
  );
  await page.waitForTimeout(900);
}
async function measure(page, name) {
  const data = await bounded(
    page.evaluate(async () => {
      const r = window.__baselineRoot,
        gl = r.gl,
        context = gl.getContext();
      const ext = context.getExtension("WEBGL_debug_renderer_info");
      const times = [],
        calls = [],
        triangles = [];
      let previous;
      await new Promise((resolve) => {
        let finished = false;
        const finish = () => {
          finished = true;
          resolve();
        };
        const deadline = setTimeout(finish, 10000);
        function frame(t) {
          if (finished) return;
          if (previous !== undefined) {
            times.push(t - previous);
            calls.push(gl.info.render.calls);
            triangles.push(gl.info.render.triangles);
          }
          previous = t;
          if (times.length >= 180) {
            clearTimeout(deadline);
            finish();
          } else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      const stats = (values) => {
        const s = [...values].sort((a, b) => a - b);
        return {
          min: s[0],
          p50: s[Math.ceil(s.length * 0.5) - 1],
          p95: s[Math.ceil(s.length * 0.95) - 1],
          p99: s[Math.ceil(s.length * 0.99) - 1],
          max: s.at(-1),
          mean: values.reduce((a, b) => a + b, 0) / values.length,
        };
      };
      let objects = 0,
        meshes = 0;
      const materials = new Set(),
        geometries = new Set();
      r.scene.traverse((o) => {
        objects++;
        if (o.isMesh) meshes++;
        if (o.geometry) geometries.add(o.geometry.uuid);
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])
          materials.add(m.uuid);
      });
      const w = window.__ember.getWorld(),
        p = w.people.find((p) => p.isPlayer);
      return {
        frames: times.length,
        samplePolicy:
          "180 frames maximum; 10-second bounded window; low counts are diagnostic only",
        sampleAdequacy: times.length >= 180 ? "target-met" : "short-software-renderer-diagnostic",
        rafMs: stats(times),
        rawRafMs: times,
        drawCalls: stats(calls),
        triangles: stats(triangles),
        rendererMemory: { ...gl.info.memory },
        sceneCounts: { objects, meshes, materials: materials.size, geometries: geometries.size },
        heap: performance.memory
          ? {
              used: performance.memory.usedJSHeapSize,
              total: performance.memory.totalJSHeapSize,
              limit: performance.memory.jsHeapSizeLimit,
            }
          : null,
        renderer: ext
          ? context.getParameter(ext.UNMASKED_RENDERER_WEBGL)
          : context.getParameter(context.RENDERER),
        state: {
          position: [p.x, p.z],
          hour: w.hour,
          speed: w.speed,
          weather: w.weather,
          camera: r.camera.position.toArray(),
          quaternion: r.camera.quaternion.toArray(),
          fov: r.camera.fov,
          target: window.__emberCamera?.getTarget(),
          intent: w.player.intent,
        },
        viewport: {
          width: innerWidth,
          height: innerHeight,
          dpr: devicePixelRatio,
          scrollWidth: document.documentElement.scrollWidth,
        },
      };
    }),
    45000,
    name,
  );
  data.id = name;
  data.proposedDiagnosticBudgets = {
    rafP95Ms: data.rafMs.p95 * 1.2,
    rafP99Ms: data.rafMs.p99 * 1.25,
    drawCallsMax: Math.ceil(data.drawCalls.max * 1.1),
    trianglesMax: Math.ceil(data.triangles.max * 1.15),
    geometriesMax: Math.ceil(data.rendererMemory.geometries * 1.1),
    materialsMax: Math.ceil(data.sceneCounts.materials * 1.1),
    usedHeapMax: data.heap ? Math.ceil(data.heap.used * 1.2) : null,
  };
  result.samples.push(data);
  persist();
  return data;
}
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });
  await context.routeWebSocket(/.*/, () => {}); // Hold HMR transport disconnected during immutable baseline capture.
  result.settings.optionalSettlementArtDisabled = process.env.ART_DISABLE_SETTLEMENT === "1";
  if (result.settings.optionalSettlementArtDisabled) await context.route(/\/(bank|forge)\.glb$/, r => r.fulfill({status:503,body:"Controlled art-off comparator"}));
  let page = await context.newPage();
  errors(page, "local-cold");
  await load(page, url, "cold-new-context");
  await page.close();
  page = await context.newPage();
  errors(page, "local-warm");
  await load(page, url, "warm-same-context-new-page");
  await page.evaluate(async () => {
    const u = performance
      .getEntriesByType("resource")
      .map((r) => r.name)
      .find((u) => u.includes("/@react-three_fiber.js?"));
    if (!u) throw new Error("exact loaded fiber resource absent");
    const f = await import(u);
    window.__baselineRoot = [...f._roots.values()]
      .find((r) => r.store.getState().gl.domElement === document.querySelector("canvas"))
      .store.getState();
    window.__baselineFauna = structuredClone(window.__ember.getWorld().fauna);
  });
  for (const [device, viewport] of [
    ["desktop", { width: 1440, height: 960 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    await page.setViewportSize(viewport);
    for (const scene of scenes) {
      await place(page, scene);
      await measure(page, `${device}-${scene.id}`);
      await snap(page, `${device}-${scene.id}`);
      console.log(`captured ${device}-${scene.id}`);
    }
    await place(page, scenes[0]);
    await measure(page, `${device}-travel-return-town`);
  }
  const pilot = fs.readFileSync(
    path.join(root, "art/verification/baseline/pilot-save.json"),
    "utf8",
  );
  await page.evaluate((save) => {
    const d = JSON.parse(save),
      w = window.__ember.getWorld();
    w.buildings = d.buildings;
    w.landRev++;
  }, pilot);
  result.pilotFixtureSha256 = crypto.createHash("sha256").update(pilot).digest("hex");
  for (const [device, viewport] of [
    ["desktop", { width: 1440, height: 960 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    await page.setViewportSize(viewport);
    await place(page, scenes[0]);
    await measure(page, `${device}-pilot-town-forge`);
    await snap(page, `${device}-pilot-town-forge`);
  }
  await context.close();
  if (process.env.ART_SKIP_REFERENCE !== "1") {
  const refContext = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });
  const ref = await refContext.newPage();
  errors(ref, "approved-reference");
  try {
    await load(ref, `${reference}/?qa=1`, "approved-reference-independent");
    await snap(ref, "approved-reference-desktop");
    result.referenceState = await ref.evaluate(() => ({
      hour: window.__ember.getWorld().hour,
      position: window.__ember.getWorld().people.find((p) => p.isPlayer),
      camera: window.__emberCamera?.getCamera(),
    }));
  } catch (e) {
    result.errors.push({ label: "approved-reference", type: "blocker", text: String(e) });
  }
  await refContext.close();
  }
  result.completed = new Date().toISOString();
} catch (e) {
  result.errors.push({ type: "harness-blocker", text: String(e), stack: e.stack });
  process.exitCode = 1;
} finally {
  persist();
  await browser.close();
}
console.log(
  JSON.stringify({
    samples: result.samples.length,
    loads: result.loads.length,
    errors: result.errors.length,
    out,
  }),
);
