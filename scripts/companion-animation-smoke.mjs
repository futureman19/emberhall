import { chromium } from "playwright";
import path from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputDir = process.argv[3] ?? "screenshots/companion-phase";
if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(baseUrl).hostname) && process.env.BROWSER_ALLOW_EXTERNAL_HOST !== "1") {
  throw new Error("external companion animation smoke requires BROWSER_ALLOW_EXTERNAL_HOST=1");
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

async function prepare(page) {
  return page.evaluate(() => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    const pet = world.fauna.find((creature) => creature.kind === "wolf") ?? world.fauna[0];
    if (!player || !pet) throw new Error("companion smoke needs a player and fauna");
    world.hour = 12;
    world.weather.kind = "clear";
    world.weather.cloud = 0;
    world.weather.wet = 0;
    world.weather.wind = 0;
    world.weather.untilHour = world.hour + 24;
    player.x = 256;
    player.z = 302;
    player.path = [];
    pet.x = 258;
    pet.z = 302;
    pet.kind = "wolf";
    pet.path = [];
    pet.task = "follow";
    pet.ownerId = world.player.id;
    pet.loyalty = 40;
    pet.stay = false;
    pet.name = "Soot";
    pet.warnedLoyal = false;
    for (let z = 294; z <= 310; z += 1) {
      for (let x = 248; x <= 264; x += 1) {
        const tile = world.tiles[z]?.[x];
        if (tile?.kind === "tree") tile.kind = "grass";
      }
    }
    world.landRev += 1;
    store.setPanel("none");
    return pet.id;
  });
}

async function act(page, petId, action) {
  return page.evaluate(({ id, kind }) => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const pet = world.fauna.find((creature) => creature.id === id);
    if (!pet) throw new Error("companion disappeared");
    const before = { loyalty: pet.loyalty, meat: world.player.pack.meat ?? 0 };
    if (kind === "stay") store.stayPet(id);
    if (kind === "follow") store.followPet(id);
    if (kind === "feed") { world.player.pack = { meat: 1 }; store.feedPet(id); }
    if (kind === "name") store.namePet(id, "Ember Paw");
    if (kind === "release") store.releasePet(id);
    world.hour += 0.44 / 36;
    return {
      stay: pet.stay,
      task: pet.task,
      ownerId: pet.ownerId,
      loyaltyGain: pet.loyalty - before.loyalty,
      meat: world.player.pack.meat ?? 0,
      name: pet.name,
      toast: window.__ember.useGame.getState().toast,
    };
  }, { id: petId, kind: action });
}

const labels = { stay: "STAYING", follow: "FOLLOWING", feed: "EATING", name: "NAMED EMBER PAW", release: "RELEASED" };
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
  const petId = await prepare(page);
  await page.waitForTimeout(500);
  const screenshots = {};
  for (const action of ["stay", "follow", "feed", "name", "release"]) {
    const result = await act(page, petId, action);
    if (action === "stay" && (!result.stay || result.task !== "idle")) throw new Error(`stay changed: ${JSON.stringify(result)}`);
    if (action === "follow" && (result.stay || result.task !== "follow")) throw new Error(`follow changed: ${JSON.stringify(result)}`);
    if (action === "feed" && (result.loyaltyGain !== 12 || result.meat !== 0)) throw new Error(`feed changed: ${JSON.stringify(result)}`);
    if (action === "name" && result.name !== "Ember Paw") throw new Error(`name changed: ${JSON.stringify(result)}`);
    if (action === "release" && (result.ownerId !== null || result.task !== "wander")) throw new Error(`release changed: ${JSON.stringify(result)}`);
    await page.getByText(labels[action], { exact: true }).waitFor({ state: "visible" });
    const screenshot = path.join(outputDir, `${action}-${viewport.name}.png`);
    await page.screenshot({ path: screenshot });
    screenshots[action] = screenshot;
    await page.evaluate(() => { window.__ember.getWorld().hour += 1.12 / 36; });
  }
  if (consoleErrors.length || pageErrors.length) throw new Error(`${viewport.name}: ${JSON.stringify({ consoleErrors, pageErrors })}`);
  results.push({ viewport: viewport.name, screenshots, consoleErrors, pageErrors });
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ ok: true, results }, null, 2));
