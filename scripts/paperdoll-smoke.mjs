#!/usr/bin/env node
/**
 * Smoke: the You drawer's Direland-style dressing room — living 3D doll
 * canvas, pack icon grid with counts, select → action bar (Hold/Drop),
 * resource icon grid with grade rings. Trusted Playwright clicks against
 * the dev server; store/live module identity resolved from served hud.tsx.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const url = process.env.PAPERDOLL_SMOKE_URL || "http://127.0.0.1:8080/";
const output = resolve(process.env.PAPERDOLL_SMOKE_OUTPUT_DIR || "screenshots/paperdoll-smoke");
mkdirSync(output, { recursive: true });

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844, hasTouch: true },
];

const verdict = { url, ok: true, viewports: {}, errors: [] };
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => {
      const message = `page: ${error.message}`;
      if (!(message.includes("Switched to client rendering") && message.includes("@1sat"))) errors.push(message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    page.setDefaultTimeout(20000);
    await page.getByText("New hall").waitFor({ state: "visible", timeout: 45000 });

    const mods = await page.evaluate(async () => {
      const src = await (await fetch("/src/components/game/hud.tsx")).text();
      return {
        store: src.match(/from "(\/src\/game\/store\.ts[^"]*)"/)?.[1] ?? "/src/game/store.ts",
        live: src.match(/from "(\/src\/game\/live\.ts[^"]*)"/)?.[1] ?? "/src/game/live.ts",
        inventory: "/src/game/inventory/resources.ts",
      };
    });

    // Fixture: dressed + packed player, You drawer open, sim frozen.
    await page.evaluate(async ({ live, store, inventory }) => {
      const liveMod = await import(live);
      const storeMod = await import(store);
      const invMod = await import(inventory);
      const world = liveMod.resetWorld();
      world.player.pack = { hatchet: 1, bread: 2, potion_heal: 1, torch: 1 };
      world.player.wear = { chest: "leather", legs: "hose", feet: "boots", head: "hood", main: "sword", off: "shield" };
      invMod.addResource(world.player.resources, invMod.makeResourceStackKey("oak", "log", "sound"), 7);
      invMod.addResource(world.player.resources, invMod.makeResourceStackKey("ruby", "gem", "flawed"), 2);
      storeMod.useGame.setState({ phase: "playing", panel: "you", snap: liveMod.snapshot(world) });
      storeMod.useGame.getState().tick = () => {};
    }, mods);
    await page.waitForTimeout(800);

    const steps = {};

    // 1. Drawer open with the living doll canvas inside it.
    steps.dollCanvas = await page.evaluate(() => Boolean(document.querySelector(".drawer-shell canvas")));

    // 2. Pack grid: 4 item cells with counts; resources grid: 2 cells.
    steps.packCells = await page.locator('[data-testid="pack-grid"] > li').count();
    steps.resourceCells = await page.locator('[data-testid="resource-grid"] > li').count();

    // 3. Select bread → action bar shows with Drop; drop one → count falls to 1.
    await page.getByRole("button", { name: "Bread ×2" }).click({ noWaitAfter: true });
    steps.actionBar = await page.locator('[data-testid="pack-actions"]').isVisible();
    await page.locator('[data-testid="pack-actions"]').getByRole("button", { name: "Drop" }).click({ noWaitAfter: true });
    await page.waitForTimeout(150);
    steps.breadAfterDrop = await page.evaluate(async ({ store }) => {
      const storeMod = await import(store);
      return storeMod.useGame.getState().snap.player.pack.bread ?? 0;
    }, mods);

    // 4. Select hatchet → Hold verb; hold it → main hand swaps to hatchet.
    await page.getByRole("button", { name: "Hatchet ×1" }).click({ noWaitAfter: true });
    const hold = page.locator('[data-testid="pack-actions"]').getByRole("button", { name: "Hold" });
    steps.holdVerb = await hold.isVisible();
    await hold.click({ noWaitAfter: true });
    await page.waitForTimeout(150);
    steps.mainAfterHold = await page.evaluate(async ({ store }) => {
      const storeMod = await import(store);
      return storeMod.useGame.getState().snap.player.wear.main ?? null;
    }, mods);

    // 5. Pin the torch from the action bar, close the drawer, use the quick slot.
    await page.getByRole("button", { name: "Torch ×1" }).click({ noWaitAfter: true });
    await page.locator('[data-testid="pack-actions"]').getByRole("button", { name: "Pin" }).click({ noWaitAfter: true });
    await page.waitForTimeout(150);
    await page.evaluate(async ({ store }) => {
      const storeMod = await import(store);
      storeMod.useGame.setState({ panel: "none" });
    }, mods);
    await page.waitForTimeout(300);
    steps.hotbarCells = await page.locator('[data-testid="hotbar"] > *').count();
    steps.hotbarInCluster = await page.evaluate(() => {
      const cluster = document.querySelector('[data-testid="combat-cluster"]');
      const bar = document.querySelector('[data-testid="hotbar"]');
      return Boolean(cluster && bar && cluster.contains(bar));
    });
    const torchSlot = page.getByRole("button", { name: "Torch (quick slot)" });
    steps.torchSlot = await torchSlot.isVisible();
    await torchSlot.click({ noWaitAfter: true });
    await page.waitForTimeout(150);
    steps.mainAfterHotbar = await page.evaluate(async ({ store }) => {
      const storeMod = await import(store);
      return storeMod.useGame.getState().snap.player.wear.main ?? null;
    }, mods);

    // 6. Press-and-hold the slot (past TOUCH_HOLD_MS) → unpinned, bar goes away.
    //    Headless SwiftShader renders the 3D world at seconds-per-interaction,
    //    so the 550ms hold timer lands far later than wall-clock — poll for the
    //    unpin instead of guessing a wait. (Verified live: handler + timer work.)
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="hotbar"] button');
      el?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    try {
      await page.waitForFunction(() => !document.querySelector('[data-testid="hotbar"]'), { timeout: 20000 });
      steps.hotbarGone = true;
    } catch {
      steps.hotbarGone = false;
    }
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="hotbar"] button');
      el?.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });

    await page.screenshot({ path: resolve(output, `paperdoll-${viewport.name}.png`) });
    verdict.viewports[viewport.name] = { steps, errors };
    if (!steps.dollCanvas || steps.packCells !== 4 || steps.resourceCells !== 2 || !steps.actionBar || steps.breadAfterDrop !== 1 || !steps.holdVerb || steps.mainAfterHold !== "hatchet"
      || steps.hotbarCells !== 6 || !steps.hotbarInCluster || !steps.torchSlot || steps.mainAfterHotbar !== "torch" || !steps.hotbarGone || errors.length) {
      verdict.ok = false;
    }
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(resolve(output, "verdict.json"), JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
process.exit(verdict.ok ? 0 : 1);
