import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const url = process.env.EMBERHALL_URL || "http://127.0.0.1:8080/";
const out = process.env.EMBERHALL_ARTIFACT_DIR || fileURLToPath(new URL("../art/verification/forged-oak", import.meta.url));
const manifest = JSON.parse(readFileSync(new URL("../public/art/gui/forged-oak/manifest.json", import.meta.url), "utf8"));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--enable-webgl", "--ignore-gpu-blocklist"] });
const report = { url, cases: [], errors: [] };
const boxes = (page) => page.evaluate(() => Object.fromEntries(["bottom-band", "bottom-dock", "docked-minimap", "right-rail"].map((id) => {
  const r = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
  return [id, r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null];
})));
try {
  for (const [name, width, height] of [["desktop", 1440, 960], ["mobile", 390, 844]]) {
    for (const reject of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.routeWebSocket(/.*/, () => {});
      const rejected = [];
      if (reject) await context.route("**/art/gui/forged-oak/*.png", (route) => { rejected.push(route.request().url()); return route.abort("failed"); });
      const page = await context.newPage();
      page.on("pageerror", (e) => report.errors.push(e.message));
      page.setDefaultTimeout(60_000);
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(window.__ember?.useGame));
      await page.evaluate(() => window.__ember.useGame.getState().begin(false));
      await page.waitForFunction(() => window.__ember.useGame.getState().phase === "playing");
      await page.evaluate(() => { window.__ember.useGame.getState().speed(0); window.__ember.useGame.setState({ panel: "none" }); });
      const band = page.getByTestId("bottom-band");
      if (name === "mobile") await band.getByLabel("Show mini-map", { exact: true }).click();
      await page.getByTestId("docked-minimap").waitFor();
      const before = await boxes(page);
      const proof = [];
      if (!reject) {
        for (const asset of manifest.assets) {
          const response = await page.request.get(new URL(asset.url, url).href);
          assert.equal(response.status(), 200);
          const hash = createHash("sha256").update(await response.body()).digest("hex");
          assert.equal(hash, asset.sha256); proof.push({ name: asset.name, sha256: hash });
        }
        await page.evaluate(async (assets) => Promise.all(assets.map((src) => new Promise((resolve, reject) => {
          const image = new Image(); image.onload = resolve; image.onerror = reject; image.src = src;
        }))), manifest.assets.map((a) => a.url));
      }
      await page.waitForTimeout(300);
      const material = await band.evaluate((el) => getComputedStyle(el).backgroundImage);
      assert.ok(material.includes("forged-oak/band.png"));
      assert.ok(material.includes("linear-gradient"), "base material survives image failure");
      const buttons = await band.locator("button").evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height).map((r) => [r.width, r.height]));
      assert.ok(buttons.every(([w, h]) => w >= 44 && h >= 44));
      const rim = await page.getByTestId("docked-minimap").evaluate((el) => ({ image: getComputedStyle(el, "::after").backgroundImage, pointer: getComputedStyle(el, "::after").pointerEvents }));
      assert.ok(rim.image.includes("forged-oak/corner.png")); assert.equal(rim.pointer, "none");
      const noArt = await page.addStyleTag({ content: ":root { --oak-band: none; --oak-button: none; --oak-corner: none; }" });
      assert.deepEqual(await boxes(page), before, "texture absence cannot move geometry");
      await noArt.evaluate((el) => el.remove());
      await page.screenshot({ path: join(out, `${name}-${reject ? "fallback" : "oak"}.png`) });
      await band.getByLabel("Guide", { exact: true }).click();
      await page.locator(".drawer-shell").waitFor();
      await page.keyboard.press("Escape");
      await page.locator(".drawer-shell").waitFor({ state: "detached" });
      await page.getByTestId("docked-minimap").getByLabel("Hide mini-map", { exact: true }).click();
      await page.getByTestId("docked-minimap").waitFor({ state: "detached" });
      await band.getByLabel("Show mini-map", { exact: true }).click();
      await page.getByTestId("docked-minimap").waitFor();
      if (reject) for (const asset of manifest.assets) assert.ok(rejected.some((u) => u.endsWith(asset.url)), `actually rejected ${asset.name}`);
      report.cases.push({ name, reject, geometry: before, buttons, proof, rejected, interactions: "Guide/Escape, map hide/show" });
      await context.close();
    }
  }
  assert.deepEqual(report.errors, []);
  report.ok = true;
} finally {
  await browser.close();
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ ok: report.ok, cases: report.cases.map(({ name, reject }) => ({ name, reject })), errors: report.errors }, null, 2));
