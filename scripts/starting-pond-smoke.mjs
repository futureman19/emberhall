import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createWorld } from "../src/game/world.ts";
import { SAVE_KEY, writeSave } from "../src/game/save.ts";

const [url = "http://127.0.0.1:8080", label = "dev"] = process.argv.slice(2);
assert.match(label, /^[a-z0-9-]+$/);
const out = path.resolve("screenshots/starting-pond", label);
fs.mkdirSync(out, { recursive: true });
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
const world = createWorld(7);
world.hour = 12;
world.speed = 0;
writeSave(world);
const raw = storage.get(SAVE_KEY);
assert(raw);
const result = { url, label, checks: [], errors: [], passed: false };
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=d3d11", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const watchdog = setTimeout(() => browser.close(), 240000);
try {
  for (const [device, viewport] of [
    ["desktop", { width: 1440, height: 960 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport, hasTouch: device === "mobile" });
    await context.routeWebSocket(/.*/, () => {});
    await context.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key: SAVE_KEY, raw });
    const page = await context.newPage();
    page.on("pageerror", (error) => result.errors.push({ device, type: "page", text: error.message }));
    page.on("console", (message) => {
      if (message.type() === "error") result.errors.push({ device, type: "console", text: message.text() });
    });
    await page.goto(url + "/?qa=1", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByRole("button", { name: "Continue", exact: true }).click({ timeout: 60000 });
    await page.waitForFunction(() => window.__ember?.useGame.getState().phase === "playing", {}, { timeout: 90000 });
    const snapshot = await page.evaluate(() => {
      const state = window.__ember.useGame.getState();
      state.speed(0);
      state.setPanel("none");
      state.closeCtx();
      const w = window.__ember.getWorld();
      const pond = [];
      for (let z = 280; z <= 315; z++) for (let x = 235; x <= 275; x++) {
        if (w.tiles[z][x].kind === "water") pond.push({ x, z, h: w.tiles[z][x].h });
      }
      const player = w.people.find((p) => p.isPlayer);
      return { pond, player: { x: player.x, z: player.z }, seed: w.seed };
    });
    assert(snapshot.pond.length > 0, "Pond must be present after tile-free save load");
    assert.equal(snapshot.player.x, 256);
    assert.equal(snapshot.player.z, 293);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(out, device + "-spawn.png") });
    result.checks.push({ device, kind: "spawn-and-save-load", ...snapshot });
    // Actual command/path traversal, not actor teleportation. Native picking is not asserted.
    const bank = snapshot.pond.reduce((best, tile) => tile.z < best.z ? tile : best);
    const destination = { x: bank.x, z: bank.z - 1 };
    const traversal = await page.evaluate(({ x, z }) => {
      const state = window.__ember.useGame.getState();
      const w = window.__ember.getWorld();
      state.speed(1);
      state.doVerb("walk", { kind: "tile", tx: x, ty: z });
      for (let i = 0; i < 600; i++) state.tick(0.05);
      state.speed(0);
      const player = w.people.find((p) => p.isPlayer);
      return { x: player.x, z: player.z, destination: { x, z }, tile: w.tiles[z][x] };
    }, destination);
    assert(Math.hypot(traversal.x - destination.x, traversal.z - destination.z) < 1, "Player reaches pond bank from spawn");
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(out, device + "-bank.png") });
    result.checks.push({ device, kind: "bank-handler-traversal", ...traversal });
    await context.close();
  }
  assert.deepEqual(result.errors, []);
  result.passed = true;
} catch (error) {
  result.failure = error.stack;
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(result, null, 2));
  await browser.close();
}
console.log(JSON.stringify(result, null, 2));
