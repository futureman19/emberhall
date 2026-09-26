import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const output = resolve("screenshots/harvest-counts");
mkdirSync(output, { recursive: true });
// Windows software WebGL stalls input during this full-world smoke. Use the
// native ANGLE backend here; keep Chromium's defaults on other platforms.
const browser = await chromium.launch({
  headless: true,
  args: process.platform === "win32" ? ["--use-gl=angle", "--use-angle=d3d11"] : [],
});
const verdict = [];
try {
  for (const viewport of [{ name: "desktop", width: 1280, height: 800 }, { name: "mobile", width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(25000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("http://127.0.0.1:8080/");
    await page.getByText("New hall", { exact: true }).waitFor();
    // Reuse the module URL loaded by the HUD; Vite HMR timestamps otherwise
    // create a second Zustand store that the visible game never subscribes to.
    await page.evaluate(async () => {
      const hud = await (await fetch("/src/components/game/hud.tsx")).text();
      const storeUrl = hud.match(/from\s+["']([^"']*\/game\/store\.ts[^"']*)["']/)?.[1];
      if (!storeUrl) throw new Error("Could not resolve the HUD store module");
      window.__harvestSmokeStoreUrl = storeUrl;
    });
    console.log(`${viewport.name}: entering fixture`);
    await page.evaluate(async () => {
      const live = await import("/src/game/live.ts");
      const { you } = await import("/src/game/player.ts");
      const { useGame } = await import(window.__harvestSmokeStoreUrl);
      const { addResource, makeResourceStackKey } = await import("/src/game/inventory/resources.ts");
      const world = live.resetWorld();
      const yard = world.buildings.find((b) => b.kind === "yard");
      Object.assign(you(world), { x: yard.tx, z: yard.ty, path: [] });
      world.player.pack = {};
      world.player.resources = { stacks: {} };
      for (const [id, form, count] of [["oak", "log", 2], ["iron_ore", "ore", 4], ["redwood", "log", 9], ["highland_ore", "ore", 9]]) {
        addResource(world.player.resources, makeResourceStackKey(id, form, "rough"), count);
      }
      world.player.skills.carpentry = 100;
      world.player.skills.smithing = 100;
      // Fix only synchronous craft rolls; leave renderer randomness untouched.
      for (const action of ["makeRecipe", "makeRecipeBatch"]) {
        const original = useGame.getState()[action];
        useGame.setState({ [action]: (...args) => {
          const random = Math.random;
          let roll = 0;
          Math.random = () => 0.5 + ((++roll * 0.61803398875) % 1) * 0.1;
          try { return original(...args); } finally { Math.random = random; }
        } });
      }
      useGame.setState({ phase: "playing", panel: "you", snap: live.snapshot(world) });
      useGame.getState().tick = () => {};
    });
    await page.getByRole("list", { name: "Resources", exact: true }).evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: resolve(output, `${viewport.name}-pack.png`) });
    // Open the existing crafting UI through its visible action, not a command fixture.
    await page.getByRole("button", { name: "Work", exact: true }).click({ noWaitAfter: true });
    await page.getByRole("tab", { name: "Recipes", exact: true }).click({ noWaitAfter: true });
    const row = (label) => page.locator("li").filter({ has: page.getByText(label, { exact: true }) });
    assert.match(await row("Boards").innerText(), /Log\s*\(2\)/);
    assert.match(await row("Smelt ore").innerText(), /Iron ore\s*\(4\)/i);
    await row("Boards").getByRole("button", { name: "Make", exact: true }).click({ noWaitAfter: true });
    assert.match(await row("Boards").innerText(), /Log\s*\(1\)/);
    await row("Boards").evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: resolve(output, `${viewport.name}-boards.png`) });
    console.log(`${viewport.name}: entering fixture`);
    await page.evaluate(async () => {
      const live = await import("/src/game/live.ts");
      const { you } = await import("/src/game/player.ts");
      const { useGame } = await import(window.__harvestSmokeStoreUrl);
      const world = live.getWorld();
      const forge = world.buildings.find((b) => b.kind === "forge");
      Object.assign(you(world), { x: forge.tx, z: forge.ty, path: [] });
      useGame.setState({ snap: live.snapshot(world) });
    });
    console.log(`${viewport.name}: smelting`);
    await row("Smelt ore").getByRole("button", { name: "Max 4", exact: true }).click({ noWaitAfter: true });
    console.log(`${viewport.name}: smelted`);
    assert.match(await row("Smelt ore").innerText(), /Iron ore\s*\(0\)/i);
    console.log(`${viewport.name}: making hatchet`, await row("Hatchet").innerText());
    console.log(await page.evaluate(async () => (await import("/src/game/live.ts")).getWorld().player.pack));
    await row("Hatchet").getByRole("button", { name: "Make", exact: true }).click({ noWaitAfter: true });
    console.log(`${viewport.name}: made hatchet`);
    await row("Smelt ore").evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: resolve(output, `${viewport.name}-forge.png`) });
    console.log(`${viewport.name}: saving`);
    const state = await page.evaluate(async () => {
      const { getWorld } = await import("/src/game/live.ts");
      const { writeSave, loadSave } = await import("/src/game/save.ts");
      writeSave(getWorld());
      const loaded = loadSave();
      return { pack: loaded.player.pack, stacks: loaded.player.resources.stacks, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    assert.equal(state.pack.board, 2);
    assert.equal(state.pack.hatchet, 1);
    assert.equal(state.pack.ingot, 0);
    assert.equal(state.pack.log ?? 0, 0);
    assert.equal(state.pack.ore ?? 0, 0);
    assert.equal(state.stacks["oak:log:rough"], 1);
    assert.equal(state.stacks["redwood:log:rough"], 9);
    assert.equal(state.stacks["highland_ore:ore:rough"], 9);
    assert.equal(state.overflow, false);
    assert.deepEqual(errors, []);
    verdict.push({ viewport: viewport.name, state, errors, passed: true });
    await page.close();
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(output, "verdict.json"), JSON.stringify(verdict, null, 2));
  await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 5000))]);
}
console.log(JSON.stringify(verdict, null, 2));
