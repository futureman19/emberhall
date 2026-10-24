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
const domClick = async (locator) => {
  await locator.waitFor({ state: "visible" });
  await locator.evaluate((element) => element.click());
};
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=d3d11", "--enable-webgl", "--ignore-gpu-blocklist"] });
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
    await page.waitForFunction(() => {
      const button = document.querySelector('[aria-label^="Music"]');
      return button && Object.keys(button).some((key) => key.startsWith("__reactFiber"));
    });
    // Preserve Vite query strings so fixtures use the rendered app's singletons.
    const modules = await page.evaluate(async () => {
      const hud = await (await fetch("/src/components/game/hud.tsx")).text();
      const specifier = (name) => {
        const match = hud.match(new RegExp(`from ["']([^"']*/src/game/${name}[.]ts[^"']*)["']`));
        if (!match) throw new Error(`Missing served ${name} singleton import`);
        return match[1];
      };
      return { live: specifier("live"), store: specifier("store") };
    });
    await page.evaluate(async (modules) => {
      const live = await import(modules.live);
      const inventory = await import("/src/game/inventory/resources.ts");
      const player = await import("/src/game/player.ts");
      const store = await import(modules.store);
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
      // Stop frame ticks replacing radio nodes during the fixture interaction.
      store.useGame.setState({ tick: () => {} });
    }, modules);

    await domClick(page.getByRole("tab", { name: "Forms", exact: true }));
    const bowWork = page.locator('[aria-label="Advanced bow work"]');
    const wood = bowWork.getByRole("radio", { name: /Redwood · Choice log/ });
    const cloth = bowWork.getByRole("radio", { name: /Common Cloth · Sound cloth/ });
    await domClick(wood);
    await domClick(cloth);
    if (!(await wood.isChecked()) || !(await cloth.isChecked())) {
      throw new Error("Bow material radios did not retain both selected stacks");
    }
    await domClick(bowWork.getByRole("button", { name: "Craft selected bow" }));
    await domClick(page.getByRole("tab", { name: "Inlay", exact: true }));
    await domClick(page.locator('[aria-label="Gem inlay"]').getByRole("button", { name: "Inlay exact result" }));

    const state = await page.evaluate(async (modules) => {
      const live = await import(modules.live);
      const save = await import("/src/game/save.ts");
      const store = await import(modules.store);
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
    }, modules);
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
