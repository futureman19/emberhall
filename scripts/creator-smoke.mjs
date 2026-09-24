#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const url = process.env.CREATOR_SMOKE_URL || "http://127.0.0.1:8080/";
const output = resolve(process.env.CREATOR_SMOKE_OUTPUT_DIR || "screenshots/creator-smoke");
mkdirSync(output, { recursive: true });

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

function qaUrl() {
  const next = new URL(url);
  next.searchParams.set("qa", "1");
  return next.toString();
}

async function enterFresh(page) {
  await page.goto(qaUrl(), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__ember?.useGame));
  await page.evaluate(() => window.__ember.useGame.getState().begin(true));
  await page.waitForFunction(() => window.__ember.getWorld().people.length > 0, undefined, { timeout: 30_000 });
  await page.waitForFunction(
    () => ["intro", "looking", "playing"].includes(window.__ember.useGame.getState().phase),
    undefined,
    { timeout: 30_000 },
  );
  await page.evaluate(() => window.__ember.useGame.setState({ phase: "playing", panel: "none" }));
}

const LODGE = [
  ["floor_timber", 270, 310, 0],
  ["wall_straight", 270, 312, 0],
  ["wall_window", 272, 308, 0],
  ["wall_doorway", 268, 308, 0],
  ["door_timber", 269, 308, 0],
  ["roof_slope", 274, 310, 0],
  ["bed_simple", 272, 310, 0],
  ["chest_keep", 273, 312, 0],
  ["bench_work", 268, 310, 0],
  ["hearth_stone", 268, 312, 0],
  ["sign_board", 267, 308, 0],
];

const verdict = { url, viewports: {}, ok: true };
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    console.log(`[${viewport.name}] enter`);
    await enterFresh(page);
    console.log(`[${viewport.name}] fixture`);

    const built = await page.evaluate(async (lodge) => {
      const commands = await import("/src/game/placeables/commands.ts");
      const history = await import("/src/game/placeables/history.ts");
      const functions = await import("/src/game/placeables/functions.ts");
      const player = await import("/src/game/player.ts");
      const save = await import("/src/game/save.ts");
      const world = window.__ember.getWorld();
      const self = world.people.find((p) => p.isPlayer) ?? world.people[0];
      if (!self) throw new Error("no body");
      world.player.ghost = false;
      world.player.pack.board = 80;
      world.player.pack.ingot = 20;
      const placed = [];
      for (const [id, tx, ty, rot] of lodge) {
        const err = history.withHistory(world, () => commands.placeObject(world, id, tx, ty, rot));
        if (err) throw new Error(`${id}: ${err}`);
        placed.push(world.placedObjects.at(-1).id);
      }
      const door = world.placedObjects.find((o) => o.definitionId === "door_timber");
      const chest = world.placedObjects.find((o) => o.definitionId === "chest_keep");
      const bed = world.placedObjects.find((o) => o.definitionId === "bed_simple");
      const sign = world.placedObjects.find((o) => o.definitionId === "sign_board");
      const floor = world.placedObjects.find((o) => o.definitionId === "floor_timber");
      const rotErr = history.withHistory(world, () => commands.rotateObject(world, floor.id, 1));
      const moveErr = history.withHistory(world, () => commands.moveObject(world, floor.id, 280, 310));
      const undoErr = history.undo(world);
      const redoErr = history.redo(world);
      self.x = door.tx;
      self.z = door.ty;
      const openDoor = functions.toggleDoor(world, door.id);
      self.hp = 10;
      self.x = bed.tx;
      self.z = bed.ty;
      const _rest = functions.restAtBed(world, bed.id);
      self.x = sign.tx;
      self.z = sign.ty;
      const signErr = functions.setSignText(world, sign.id, "Oakstand mill");
      const walkErr = player.commandWalk(world, 270, 310);
      window.__ember.useGame.getState().setPanel("build");
      window.__ember.useGame.getState().noteHold();
      const wrote = save.writeSave(world);
      world.player.pack.board = (world.player.pack.board ?? 0) + 2;
      self.x = chest.tx;
      self.z = chest.ty;
      const stow = functions.chestPut(world, chest.id, "board", 1);
      return {
        count: world.placedObjects.length,
        rotErr,
        moveErr,
        undoErr,
        redoErr,
        openDoor,
        restHp: self.hp,
        signErr,
        stow,
        walkErr,
        saved: wrote.ok,
        copyId: sign.id,
        placed: placed.length,
      };
    }, LODGE);

    await page.getByTestId("hold-panel").waitFor({ timeout: 15_000 });
    const screenshotOpen = resolve(output, `${viewport.name}-hold.png`);
    await page.screenshot({ path: screenshotOpen, fullPage: false });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.__ember?.useGame));
    await page.evaluate(() => window.__ember.useGame.getState().begin(false));
    await page.waitForFunction(() => window.__ember.useGame.getState().phase === "playing", undefined, { timeout: 30_000 });
    const restored = await page.evaluate(() => {
      const world = window.__ember.getWorld();
      return {
        count: world.placedObjects.length,
        sign: world.placedObjects.find((o) => o.definitionId === "sign_board")?.name,
      };
    });
    await page.evaluate(() => window.__ember.useGame.getState().setPanel("build"));
    await page.getByTestId("hold-panel").waitFor({ timeout: 15_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    const screenshot = resolve(output, `${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    const passed =
      built.placed === LODGE.length &&
      built.saved &&
      built.openDoor === null &&
      built.restHp > 10 &&
      built.stow === null &&
      restored.count >= LODGE.length &&
      restored.sign === "Oakstand mill" &&
      !overflow &&
      errors.length === 0;
    verdict.viewports[viewport.name] = { passed, built, restored, overflow, errors, screenshot, screenshotOpen };
    if (!passed) verdict.ok = false;
    await page.close();
  }
} finally {
  await browser.close();
}

writeFileSync(resolve(output, "verdict.json"), JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
if (!verdict.ok) process.exitCode = 1;
