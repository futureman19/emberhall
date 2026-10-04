import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
/**
 * Batch-one spellbook smoke: the new spells release through the real renderer
 * (fx profiles, ground rings, status seals) with zero console errors. Domain
 * casts ride the same commandCast/castNow boundary as spell-phase1-smoke.
 *   node scripts/magery-batch1-smoke.mjs [baseUrl] [outputDir]
 */
const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputDir = process.argv[3] ?? "screenshots/magery-batch1";
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
    if (!self) throw new Error("batch1 smoke has no player");
    let clearing = null;
    for (let y = 16; y < world.tiles.length - 16 && !clearing; y += 1) {
      for (let x = 16; x < world.tiles[y].length - 24; x += 1) {
        const openRun = Array.from({ length: 12 }, (_, offset) => world.tiles[y]?.[x + offset]?.kind === "grass").every(Boolean);
        const awayFromBuildings = world.buildings.every((building) => Math.hypot(building.tx - x, building.ty - y) > 18);
        if (openRun && awayFromBuildings) { clearing = { x, y }; break; }
      }
    }
    if (!clearing) throw new Error("batch1 smoke found no open grass clearing");
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
      w.fauna = [beast("b1-ring", 2, 0), beast("b1-arc", 6, 0), beast("b1-sleep", -3, 0)];
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
      const { commandCast, castNow, spellEffects, visitSpellStatuses } = window.__ember.spells;
      const w = window.__ember.getWorld();
      const p = w.people.find((person) => person.isPlayer);
      const r = Math.random;
      Math.random = () => 0;
      const out = {};
      try {
        out.fireblastCommand = commandCast(w, "fireblast", { kind: "tile", tx: Math.round(p.x) + 2, ty: Math.round(p.z) });
        out.fireblast = castNow(w);
        out.ringHp = w.fauna.find((c) => c.id === "b1-ring").hp;
        out.arcHpAfterBlast = w.fauna.find((c) => c.id === "b1-arc").hp;
        out.chainCommand = commandCast(w, "chainlightning", { kind: "fauna", id: "b1-arc" });
        out.chain = castNow(w);
        out.arcHp = w.fauna.find((c) => c.id === "b1-arc").hp;
        out.sleepCommand = commandCast(w, "sleep", { kind: "fauna", id: "b1-sleep" });
        out.sleep = castNow(w);
        out.slept = w.fauna.find((c) => c.id === "b1-sleep").sleptUntil > w.hour;
        out.snareCommand = commandCast(w, "thornsnare", { kind: "fauna", id: "b1-ring" });
        out.snare = castNow(w);
        out.snared = w.fauna.find((c) => c.id === "b1-ring").snareUntil > w.hour;
        out.ironCommand = commandCast(w, "ironwood", { kind: "self" });
        out.iron = castNow(w);
        out.barked = w.player.ironwoodUntil > w.hour;
        out.flashCommand = commandCast(w, "flash", { kind: "self" });
        out.flash = castNow(w);
        out.blind = w.fauna.filter((c) => c.blindUntil > w.hour).length;
        out.effects = spellEffects(w).length;
        let statuses = 0;
        visitSpellStatuses(w, () => { statuses += 1; });
        out.statuses = statuses;
      } finally {
        Math.random = r;
      }
      return out;
    });
    console.log(JSON.stringify({ domain }));
    for (const key of ["fireblastCommand", "chainCommand", "sleepCommand", "snareCommand", "ironCommand", "flashCommand"]) {
      assert.equal(domain[key], null, `${key} admitted`);
    }
    assert.ok(domain.ringHp < 500, "the ring burns");
    assert.equal(domain.arcHpAfterBlast, 500, "the ring spares what stands outside");
    assert.ok(domain.arcHp < 500, "the bolt arcs");
    assert.ok(domain.slept, "the beast drifts off");
    assert.ok(domain.snared, "the thorns hold");
    assert.ok(domain.barked, "the bark holds");
    assert.equal(domain.blind, 3, "the burst blinds every beast near");
    assert.ok(domain.effects >= 5, `releases on the board (${domain.effects})`);
    assert.ok(domain.statuses >= 4, `status seals on the board (${domain.statuses})`);
    shots.push(await capture("releases"));
    shots.push(await capture("statuses"));
    assert.deepEqual(errors, [], `console errors: ${errors.join(" | ")}`);
    results.push({ viewport: viewport.name, ok: true, domain, shots: shots.filter(Boolean) });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({ ok: true, results }, null, 2));
