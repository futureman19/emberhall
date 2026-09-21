#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const url = process.env.METALWORK_SMOKE_URL || "http://127.0.0.1:8080/";
const output = resolve(process.env.METALWORK_SMOKE_OUTPUT_DIR || "screenshots/metalwork-smoke");
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
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
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
      const forge = world.buildings.find(({ kind }) => kind === "forge");
      if (!self || !forge) throw new Error("metalwork fixture needs player and forge");
      self.x = forge.tx;
      self.z = forge.ty;
      world.player.skills.smithing = 100;
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("copper_ore", "ore", "choice"), 2);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("copper_ore", "ingot", "choice"), 5);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("oak", "board", "sound"), 1);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("fine_linen", "cloth", "sound"), 1);
      Math.random = () => 0.5;
      store.useGame.setState({ phase: "playing", openCraft: true, panel: "none", snap: live.snapshot(world) });
      // Freeze the frame-driven sim: every tick re-renders the gump and replaces
      // radio nodes mid-click, which makes Playwright's actionability loop hang.
      store.useGame.getState().tick = () => {};
      store.useGame.setState({ snap: live.snapshot(world) });
    });

    // Refining panel: copper ore row smelts into an ingot through the real button.
    const refining = page.locator('[aria-label="Refining"]');
    await refining.getByText(/Copper Ore ×2 · choice → ingot/).waitFor({ state: "visible", timeout: 15000 });
    await refining.getByRole("button", { name: "Smelt" }).first().click();
    await refining.getByText(/Copper Ore ×1 · choice → ingot/).waitFor({ state: "visible", timeout: 15000 });

    // Sword form: pick the exact stacks and craft through the real button.
    const swordWork = page.locator('[aria-label="Advanced sword work"]');
    await swordWork.getByRole("radio", { name: /Copper Ore · Choice ingot/ }).check();
    await swordWork.getByRole("radio", { name: /Oak · Sound board/ }).check();
    await swordWork.getByRole("radio", { name: /Fine Linen · Sound cloth/ }).check();
    await swordWork.getByRole("button", { name: "Craft selected sword" }).click();

    const state = await page.evaluate(async () => {
      const live = await import("/src/game/live.ts");
      const save = await import("/src/game/save.ts");
      const inventory = await import("/src/game/inventory/resources.ts");
      const world = live.getWorld();
      save.writeSave(world);
      const loaded = save.loadSave();
      const item = loaded?.player.rares[0];
      return {
        ingots: inventory.resourceCount(world.player.resources, "copper_ore:ingot:choice"),
        oreLeft: inventory.resourceCount(world.player.resources, "copper_ore:ore:choice"),
        itemName: item?.base,
        edge: item?.components?.[0]?.resourceId,
        hitBonus: item?.resolvedStats?.hitBonus,
        saved: Boolean(loaded),
      };
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    const screenshot = resolve(output, `${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    const passed = response?.ok()
      && state.saved
      && state.ingots === 1 // 5 + 1 smelted − 5 consumed by the sword edge
      && state.oreLeft === 1
      && state.itemName === "sword"
      && state.edge === "copper_ore"
      && state.hitBonus === 1.875 // 0.75 choice copper edge (primary) + 0.125 sound linen handling (secondary) + 1 fine workmanship
      && !overflow
      && errors.length === 0;
    verdict.viewports[viewport.name] = { passed, state, overflow, errors, screenshot };
    if (!passed) verdict.ok = false;
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(resolve(output, "verdict.json"), JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
if (!verdict.ok) process.exitCode = 1;
