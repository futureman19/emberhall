import { chromium } from "playwright";
import path from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputDir = process.argv[3] ?? "screenshots/npc-phase";
if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(baseUrl).hostname) && process.env.BROWSER_ALLOW_EXTERNAL_HOST !== "1") throw new Error("external NPC smoke requires BROWSER_ALLOW_EXTERNAL_HOST=1");

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

async function interact(page, action) {
  return page.evaluate((kind) => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    if (!player) throw new Error("NPC smoke needs player");
    world.hour = Math.max(world.hour, 12);
    world.weather.kind = "clear"; world.weather.cloud = 0; world.weather.wet = 0; world.weather.wind = 0; world.weather.untilHour = world.hour + 24;
    player.x = 256; player.z = 304; player.path = [];
    for (let z = 296; z <= 312; z += 1) for (let x = 248; x <= 264; x += 1) { const tile = world.tiles[z]?.[x]; if (tile?.kind === "tree") tile.kind = "grass"; }
    world.landRev += 1;
    world.people.filter((person) => !person.isPlayer).forEach((person, index) => { person.x = 235 + index; person.z = 285; person.path = []; });
    let target;
    if (kind === "talk" || kind === "bank") target = world.people.find((person) => person.role === "banker");
    if (kind === "heal") target = world.people.find((person) => person.role === "healer");
    if (kind === "trade") target = world.people.find((person) => person.role === "provisioner");
    if (kind === "recruit") target = world.people.find((person) => !person.isPlayer && !person.member && !person.role);
    if (!target) throw new Error(`missing ${kind} target`);
    target.x = 258; target.z = 304; target.path = [];
    const before = { gold: world.gold, hp: player.hp, member: target.member, bandage: world.player.pack.bandage ?? 0, vault: world.player.vault };
    if (kind === "talk") store.talk(target.id);
    if (kind === "heal") { player.hp = 1; store.talk(target.id); }
    if (kind === "trade") { world.gold = 500; store.buy("bandage"); }
    if (kind === "bank") { world.gold = 50; world.player.vault = 0; store.deposit(20); }
    if (kind === "recruit") { world.gold = 40; store.recruit(target.id); }
    world.hour += 0.44 / 36;
    return {
      targetId: target.id,
      hp: player.hp,
      maxHp: player.maxHp,
      bandageGain: (world.player.pack.bandage ?? 0) - before.bandage,
      vault: world.player.vault,
      gold: world.gold,
      member: target.member,
      toast: window.__ember.useGame.getState().toast,
    };
  }, action);
}

const labels = { talk: "SPEAKING", heal: "RESTORED", trade: "TRADING", bank: "BANKING", recruit: "RECRUITED" };
const browser = await chromium.launch({ headless: true });
const results = [];
for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport });
  const consoleErrors = []; const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await startGame(page);
  const screenshots = {};
  for (const action of ["talk", "heal", "trade", "bank", "recruit"]) {
    const result = await interact(page, action);
    if (action === "heal" && result.hp !== result.maxHp) throw new Error(`heal changed: ${JSON.stringify(result)}`);
    if (action === "trade" && result.bandageGain !== 1) throw new Error(`trade changed: ${JSON.stringify(result)}`);
    if (action === "bank" && (result.vault !== 20 || result.gold !== 30)) throw new Error(`bank changed: ${JSON.stringify(result)}`);
    if (action === "recruit" && !result.member) throw new Error(`recruit changed: ${JSON.stringify(result)}`);
    await page.getByText(labels[action], { exact: true }).waitFor({ state: "visible" });
    const screenshot = path.join(outputDir, `${action}-${viewport.name}.png`); await page.screenshot({ path: screenshot }); screenshots[action] = screenshot;
    await page.evaluate(() => { window.__ember.getWorld().hour += 1.12 / 36; });
  }
  if (consoleErrors.length || pageErrors.length) throw new Error(JSON.stringify({ consoleErrors, pageErrors }));
  results.push({ viewport: viewport.name, screenshots, consoleErrors, pageErrors });
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ ok: true, results }, null, 2));
