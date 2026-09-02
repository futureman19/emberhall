import { chromium } from "playwright";
import path from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputDir = process.argv[3] ?? "screenshots/crafting-phase";
if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(baseUrl).hostname) && process.env.BROWSER_ALLOW_EXTERNAL_HOST !== "1") {
  throw new Error("external crafting animation smoke requires BROWSER_ALLOW_EXTERNAL_HOST=1");
}

const browser = await chromium.launch({ headless: true });
const results = [];

async function startGame(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__ember));
  await page.getByRole("button", { name: "New hall" }).click();
  await page.waitForFunction(() => window.__ember.useGame.getState().phase === "intro");
  await page.evaluate(() => window.__ember.useGame.getState().introDone());
  await page.locator('[data-testid="look-next"]').evaluate((element) => element.click());
  await page.waitForFunction(() => document.body.innerText.includes("A calling"));
  await page.locator('[data-testid="look-next"]').evaluate((element) => element.click());
  await page.waitForSelector('[data-testid="look-done"]');
  await page.locator('[data-testid="look-done"]').evaluate((element) => element.click());
  await page.waitForFunction(() => window.__ember.useGame.getState().phase === "playing");
  await page.evaluate(() => {
    const store = window.__ember.useGame.getState();
    store.speed(0);
    if (store.panel !== "none") store.setPanel("none");
  });
}

async function craft(page, kind) {
  return page.evaluate((craftKind) => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    if (!player) throw new Error("crafting smoke has no player");
    world.hour += 2 / 36;
    player.path = [];
    const random = Math.random;
    Math.random = () => 0;
    try {
      if (craftKind === "carpentry") {
        const yard = world.buildings.find((building) => building.kind === "yard");
        if (!yard) throw new Error("no yard");
        player.x = yard.tx;
        player.z = yard.ty;
        world.player.skills.carpentry = 100;
        world.player.pack.log = 1;
        store.makeRecipe("board");
      } else if (craftKind === "smithing") {
        const forge = world.buildings.find((building) => building.kind === "forge");
        if (!forge) throw new Error("no forge");
        player.x = forge.tx;
        player.z = forge.ty;
        world.player.skills.smithing = 100;
        world.player.pack.ore = 1;
        store.makeRecipe("smelt");
      } else {
        world.campfires = [];
        world.player.skills.cooking = 100;
        world.player.pack.log = 3;
        store.makeRecipe("campfire");
      }
    } finally {
      Math.random = random;
    }
    world.hour += 0.45 / 36;
    return window.__ember.useGame.getState().toast;
  }, kind);
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await startGame(page);
  const screenshots = {};
  for (const kind of ["carpentry", "smithing", "cooking"]) {
    const toast = await craft(page, kind);
    await page.waitForTimeout(120);
    const screenshot = path.join(outputDir, `${kind}-${viewport.name}.png`);
    await page.screenshot({ path: screenshot });
    screenshots[kind] = screenshot;
    const expected = kind === "carpentry" ? "board" : kind === "smithing" ? "ingot" : "fire crackles";
    if (!String(toast).toLowerCase().includes(expected)) throw new Error(`${viewport.name}: ${kind} did not resolve`);
  }
  if (consoleErrors.length || pageErrors.length) throw new Error(`${viewport.name}: ${JSON.stringify({ consoleErrors, pageErrors })}`);
  results.push({ viewport: viewport.name, screenshots, consoleErrors, pageErrors });
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ ok: true, results }, null, 2));
