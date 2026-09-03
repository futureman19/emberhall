import { chromium } from "playwright";
import path from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputDir = process.argv[3] ?? "screenshots/extraction-phase";
if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(baseUrl).hostname) && process.env.BROWSER_ALLOW_EXTERNAL_HOST !== "1") {
  throw new Error("external extraction animation smoke requires BROWSER_ALLOW_EXTERNAL_HOST=1");
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

async function extract(page, action) {
  return page.evaluate((kind) => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    if (!player) throw new Error("extraction smoke needs a player");
    world.hour = 12;
    player.x = 256;
    player.z = 302;
    player.facing = Math.PI / 2;
    player.path = [];
    world.weather.kind = "clear";
    world.weather.cloud = 0;
    world.weather.wet = 0;
    world.weather.wind = 0;
    world.weather.untilHour = world.hour + 24;
    for (let z = 294; z <= 310; z += 1) {
      for (let x = 248; x <= 264; x += 1) {
        const tile = world.tiles[z]?.[x];
        if (tile) tile.kind = "grass";
      }
    }
    const tx = kind === "lumberjacking" ? 257 : 259;
    const ty = 302;
    player.x = tx - 1;
    player.z = ty;
    world.tiles[ty][tx].kind = kind === "lumberjacking" ? "tree" : "rock";
    world.landRev += 1;
    world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
    world.player.workT = 0;
    world.player.skills.lumberjack = 100;
    world.player.skills.mining = 100;
    world.player.wear.main = kind === "lumberjacking" ? "hatchet" : "pick";
    const before = Object.values(world.player.resources.stacks).reduce((sum, amount) => sum + amount, 0);
    store.doVerb(kind === "lumberjacking" ? "chop" : "mine", { kind: "tile", id: `${tx},${ty}`, tx, ty, label: kind });
    player.path = [];
    const random = Math.random;
    Math.random = () => 0;
    try {
      store.speed(1);
      for (let index = 0; index < 14; index += 1) store.tick(0.05);
      store.speed(0);
    } finally {
      Math.random = random;
    }
    world.hour += 0.3 / 36;
    const after = Object.values(world.player.resources.stacks).reduce((sum, amount) => sum + amount, 0);
    return {
      gained: after - before,
      intent: world.player.intent.kind,
      tile: world.tiles[ty][tx].kind,
      toast: window.__ember.useGame.getState().toast,
    };
  }, action);
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
  for (const kind of ["lumberjacking", "mining"]) {
    const result = await extract(page, kind);
    if (result.gained !== 2 || result.intent !== "none" || result.tile !== "dirt" || !String(result.toast).toLowerCase().includes("recovered")) {
      throw new Error(`${viewport.name}: ${kind} mechanics changed: ${JSON.stringify(result)}`);
    }
    const badge = kind === "lumberjacking" ? "AXE · LUMBERJACKING" : "PICK · MINING";
    await page.getByText(badge, { exact: true }).waitFor({ state: "visible" });
    const screenshot = path.join(outputDir, `${kind}-${viewport.name}.png`);
    await page.screenshot({ path: screenshot });
    screenshots[kind] = screenshot;
    await page.evaluate(() => { window.__ember.getWorld().hour += 1.1 / 36; });
  }
  if (consoleErrors.length || pageErrors.length) throw new Error(`${viewport.name}: ${JSON.stringify({ consoleErrors, pageErrors })}`);
  results.push({ viewport: viewport.name, screenshots, consoleErrors, pageErrors });
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ ok: true, results }, null, 2));
