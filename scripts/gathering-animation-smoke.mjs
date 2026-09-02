import { chromium } from "playwright";
import path from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputDir = process.argv[3] ?? "screenshots/gathering-phase";
if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(baseUrl).hostname) && process.env.BROWSER_ALLOW_EXTERNAL_HOST !== "1") {
  throw new Error("external gathering animation smoke requires BROWSER_ALLOW_EXTERNAL_HOST=1");
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

async function gather(page, kind) {
  return page.evaluate((action) => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    if (!player) throw new Error("gathering smoke has no player");
    const tx = action === "forestry" ? 242 : 240;
    const ty = action === "forestry" ? 282 : 280;
    player.x = tx;
    player.z = ty;
    player.path = [];
    world.player.workT = 0;
    world.player.wear.main = "hoe";
    world.player.skills.farming = 100;
    world.player.skills.forestry = 0;
    const tile = world.tiles[ty]?.[tx];
    if (!tile) throw new Error("gathering smoke target is missing");
    if (action === "tilling" || action === "forestry") tile.kind = "grass";
    const target = { kind: action === "sowing" || action === "harvesting" ? "plot" : "tile", id: `${tx},${ty}`, tx, ty, label: action };
    if (action === "tilling") store.doVerb("till", target);
    if (action === "sowing") {
      world.player.pack.cabbage_seed = 1;
      store.doVerb("sowCabbage", target);
    }
    if (action === "harvesting") {
      const plot = world.plots.find((entry) => entry.tx === tx && entry.ty === ty);
      if (!plot) throw new Error("gathering smoke needs a plot");
      plot.stage = 3;
      store.doVerb("harvest", target);
    }
    if (action === "forestry") {
      world.player.pack.acorn = 1;
      store.doVerb("sowAcorn", target);
    }
    player.path = [];
    const random = Math.random;
    Math.random = () => 0;
    try {
      store.speed(1);
      for (let index = 0; index < 18; index += 1) store.tick(0.05);
      store.speed(0);
    } finally {
      Math.random = random;
    }
    world.hour += 0.4 / 36;
    return { toast: window.__ember.useGame.getState().toast, intent: world.player.intent.kind, workT: world.player.workT, log: world.log[0]?.text ?? null };
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
  for (const kind of ["tilling", "sowing", "harvesting", "forestry"]) {
    const result = await gather(page, kind);
    await page.waitForTimeout(120);
    const screenshot = path.join(outputDir, `${kind}-${viewport.name}.png`);
    await page.screenshot({ path: screenshot });
    screenshots[kind] = screenshot;
    const expected = kind === "tilling" ? "bed" : kind === "sowing" ? "seed takes" : kind === "harvesting" ? "cabbage" : "oak takes";
    if (!String(result.toast).toLowerCase().includes(expected)) throw new Error(`${viewport.name}: ${kind} did not resolve: ${result.toast}`);
    if (result.intent !== "none") throw new Error(`${viewport.name}: ${kind} intent did not complete`);
  }
  if (consoleErrors.length || pageErrors.length) throw new Error(`${viewport.name}: ${JSON.stringify({ consoleErrors, pageErrors })}`);
  results.push({ viewport: viewport.name, screenshots, consoleErrors, pageErrors });
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ ok: true, results }, null, 2));
