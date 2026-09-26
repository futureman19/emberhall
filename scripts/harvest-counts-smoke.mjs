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
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
    const readability = await page.locator('.craft-panel').evaluate((panel) => {
      const scroll = panel.querySelector('.craft-scroll');
      const card = panel.querySelector('.craft-recipe');
      const disabled = panel.querySelector('.craft-recipe button:disabled');
      const muted = card.querySelector('.text-muted');
      return {
        panel: panel.getBoundingClientRect().toJSON(),
        scrollClass: scroll.className,
        scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight,
        cardOpacity: getComputedStyle(card).opacity,
        textColor: getComputedStyle(muted).color,
        background: getComputedStyle(card).backgroundColor,
        disabled: disabled.disabled,
        disabledBorder: getComputedStyle(disabled).borderStyle,
        buttonHeight: disabled.getBoundingClientRect().height,
        hint: panel.lastElementChild.getBoundingClientRect().toJSON(),
      };
    });
    const luminance = (color) => color.match(/\d+/g).slice(0, 3).map(Number)
      .map((channel) => channel / 255)
      .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    readability.contrast = (luminance(readability.textColor) + 0.05) / (luminance(readability.background) + 0.05);
    assert.ok(readability.contrast >= 4.5, 'Recipe secondary text must meet normal-text contrast');
    assert.equal(readability.cardOpacity, '1');
    assert.equal(readability.disabled, true);
    assert.equal(readability.disabledBorder, 'dashed');
    assert.ok(readability.buttonHeight >= 44);
    assert.ok(readability.scrollHeight > readability.clientHeight);
    assert.ok(readability.hint.bottom <= readability.panel.bottom);
    const overlap = await page.locator('.craft-panel').evaluate((panel) => {
      const rect = panel.getBoundingClientRect();
      const scroll = panel.querySelector('.craft-scroll').getBoundingClientRect();
      const feedback = panel.querySelector('[role="status"]');
      const close = [...panel.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Close');
      const closeRect = close.getBoundingClientRect();
      const dock = document.querySelector('[data-testid="bottom-dock"]').getBoundingClientRect();
      const blocked = [];
      // Hit-test the panel's full surface, including the former HUD overlap strip.
      for (let x = rect.left + 4; x < rect.right - 4; x += 12) {
        for (let y = rect.top + 4; y < rect.bottom - 4; y += 12) {
          if (!panel.contains(document.elementFromPoint(x, y))) blocked.push({ x, y });
        }
      }
      return {
        blocked,
        feedback: feedback?.getBoundingClientRect().toJSON(),
        feedbackText: feedback?.textContent,
        scroll: scroll.toJSON(), dock: dock.toJSON(),
        close: closeRect.toJSON(),
        closeReachable: close.contains(document.elementFromPoint(closeRect.x + closeRect.width / 2, closeRect.y + closeRect.height / 2)),
        outsideStatuses: [...document.querySelectorAll('[role="status"]')].filter((element) => !panel.contains(element)).map((element) => element.textContent),
      };
    });
    assert.deepEqual(overlap.blocked, [], 'HUD must not cover any crafting surface');
    assert.match(overlap.feedbackText, /hatchet/i);
    assert.ok(overlap.feedback.top >= overlap.scroll.bottom, 'Result stays outside scroll content');
    assert.ok(overlap.feedback.bottom <= overlap.close.top);
    assert.ok(readability.panel.bottom < overlap.dock.top, 'Bottom navigation remains clear');
    assert.ok(overlap.closeReachable && overlap.close.height >= 44, 'Close stays touch-accessible');
    assert.ok(!overlap.outsideStatuses.some((text) => /hatchet/i.test(text)), 'No duplicate floating result');
    readability.overlap = overlap;
    const scroll = page.getByRole('region', { name: 'Crafting work' });
    const beforeScroll = await scroll.evaluate((el) => el.scrollTop);
    await scroll.focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    assert.ok(await scroll.evaluate((el) => el.scrollTop) > beforeScroll);
    await page.screenshot({ path: resolve(output, `${viewport.name}-forge.png`) });
    writeFileSync(resolve(output, `${viewport.name}-readability.json`), JSON.stringify(readability, null, 2));
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
    await page.locator('.craft-panel').getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await page.locator('.craft-panel').count(), 0);
    await page.getByRole('button', { name: 'You — pack, paperdoll, skills', exact: true }).click();
    await page.getByRole('list', { name: 'Resources', exact: true }).waitFor();
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
