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
// Warmup: the first page load after source edits absorbs vite's re-optimization
// and any queued HMR full-reload. Viewport pages then drive a quiet graph.
{
  const warm = await browser.newPage();
  await warm.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const ok = await warm.evaluate(() => {
      const btn = document.querySelector('[aria-label^="Music"]');
      return Boolean(btn) && Object.keys(btn).some((k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps"));
    }).catch(() => false);
    if (ok) break;
    await warm.waitForTimeout(1000);
  }
  await warm.waitForTimeout(1500);
  await warm.close();
}
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
    // A fresh dev server can serve the first page before its module graph
    // settles; that page hydrates late or via a client-forced reload. Wait
    // for React's fiber marker on a real DOM node — pure-read, no clicks,
    // immune to actionability races and mid-poll navigations.
    let alive = false;
    for (let attempt = 0; attempt < 30 && !alive; attempt += 1) {
      alive = await page.evaluate(() => {
        const btn = document.querySelector('[aria-label^="Music"]');
        return Boolean(btn) && Object.keys(btn).some((k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps"));
      }).catch(() => false);
      if (!alive) await page.waitForTimeout(1000);
    }
    if (!alive) throw new Error("dev server page never hydrated (React dead after 30s)");
    await page.evaluate(async () => {
      // The app loads its modules with vite's ?t= invalidation query; a bare
      // dynamic import would spin up a SECOND store/world instance. Reuse the
      // exact URLs the app fetched for the stateful singletons.
      const appUrl = (path) => performance.getEntriesByType("resource").find((e) => e.name.includes(path))?.name ?? path;
      const live = await import(appUrl("/src/game/live.ts"));
      const inventory = await import("/src/game/inventory/resources.ts");
      const player = await import("/src/game/player.ts");
      const store = await import(appUrl("/src/game/store.ts"));
      const world = live.resetWorld();
      const self = player.you(world);
      const forge = world.buildings.find(({ kind }) => kind === "forge");
      if (!self || !forge) throw new Error("metalwork fixture needs player and forge");
      self.x = forge.tx;
      self.z = forge.ty;
      world.player.skills.smithing = 100;
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("copper_ore", "ore", "choice"), 2);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("copper_ore", "ingot", "choice"), 7);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("tin_ore", "ingot", "choice"), 1);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("iron_ore", "ingot", "choice"), 3);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("oak", "board", "sound"), 3);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("fine_linen", "cloth", "sound"), 2);
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

    // Alloy: the copper-ingot row offers bronze and shows its tin requirement.
    const bronzeRow = refining.locator("li", { hasText: "(+ 1 tin ore)" });
    await bronzeRow.getByText(/Bronze ×3 · choice → ingot/).waitFor({ state: "visible", timeout: 15000 });
    await bronzeRow.getByRole("button", { name: "Smelt" }).click();

    // Shield: first armor form — iron plates, oak frame, linen binding.
    const shieldWork = page.locator('[aria-label="Advanced shield work"]');
    await shieldWork.getByText("Form · Shield").waitFor({ state: "visible", timeout: 15000 });
    await shieldWork.getByRole("radio", { name: /Iron Ore · Choice ingot/ }).check();
    await shieldWork.getByRole("radio", { name: /Oak · Sound board/ }).check();
    await shieldWork.getByRole("radio", { name: /Fine Linen · Sound cloth/ }).check();
    await shieldWork.getByRole("button", { name: "Craft selected shield" }).click();

    const state = await page.evaluate(async () => {
      const appUrl = (path) => performance.getEntriesByType("resource").find((e) => e.name.includes(path))?.name ?? path;
      const live = await import(appUrl("/src/game/live.ts"));
      const save = await import("/src/game/save.ts");
      const inventory = await import("/src/game/inventory/resources.ts");
      const player = await import("/src/game/player.ts");
      const rare = await import("/src/game/rare.ts");
      const world = live.getWorld();
      const shield = world.player.rares.find((r) => r.base === "shield");
      if (shield) player.commandEquipRare(world, shield.uid);
      const armorWorn = rare.rareMods(world).armor;
      save.writeSave(world);
      const loaded = save.loadSave();
      const item = loaded?.player.rares[0];
      return {
        ingots: inventory.resourceCount(world.player.resources, "copper_ore:ingot:choice"),
        oreLeft: inventory.resourceCount(world.player.resources, "copper_ore:ore:choice"),
        bronze: inventory.resourceCount(world.player.resources, "bronze:ingot:choice"),
        tinLeft: inventory.resourceCount(world.player.resources, "tin_ore:ingot:choice"),
        shieldArmor: shield?.resolvedStats?.armor,
        shieldEquipped: shield ? world.player.wearRare.off === shield.uid : false,
        armorWorn,
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
      && state.ingots === 1 // 7 + 1 smelted − 5 sword edge − 2 alloyed
      && state.oreLeft === 1
      && state.bronze === 3 // 2 copper + 1 tin → 3 bronze ingots
      && state.tinLeft === 0
      && state.shieldArmor === 3.5 // 2 base + 1.5 choice sturdy plates; workmanship adds no armor
      && state.shieldEquipped // rare shields equip into the off hand
      && state.armorWorn === 3.5 // equipped armor feeds the mitigation pool
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
