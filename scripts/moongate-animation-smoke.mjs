import { chromium } from "playwright";
import path from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputDir = process.argv[3] ?? "screenshots/moongate-phase";
if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(baseUrl).hostname) && process.env.BROWSER_ALLOW_EXTERNAL_HOST !== "1") throw new Error("external moongate smoke requires BROWSER_ALLOW_EXTERNAL_HOST=1");

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

async function travel(page) {
  return page.evaluate(() => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    if (!player || world.fauna.length < 2) throw new Error("moongate smoke needs player and companions");
    const source = { id: "emberhall", tx: 261, ty: 304 };
    const destination = { id: "millcross", tx: 102, ty: 306 };
    world.hour = 12;
    world.weather.kind = "clear"; world.weather.cloud = 0; world.weather.wet = 0; world.weather.wind = 0; world.weather.untilHour = world.hour + 24;
    for (const center of [source, destination]) for (let z = center.ty - 8; z <= center.ty + 8; z += 1) for (let x = center.tx - 8; x <= center.tx + 8; x += 1) { const tile = world.tiles[z]?.[x]; if (tile?.kind === "tree") tile.kind = "grass"; }
    world.landRev += 1;
    player.x = source.tx; player.z = source.ty; player.path = [];
    const following = world.fauna[0]; const staying = world.fauna[1];
    following.ownerId = world.player.id; following.stay = false; following.task = "follow"; following.path = [];
    staying.ownerId = world.player.id; staying.stay = true; staying.task = "idle"; staying.path = [];
    const stayedAt = { x: staying.x, z: staying.z };
    const random = Math.random; Math.random = () => 0.75;
    try { store.travel(destination.id); } finally { Math.random = random; }
    const arrival = { x: player.x, z: player.z };
    const mechanics = {
      moved: Math.hypot(player.x - destination.tx, player.z - (destination.ty + 2)) < 6,
      followingMoved: Math.hypot(following.x - player.x, following.z - player.z) <= 1.2,
      stayingStayed: staying.x === stayedAt.x && staying.z === stayedAt.z,
      cooldown: world.player.gateCoolUntil > world.hour,
    };
    player.x = source.tx; player.z = source.ty;
    world.hour += 0.2 / 36;
    return { source, arrival, mechanics };
  });
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport });
  const consoleErrors = []; const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await startGame(page);
  const result = await travel(page);
  if (!Object.values(result.mechanics).every(Boolean)) throw new Error(`${viewport.name}: travel changed ${JSON.stringify(result)}`);
  await page.waitForTimeout(650);
  const departure = path.join(outputDir, `departure-${viewport.name}.png`); await page.screenshot({ path: departure });
  await page.evaluate(({ x, z }) => { const world = window.__ember.getWorld(); const player = world.people.find((person) => person.isPlayer); player.x = x; player.z = z; world.hour += 0.38 / 36; }, result.arrival);
  await page.waitForTimeout(650);
  await page.getByText("MOONGATE · MILLCROSS", { exact: true }).waitFor({ state: "visible" });
  const arrival = path.join(outputDir, `arrival-${viewport.name}.png`); await page.screenshot({ path: arrival });
  if (consoleErrors.length || pageErrors.length) throw new Error(JSON.stringify({ consoleErrors, pageErrors }));
  results.push({ viewport: viewport.name, screenshots: { departure, arrival }, consoleErrors, pageErrors });
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ ok: true, results }, null, 2));
