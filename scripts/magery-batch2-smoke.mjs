import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
/**
 * Batch-two ground-zone smoke: the six workings raise through the real
 * renderer (zone rings on the ground, release fx) with zero console errors,
 * and the sim's tickZones path fires the wall's teeth and the quake's pulses.
 *   node scripts/magery-batch2-smoke.mjs [baseUrl] [outputDir]
 */
const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputDir = process.argv[3] ?? "screenshots/magery-batch2";
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function startGame(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__ember));
  await page.getByRole("button", { name: "New hall" }).click();
  await page.waitForFunction(() => window.__ember?.useGame.getState().phase === "intro");
  await page.evaluate(() => window.__ember.useGame.getState().introDone());
  await page.locator('[data-testid="look-next"]').evaluate((element) => element.click());
  await page.waitForFunction(() => document.body.innerText.includes("A calling"));
  await page.locator('[data-testid="look-next"]').evaluate((element) => element.click());
  await page.waitForSelector('[data-testid="look-done"]');
  await page.locator('[data-testid="look-done"]').evaluate((element) => element.click());
  await page.waitForFunction(() => window.__ember?.useGame.getState().phase === "playing");
  await page.evaluate(() => {
    const store = window.__ember.useGame.getState();
    store.speed(0);
    if (store.panel !== "none") store.setPanel("none");
    const world = window.__ember.getWorld();
    const self = world.people.find((person) => person.isPlayer);
    if (!self) throw new Error("batch2 smoke has no player");
    let clearing = null;
    for (let y = 16; y < world.tiles.length - 16 && !clearing; y += 1) {
      for (let x = 16; x < world.tiles[y].length - 24; x += 1) {
        const openRun = Array.from({ length: 12 }, (_, offset) => world.tiles[y]?.[x + offset]?.kind === "grass").every(Boolean);
        const awayFromBuildings = world.buildings.every((building) => Math.hypot(building.tx - x, building.ty - y) > 18);
        if (openRun && awayFromBuildings) { clearing = { x, y }; break; }
      }
    }
    if (!clearing) throw new Error("batch2 smoke found no open grass clearing");
    for (let y = clearing.y - 12; y <= clearing.y + 12; y += 1) {
      for (let x = clearing.x - 12; x <= clearing.x + 20; x += 1) {
        const tile = world.tiles[y]?.[x];
        if (tile) tile.kind = "grass";
      }
    }
    world.landRev += 1;
    self.x = clearing.x;
    self.z = clearing.y;
    self.path = [];
    store.speed(1);
    store.tick(0.01);
    store.speed(0);
  });
  await page.waitForTimeout(500);
}

const results = [];
try {
  for (const viewport of [{ name: "desktop", width: 1440, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.setDefaultTimeout(120000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await startGame(page);
    await page.evaluate(() => {
      const w = window.__ember.getWorld();
      const p = w.people.find((person) => person.isPlayer);
      const beast = (id, dx, dz) => ({ id, kind: "wolf", x: p.x + dx, z: p.z + dz, hp: 500, maxHp: 500, path: [], task: "idle", taskUntil: w.hour + 99, corpseUntil: 0, home: { tx: p.x + dx, ty: p.z + dz }, ownerId: null, loyalty: 0, stay: false });
      w.fauna = [beast("b2-fire", 2, 0), beast("b2-quake", 0, 4), beast("b2-fury", -4, 0)];
      Object.assign(w.player.pack, { spellbook: 1, pearl: 99, mandrake: 99, nightshade: 99, silk: 99, garlic: 99, ginseng: 99, ash: 99, moss: 99 });
      w.player.skills.magery = 100;
      w.player.mana = 999;
    });
    const shots = [];
    const capture = async (name) => {
      await page.waitForTimeout(150);
      const file = `${outputDir}/${viewport.name}-${name}.png`;
      await page.screenshot({ path: file, timeout: 60000 });
      console.log(`Captured ${file}`);
      return file;
    };
    const domain = await page.evaluate(() => {
      const { commandCast, castNow } = window.__ember.spells;
      const store = window.__ember.useGame.getState();
      const w = window.__ember.getWorld();
      const p = w.people.find((person) => person.isPlayer);
      const tx = Math.round(p.x), ty = Math.round(p.z);
      const r = Math.random;
      Math.random = () => 0;
      const out = {};
      try {
        out.flameCommand = commandCast(w, "flamewall", { kind: "tile", tx: tx + 2, ty });
        out.flame = castNow(w);
        out.stoneCommand = commandCast(w, "stonewall", { kind: "tile", tx, ty: ty - 3 });
        out.stone = castNow(w);
        out.sanctCommand = commandCast(w, "sanctuary", { kind: "tile", tx, ty });
        out.sanct = castNow(w);
        out.quakeCommand = commandCast(w, "earthquake", { kind: "tile", tx, ty: ty + 4 });
        out.quake = castNow(w);
        out.furyCommand = commandCast(w, "naturesfury", { kind: "tile", tx: tx - 4, ty });
        out.fury = castNow(w);
        out.tarCommand = commandCast(w, "tarpit", { kind: "tile", tx: tx + 4, ty: ty + 4 });
        out.tar = castNow(w);
        out.zoneCount = w.zones.length;
        out.fireHpBefore = w.fauna.find((c) => c.id === "b2-fire").hp;
        out.quakeHpBefore = w.fauna.find((c) => c.id === "b2-quake").hp;
        out.furyHpBefore = w.fauna.find((c) => c.id === "b2-fury").hp;
        // Let the workings breathe (+0.2h): the wall bites twice, the fault
        // fires all three shakes and crumbles, the longer workings still stand.
        store.speed(1);
        for (let i = 0; i < 4; i++) {
          w.hour += 0.05;
          store.tick(0.01);
        }
        store.speed(0);
        out.fireHp = w.fauna.find((c) => c.id === "b2-fire").hp;
        out.quakeHp = w.fauna.find((c) => c.id === "b2-quake").hp;
        out.furyHp = w.fauna.find((c) => c.id === "b2-fury").hp;
        out.quakeSpent = !w.zones.some((z) => z.kind === "earthquake");
        out.stoneStands = w.zones.some((z) => z.kind === "stonewall");
        out.zonesAfter = w.zones.length;
      } finally {
        Math.random = r;
      }
      return out;
    });
    console.log(JSON.stringify({ domain }));
    for (const key of ["flameCommand", "stoneCommand", "sanctCommand", "quakeCommand", "furyCommand", "tarCommand"]) {
      assert.equal(domain[key], null, `${key} admitted`);
    }
    assert.equal(domain.zoneCount, 6, `all six workings stand (${domain.zoneCount})`);
    assert.ok(domain.fireHp < domain.fireHpBefore, "the wall keeps its teeth");
    assert.ok(domain.quakeHp < domain.quakeHpBefore, "the quake shakes the ring");
    assert.ok(domain.furyHp < domain.furyHpBefore, "the swarm harries");
    assert.ok(domain.quakeSpent, "the fault spends itself and crumbles");
    assert.ok(domain.stoneStands, "the stone still stands");
    shots.push(await capture("workings"));
    assert.deepEqual(errors, [], `console errors: ${errors.join(" | ")}`);
    results.push({ viewport: viewport.name, ok: true, domain, shots: shots.filter(Boolean) });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({ ok: true, results }, null, 2));
