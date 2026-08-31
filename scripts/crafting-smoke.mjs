#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const url = process.env.CRAFTING_SMOKE_URL || "http://127.0.0.1:8080/";
const output = resolve(process.env.CRAFTING_SMOKE_OUTPUT_DIR || "screenshots/crafting-smoke");
mkdirSync(output, { recursive: true });

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

const verdict = { url, viewports: {}, ok: true };
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    const expectedDevFallbacks = [];
    page.on("pageerror", (error) => {
      const message = `page: ${error.message}`;
      if (message.includes("Switched to client rendering") && message.includes("@1sat") && message.includes("dist\\types")) {
        expectedDevFallbacks.push(message);
      } else {
        errors.push(message);
      }
    });
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.getByText("New hall").waitFor({ state: "visible", timeout: 45000 });
    await page.evaluate(async () => {
      const live = await import("/src/game/live.ts");
      const inventory = await import("/src/game/inventory/resources.ts");
      const player = await import("/src/game/player.ts");
      const store = await import("/src/game/store.ts");
      const world = live.resetWorld();
      const self = player.you(world);
      const yard = world.buildings.find(({ kind }) => kind === "yard");
      if (!self || !yard) throw new Error("crafting fixture needs player and yard");
      self.x = yard.tx;
      self.z = yard.ty;
      world.player.skills.carpentry = 100;
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("redwood", "log", "choice"), 5);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("common_cloth", "cloth", "sound"), 1);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("ruby", "gem", "flawed"), 1);
      Math.random = () => 0;
      store.useGame.setState({ phase: "playing", openCraft: true, panel: "none", snap: live.snapshot(world) });
    });

    await page.getByRole("radio", { name: /Redwood · Choice log/ }).check();
    await page.getByRole("radio", { name: /Common Cloth · Sound cloth/ }).check();
    await page.getByRole("button", { name: "Craft selected bow" }).click();
    await page.getByRole("button", { name: "Inlay exact result" }).click();

    const state = await page.evaluate(async () => {
      const live = await import("/src/game/live.ts");
      const save = await import("/src/game/save.ts");
      const store = await import("/src/game/store.ts");
      const world = live.getWorld();
      save.writeSave(world);
      const loaded = save.loadSave();
      const item = loaded?.player.rares[0];
      store.useGame.setState({ openCraft: false, openVault: true, snap: live.snapshot(world) });
      return {
        itemName: item?.base,
        resourceId: item?.components?.[0]?.resourceId,
        gem: item?.inlays?.[0]?.resourceId,
        damage: item?.resolvedStats?.damage,
        saved: Boolean(loaded),
      };
    });
    await page.waitForTimeout(200);
    const vaultVisible = await page.getByText(/Vault/i).first().isVisible().catch(() => false);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    const screenshot = resolve(output, `${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    const passed = response?.ok()
      && state.saved
      && state.itemName === "bow"
      && state.resourceId === "redwood"
      && state.gem === "ruby"
      && state.damage === 11
      && vaultVisible
      && !overflow
      && errors.length === 0;
    verdict.viewports[viewport.name] = { passed, state, vaultVisible, overflow, errors, expectedDevFallbacks, screenshot };
    if (!passed) verdict.ok = false;
    await page.close();
  }
} finally {
  await browser.close();
}

writeFileSync(resolve(output, "verdict.json"), JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
if (!verdict.ok) process.exitCode = 1;
