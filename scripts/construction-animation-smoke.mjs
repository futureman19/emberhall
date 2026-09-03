import { chromium } from "playwright";
import path from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputDir = process.argv[3] ?? "screenshots/construction-phase";
if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(baseUrl).hostname) && process.env.BROWSER_ALLOW_EXTERNAL_HOST !== "1") {
  throw new Error("external construction animation smoke requires BROWSER_ALLOW_EXTERNAL_HOST=1");
}

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

async function build(page, kind) {
  return page.evaluate((buildingKind) => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    if (!player) throw new Error("construction smoke needs a player");
    world.hour = 12;
    world.weather.kind = "clear";
    world.weather.cloud = 0;
    world.weather.wet = 0;
    world.weather.wind = 0;
    world.weather.untilHour = world.hour + 24;
    const tx = buildingKind === "farm" ? 300 : 324;
    const ty = 340;
    for (let z = ty - 10; z <= ty + 10; z += 1) {
      for (let x = tx - 10; x <= tx + 10; x += 1) {
        const tile = world.tiles[z]?.[x];
        if (tile) tile.kind = "grass";
      }
    }
    player.x = tx;
    player.z = ty + 7;
    player.path = [];
    world.gold = 500;
    if (buildingKind === "porch") world.player.pack.deed_porch = 1;
    const before = {
      gold: world.gold,
      deed: world.player.pack.deed_porch ?? 0,
      plots: world.plots.length,
      buildings: world.buildings.length,
    };
    store.armBuild(buildingKind);
    store.useTile(tx, ty);
    player.x = tx;
    player.z = ty;
    world.hour += 0.58 / 36;
    const placed = world.buildings.find((entry) => entry.kind === buildingKind && entry.tx === tx && entry.ty === ty);
    return {
      placed: Boolean(placed),
      ownerId: placed?.ownerId ?? null,
      playerId: world.player.id,
      goldSpent: before.gold - world.gold,
      deedSpent: before.deed - (world.player.pack.deed_porch ?? 0),
      plotsAdded: world.plots.length - before.plots,
      buildingsAdded: world.buildings.length - before.buildings,
      toast: window.__ember.useGame.getState().toast,
    };
  }, kind);
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await startGame(page);
  const screenshots = {};

  const civic = await build(page, "farm");
  await page.waitForTimeout(500);
  if (!civic.placed || civic.goldSpent !== 28 || civic.plotsAdded !== 8 || civic.buildingsAdded !== 1) {
    throw new Error(`${viewport.name}: civic construction changed: ${JSON.stringify(civic)}`);
  }
  await page.getByText("HAMMER · FARM RAISED", { exact: true }).waitFor({ state: "visible" });
  screenshots.civic = path.join(outputDir, `civic-${viewport.name}.png`);
  await page.screenshot({ path: screenshots.civic });
  await page.evaluate(() => { window.__ember.getWorld().hour += 1.7 / 36; });

  const house = await build(page, "porch");
  await page.waitForTimeout(700);
  if (!house.placed || house.deedSpent !== 1 || house.buildingsAdded !== 1 || house.ownerId !== house.playerId) {
    throw new Error(`${viewport.name}: house construction changed: ${JSON.stringify(house)}`);
  }
  await page.getByText("HAMMER · PORCH RAISED", { exact: true }).waitFor({ state: "visible" });
  screenshots.house = path.join(outputDir, `house-${viewport.name}.png`);
  await page.screenshot({ path: screenshots.house });

  if (consoleErrors.length || pageErrors.length) throw new Error(`${viewport.name}: ${JSON.stringify({ consoleErrors, pageErrors })}`);
  results.push({ viewport: viewport.name, screenshots, consoleErrors, pageErrors });
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ ok: true, results }, null, 2));
