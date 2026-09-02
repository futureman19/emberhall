import { chromium } from "playwright";
import path from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputDir = process.argv[3] ?? "screenshots/corpse-phase";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?/.test(baseUrl) && process.env.BROWSER_ALLOW_EXTERNAL_HOST !== "1") {
  throw new Error("external browser target blocked; set BROWSER_ALLOW_EXTERNAL_HOST=1 intentionally");
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

async function trigger(page, kind) {
  return page.evaluate((mode) => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    if (!player) throw new Error("corpse smoke needs a player");
    player.x = 256;
    player.z = 302;
    player.facing = Math.PI / 2;
    world.weather.kind = "clear";
    world.weather.cloud = 0;
    world.weather.wet = 0;
    world.weather.wind = 0;
    world.weather.untilHour = world.hour + 24;
    for (let z = 294; z <= 310; z += 1) {
      for (let x = 248; x <= 264; x += 1) {
        const tile = world.tiles[z]?.[x];
        if (tile?.kind === "tree") tile.kind = "grass";
      }
    }
    world.landRev += 1;
    player.path = [];
    world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
    world.player.workT = 0;
    store.speed(0);
    const tx = Math.round(player.x + 1);
    const ty = Math.round(player.z);
    if (mode === "skinning") {
      let corpse = world.fauna.find((creature) => creature.kind === "hare") ?? world.fauna[0];
      if (!corpse) throw new Error("corpse smoke needs fauna");
      corpse.x = tx;
      corpse.z = ty;
      corpse.hp = 0;
      corpse.task = "dead";
      corpse.corpseUntil = world.hour + 8;
      corpse.path = [];
      corpse.ownerId = null;
      world.player.wear.main = "knife";
      const before = { hide: world.player.pack.hide ?? 0, meat: world.player.pack.meat ?? 0 };
      store.doVerb("skin", { kind: "fauna", id: corpse.id, tx, ty, label: "hare" });
      store.speed(1);
      for (let index = 0; index < 14; index += 1) store.tick(0.05);
      store.speed(0);
      world.hour += 0.25 / 36;
      return {
        intent: world.player.intent.kind,
        targetId: corpse.id,
        gainedHide: (world.player.pack.hide ?? 0) - before.hide,
        gainedMeat: (world.player.pack.meat ?? 0) - before.meat,
        corpseGone: !world.fauna.some((entry) => entry.id === corpse.id),
      };
    }
    const pile = {
      id: `corpse-smoke-${Date.now()}`,
      tx,
      ty,
      items: { rabbit_foot: 1 },
      gold: 3,
      until: world.hour + 8,
      source: "corpse",
      label: "hare corpse",
    };
    world.piles.push(pile);
    const before = { foot: world.player.pack.rabbit_foot ?? 0, gold: world.gold };
    store.doVerb("loot", { kind: "pile", id: pile.id, tx, ty, label: pile.label });
    world.hour += 0.42 / 36;
    return {
      gainedFoot: (world.player.pack.rabbit_foot ?? 0) - before.foot,
      gainedGold: world.gold - before.gold,
      pileGone: !world.piles.some((entry) => entry.id === pile.id),
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

  const skin = await trigger(page, "skinning");
  if (skin.intent !== "none" || skin.gainedHide !== 1 || skin.gainedMeat !== 1 || !skin.corpseGone) {
    throw new Error(`skinning mechanics changed: ${JSON.stringify(skin)}`);
  }
  await page.getByText("BLADE · SKINNING", { exact: true }).waitFor({ state: "visible" });
  const skinning = path.join(outputDir, `skinning-${viewport.name}.png`);
  await page.screenshot({ path: skinning });

  await page.evaluate(() => {
    const world = window.__ember.getWorld();
    world.hour += 1.2 / 36;
    world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
    world.player.workT = 0;
  });
  const loot = await trigger(page, "looting");
  if (loot.gainedFoot !== 1 || loot.gainedGold !== 3 || !loot.pileGone) throw new Error(`loot mechanics changed: ${JSON.stringify(loot)}`);
  await page.getByText("SACK · LOOTING", { exact: true }).waitFor({ state: "visible" });
  const looting = path.join(outputDir, `looting-${viewport.name}.png`);
  await page.screenshot({ path: looting });

  if (consoleErrors.length || pageErrors.length) throw new Error(JSON.stringify({ consoleErrors, pageErrors }));
  results.push({ viewport: viewport.name, screenshots: { skinning, looting }, consoleErrors, pageErrors });
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ ok: true, results }, null, 2));
