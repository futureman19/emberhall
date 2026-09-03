import { chromium } from "playwright";
import path from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputDir = process.argv[3] ?? "screenshots/personal-actions";
if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(baseUrl).hostname) && process.env.BROWSER_ALLOW_EXTERNAL_HOST !== "1") {
  throw new Error("external personal-action smoke requires BROWSER_ALLOW_EXTERNAL_HOST=1");
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
  await page.evaluate(() => { const store = window.__ember.useGame.getState(); store.speed(0); if (store.panel !== "none") store.setPanel("none"); });
}

async function prepare(page) {
  await page.evaluate(() => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    if (!player) throw new Error("personal-action smoke needs a player");
    world.hour = 12;
    world.weather.kind = "clear"; world.weather.cloud = 0; world.weather.wet = 0; world.weather.wind = 0; world.weather.untilHour = 36;
    player.x = 324; player.z = 340; player.path = [];
    world.piles = world.piles.filter((pile) => pile.source !== "drop");
    for (let z = 330; z <= 350; z += 1) for (let x = 314; x <= 334; x += 1) { const tile = world.tiles[z]?.[x]; if (tile) tile.kind = "grass"; }
    world.landRev += 1;
    world.buildings = world.buildings.filter((building) => building.id !== "phase-13-house");
    store.setPanel("none");
  });
}

async function act(page, action) {
  return page.evaluate((kind) => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    let house = world.buildings.find((building) => building.id === "phase-13-house");
    if (!player) throw new Error("personal-action fixture disappeared");
    if (kind === "eat") { player.hunger = 45; world.player.pack.bread = 1; store.eat(); }
    if (kind === "equip") { world.player.pack.sword = 1; store.equip("sword"); }
    if (kind === "stow") store.unequip("main");
    if (kind === "drop") { world.player.pack.cabbage = 1; store.drop("cabbage"); }
    if (kind === "pickup") {
      const pile = world.piles.find((entry) => entry.source === "drop" && (entry.items.cabbage ?? 0) > 0);
      if (!pile) throw new Error("drop did not make a sack");
      store.takePile(pile.id, "cabbage");
    }
    if (kind === "chestIn") {
      house = { id: "phase-13-house", kind: "porch", tx: 327, ty: 340, beds: [], ownerId: world.player.id, chest: {}, chestGold: 0 };
      world.buildings.push(house);
      world.player.pack.board = 2;
      window.__ember.useGame.setState({ openHouseId: house.id });
      store.houseItem("board", 2);
    }
    if (kind === "chestOut") { if (!house) throw new Error("house missing"); window.__ember.useGame.setState({ openHouseId: house.id }); store.houseTake("board", 1); }
    world.hour += 0.48 / 36;
    return {
      hunger: player.hunger,
      bread: world.player.pack.bread ?? 0,
      worn: world.player.wear.main ?? null,
      sword: world.player.pack.sword ?? 0,
      cabbage: world.player.pack.cabbage ?? 0,
      dropCount: world.piles.filter((entry) => entry.source === "drop").length,
      boardPack: world.player.pack.board ?? 0,
      boardChest: house?.chest?.board ?? 0,
    };
  }, action);
}

const labels = {
  eat: "EAT · BREAD",
  equip: "EQUIP · SWORD",
  stow: "STOW · SWORD",
  drop: "DROP · CABBAGE",
  pickup: "PICKUP · CABBAGE",
  chestIn: "CHEST IN · BOARD",
  chestOut: "CHEST OUT · BOARD",
};
const browser = await chromium.launch({ headless: true });
const results = [];
for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport });
  const consoleErrors = []; const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await startGame(page);
  await prepare(page);
  const screenshots = {};
  for (const action of Object.keys(labels)) {
    const state = await act(page, action);
    if (action === "eat" && (state.hunger !== 77 || state.bread !== 0)) throw new Error(`${viewport.name}: eat changed ${JSON.stringify(state)}`);
    if (action === "equip" && (state.worn !== "sword" || state.sword !== 0)) throw new Error(`${viewport.name}: equip changed ${JSON.stringify(state)}`);
    if (action === "stow" && (state.worn !== null || state.sword !== 1)) throw new Error(`${viewport.name}: stow changed ${JSON.stringify(state)}`);
    if (action === "drop" && (state.cabbage !== 0 || state.dropCount !== 1)) throw new Error(`${viewport.name}: drop changed ${JSON.stringify(state)}`);
    if (action === "pickup" && (state.cabbage !== 1 || state.dropCount !== 0)) throw new Error(`${viewport.name}: pickup changed ${JSON.stringify(state)}`);
    if (action === "chestIn" && (state.boardPack !== 0 || state.boardChest !== 2)) throw new Error(`${viewport.name}: chest in changed ${JSON.stringify(state)}`);
    if (action === "chestOut" && (state.boardPack !== 1 || state.boardChest !== 1)) throw new Error(`${viewport.name}: chest out changed ${JSON.stringify(state)}`);
    if (action === "chestIn" || action === "chestOut") {
      const transfer = page.locator('[data-testid="house-transfer-fx"]');
      await transfer.waitFor({ state: "visible" });
      const transferText = (await transfer.innerText()).replace(/\s+/g, " ");
      if (!transferText.includes("PACK") || !transferText.includes("BOARD") || !transferText.includes("CHEST")) throw new Error(`${viewport.name}: chest transfer cue incomplete: ${transferText}`);
    } else {
      await page.getByText(labels[action], { exact: true }).waitFor({ state: "visible" });
    }
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
