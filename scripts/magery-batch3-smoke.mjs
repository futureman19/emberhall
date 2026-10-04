import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
/**
 * Batch-three mechanics smoke: the eight new spells resolve through the real
 * renderer with zero console errors — leap, moongate party-travel, wind,
 * risen corpse, elemental, hare-shape, images, and the living-man's "still
 * bleed" for Resurrect (the ghost path is pinned by unit tests).
 *   node scripts/magery-batch3-smoke.mjs [baseUrl] [outputDir]
 */
const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputDir = process.argv[3] ?? "screenshots/magery-batch3";
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
    if (!self) throw new Error("batch3 smoke has no player");
    let clearing = null;
    for (let y = 16; y < world.tiles.length - 16 && !clearing; y += 1) {
      for (let x = 16; x < world.tiles[y].length - 24; x += 1) {
        const openRun = Array.from({ length: 12 }, (_, offset) => world.tiles[y]?.[x + offset]?.kind === "grass").every(Boolean);
        const awayFromBuildings = world.buildings.every((building) => Math.hypot(building.tx - x, building.ty - y) > 18);
        if (openRun && awayFromBuildings) { clearing = { x, y }; break; }
      }
    }
    if (!clearing) throw new Error("batch3 smoke found no open grass clearing");
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
      const beast = (id, dx, dz, task = "idle") => ({ id, kind: "wolf", x: p.x + dx, z: p.z + dz, hp: 500, maxHp: 500, path: [], task, taskUntil: w.hour + 99, corpseUntil: 0, home: { tx: p.x + dx, ty: p.z + dz }, ownerId: null, loyalty: 0, stay: false });
      const corpse = beast("b3-corpse", 3, 0);
      corpse.hp = 0;
      corpse.task = "dead";
      corpse.corpseUntil = w.hour + 8;
      const fighter = beast("b3-fighter", -3, 0, "fight");
      const poly = beast("b3-poly", 0, 3);
      w.fauna = [corpse, fighter, poly];
      Object.assign(w.player.pack, { spellbook: 1, pearl: 99, mandrake: 99, nightshade: 99, silk: 99, garlic: 99, ginseng: 99, ash: 99, moss: 99, rune: 4 });
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
        out.markCommand = commandCast(w, "mark");
        out.mark = castNow(w);
        out.marks = w.player.marks.length;
        // Step away from the mark so the gate has somewhere to take us.
        const home = { x: p.x, z: p.z };
        p.x = tx + 10; p.z = ty + 10; p.path = [];
        out.gateCommand = commandCast(w, "gate", { kind: "mark", id: w.player.marks[0].id });
        out.gate = castNow(w);
        out.gatedBack = Math.hypot(p.x - home.x, p.z - home.z) < 4;
        out.cool = w.player.gateCoolUntil > w.hour;
        out.jumpCommand = commandCast(w, "jump", { kind: "tile", tx: Math.round(p.x) + 4, ty: Math.round(p.z) });
        out.jump = castNow(w);
        out.flyCommand = commandCast(w, "fly", { kind: "self" });
        out.fly = castNow(w);
        out.aloft = w.player.flyUntil > w.hour;
        out.necroCommand = commandCast(w, "necromancy", { kind: "self" });
        out.necro = castNow(w);
        out.risen = w.fauna.find((c) => c.id === "b3-corpse")?.task ?? "gone";
        out.risenOwner = w.fauna.find((c) => c.id === "b3-corpse")?.ownerId === w.player.id;
        out.elementCommand = commandCast(w, "summonelemental", { kind: "self" });
        out.element = castNow(w);
        out.bound = w.fauna.filter((c) => c.ownerId === w.player.id && c.boundUntil > w.hour).length;
        out.mirrorCommand = commandCast(w, "mirrorimage", { kind: "self" });
        out.mirror = castNow(w);
        out.images = w.fauna.filter((c) => c.mirror).length;
        out.fighterCalmed = w.fauna.find((c) => c.id === "b3-fighter")?.task !== "fight";
        out.polyCommand = commandCast(w, "polymorph", { kind: "fauna", id: "b3-poly" });
        out.poly = castNow(w);
        out.shape = w.fauna.find((c) => c.id === "b3-poly")?.kind;
        out.rezCommand = commandCast(w, "resurrect", { kind: "self" });
        out.rez = castNow(w);
        // Let the renderer breathe so releases and the swarm of changes draw.
        store.speed(1);
        for (let i = 0; i < 4; i++) store.tick(0.01);
        store.speed(0);
      } finally {
        Math.random = r;
      }
      return out;
    });
    console.log(JSON.stringify({ domain }));
    for (const key of ["markCommand", "gateCommand", "jumpCommand", "flyCommand", "necroCommand", "elementCommand", "mirrorCommand", "polyCommand", "rezCommand"]) {
      assert.equal(domain[key], null, `${key} admitted`);
    }
    assert.equal(domain.marks, 1, "the rune holds a mark");
    assert.ok(domain.gatedBack, "the swirl takes you to the mark");
    assert.ok(domain.cool, "the swirl needs a breath");
    assert.ok(domain.aloft, "the wind holds you");
    assert.notEqual(domain.risen, "dead", "the corpse answers");
    assert.ok(domain.risenOwner, "risen and bound");
    // One binding at a time — the elemental's arrival loosened the risen wolf's.
    assert.equal(domain.bound, 1, "the newest binding holds, the old one loosens");
    assert.ok(domain.images >= 2, `the images stand (${domain.images})`);
    assert.ok(domain.fighterCalmed, "the pack loses you");
    assert.equal(domain.shape, "hare", "the wolf wears a hare's shape");
    assert.match(domain.rez, /still bleed/i, "the living need not apply");
    shots.push(await capture("mechanics"));
    assert.deepEqual(errors, [], `console errors: ${errors.join(" | ")}`);
    results.push({ viewport: viewport.name, ok: true, domain, shots: shots.filter(Boolean) });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({ ok: true, results }, null, 2));
