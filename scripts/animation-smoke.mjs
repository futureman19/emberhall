import { chromium } from "playwright";
import path from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputDir = process.argv[3] ?? "screenshots";
const external = !new URL(baseUrl).hostname.match(/^(127\.0\.0\.1|localhost)$/);
if (external && process.env.BROWSER_ALLOW_EXTERNAL_HOST !== "1") {
  throw new Error("external animation smoke requires BROWSER_ALLOW_EXTERNAL_HOST=1");
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
    const world = window.__ember.getWorld();
    const self = world.people.find((person) => person.isPlayer);
    if (!self) throw new Error("animation smoke has no player");
    let clearing = null;
    for (let y = 16; y < world.tiles.length - 16 && !clearing; y += 1) {
      for (let x = 16; x < world.tiles[y].length - 24; x += 1) {
        const openRun = Array.from(
          { length: 12 },
          (_, offset) => world.tiles[y]?.[x + offset]?.kind === "grass",
        ).every(Boolean);
        const awayFromBuildings = world.buildings.every(
          (building) => Math.hypot(building.tx - x, building.ty - y) > 18,
        );
        if (openRun && awayFromBuildings) {
          clearing = { x, y };
          break;
        }
      }
    }
    if (!clearing) throw new Error("animation smoke found no open grass clearing");
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

async function setCombat(page, weapon, range) {
  return page.evaluate(
    ({ weapon, range }) => {
      const world = window.__ember.getWorld();
      const store = window.__ember.useGame.getState();
      const self = world.people.find((person) => person.isPlayer);
      const target = world.fauna.find((creature) => !creature.ownerId);
      if (!self || !target) throw new Error("combat smoke needs a player and a wild creature");
      self.path = [];
      self.hp = self.maxHp;
      world.player.wear.main = weapon;
      world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
      world.player.workT = 0;
      target.x = self.x + range;
      target.z = self.z;
      target.hp = Math.max(999, target.maxHp);
      target.task = "idle";
      target.path = [];
      store.hunt(target.id);
      return { targetId: target.id, hp: target.hp };
    },
    { weapon, range },
  );
}

async function tick(page, seconds) {
  await page.evaluate((dt) => {
    const store = window.__ember.useGame.getState();
    store.speed(1);
    let remaining = dt;
    while (remaining > 0) {
      const step = Math.min(0.05, remaining);
      store.tick(step);
      remaining -= step;
    }
    store.speed(0);
  }, seconds);
  await page.waitForTimeout(80);
}

async function castProjectile(page, spell) {
  return page.evaluate((spellId) => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const self = world.people.find((person) => person.isPlayer);
    const target = world.fauna.find((creature) => !creature.ownerId);
    if (!self || !target) throw new Error("spell smoke needs a player and a wild creature");
    self.path = [];
    target.x = self.x + 7;
    target.z = self.z;
    target.hp = 999;
    target.task = "idle";
    target.path = [];
    world.player.pack.spellbook = 1;
    world.player.pack.pearl = 20;
    world.player.pack.mandrake = 20;
    world.player.mana = 999;
    world.player.skills.magery = 100;
    world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
    world.player.workT = 0;
    store.cast(spellId, { kind: "fauna", id: target.id });
    const random = Math.random;
    Math.random = () => 0;
    try {
      store.speed(1);
      for (let elapsed = 0; elapsed < 0.93; elapsed += 0.05)
        store.tick(Math.min(0.05, 0.93 - elapsed));
      store.speed(0);
    } finally {
      Math.random = random;
    }
    world.hour += 0.3 / 36;
    return { targetId: target.id, hp: target.hp };
  }, spell);
}

async function castTravel(page, spell) {
  return page.evaluate((spellId) => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const self = world.people.find((person) => person.isPlayer);
    if (!self) throw new Error("travel smoke needs a player");
    world.player.pack.spellbook = 1;
    world.player.pack.pearl = 20;
    world.player.pack.moss = 20;
    world.player.pack.mandrake = 20;
    world.player.mana = 999;
    world.player.skills.magery = 100;
    world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
    world.player.workT = 0;
    const from = { x: self.x, z: self.z };
    if (spellId === "teleport") {
      store.cast("teleport", { kind: "tile", tx: Math.round(self.x + 5), ty: Math.round(self.z) });
    } else {
      const mark = {
        id: "animation-recall",
        tx: Math.round(self.x - 5),
        ty: Math.round(self.z),
        name: "Animation clearing",
      };
      world.player.marks = [mark];
      store.cast("recall", { kind: "mark", id: mark.id });
    }
    const random = Math.random;
    Math.random = () => 0;
    try {
      store.speed(1);
      for (let elapsed = 0; elapsed < 0.93; elapsed += 0.05)
        store.tick(Math.min(0.05, 0.93 - elapsed));
      store.speed(0);
    } finally {
      Math.random = random;
    }
    world.hour += 0.24 / 36;
    return { from, to: { x: self.x, z: self.z } };
  }, spell);
}

async function castFizzle(page) {
  return page.evaluate(() => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    world.player.pack.spellbook = 1;
    world.player.pack.silk = 20;
    world.player.pack.ash = 20;
    world.player.mana = 999;
    world.player.skills.magery = 0;
    world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
    world.player.workT = 0;
    store.cast("nightsight", { kind: "self" });
    const random = Math.random;
    Math.random = () => 0.999;
    try {
      store.speed(1);
      for (let elapsed = 0; elapsed < 0.93; elapsed += 0.05)
        store.tick(Math.min(0.05, 0.93 - elapsed));
      store.speed(0);
    } finally {
      Math.random = random;
    }
    world.hour += 0.16 / 36;
    return window.__ember.useGame.getState().toast;
  });
}

async function runBandage(page) {
  return page.evaluate(() => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const patient = world.people.find((person) => person.isPlayer);
    if (!patient) throw new Error("healing smoke needs a patient");
    world.hour += 0.7 / 36;
    patient.hp = 8;
    world.player.pack.bandage = 3;
    world.player.skills.healing = 20;
    const before = { hp: patient.hp, bandages: world.player.pack.bandage };
    store.heal();
    world.hour += 0.4 / 36;
    return {
      before,
      after: { hp: patient.hp, bandages: world.player.pack.bandage },
      toast: window.__ember.useGame.getState().toast,
    };
  });
}

async function startTaming(page, skill) {
  return page.evaluate((skillValue) => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    const target = world.fauna.find((creature) => creature.kind === "hare") ?? world.fauna[0];
    if (!player || !target) throw new Error("taming smoke needs a player and animal");
    world.hour += 1 / 36;
    player.path = [];
    target.x = player.x + 1;
    target.z = player.z;
    target.path = [];
    target.task = "idle";
    target.ownerId = null;
    target.loyalty = 0;
    world.player.skills.taming = skillValue;
    world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
    world.player.workT = 0;
    store.doVerb("tame", {
      kind: "fauna",
      id: target.id,
      tx: Math.round(target.x),
      ty: Math.round(target.z),
      label: "animal",
    });
    store.speed(1);
    for (let elapsed = 0; elapsed < 0.28; elapsed += 0.04)
      store.tick(Math.min(0.04, 0.28 - elapsed));
    store.speed(0);
    return { targetId: target.id };
  }, skill);
}

async function finishTaming(page, targetId, success) {
  return page.evaluate(
    ({ id, shouldSucceed }) => {
      const world = window.__ember.getWorld();
      const store = window.__ember.useGame.getState();
      const random = Math.random;
      Math.random = () => (shouldSucceed ? 0 : 0.999);
      try {
        store.speed(1);
        for (let elapsed = 0; elapsed < 0.3; elapsed += 0.04)
          store.tick(Math.min(0.04, 0.3 - elapsed));
        store.speed(0);
      } finally {
        Math.random = random;
      }
      world.hour += 0.24 / 36;
      const target = world.fauna.find((creature) => creature.id === id);
      return { ownerId: target?.ownerId ?? null, task: target?.task ?? null };
    },
    { id: targetId, shouldSucceed: success },
  );
}

async function runCrafting(page, kind) {
  return page.evaluate((craftKind) => {
    const world = window.__ember.getWorld();
    const store = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    if (!player) throw new Error("crafting smoke needs a player");
    world.hour += 2 / 36;
    player.path = [];
    if (craftKind === "carpentry") {
      const yard = world.buildings.find((building) => building.kind === "yard");
      if (!yard) throw new Error("crafting smoke needs a yard");
      player.x = yard.tx; player.z = yard.ty; world.player.skills.carpentry = 100; world.player.pack.log = 1;
      store.makeRecipe("board");
    } else if (craftKind === "smithing") {
      const forge = world.buildings.find((building) => building.kind === "forge");
      if (!forge) throw new Error("crafting smoke needs a forge");
      player.x = forge.tx; player.z = forge.ty; world.player.skills.smithing = 100; world.player.pack.ore = 1;
      store.makeRecipe("smelt");
    } else {
      world.campfires = []; world.player.skills.cooking = 100; world.player.pack.log = 3;
      store.makeRecipe("campfire");
    }
    world.hour += 0.45 / 36;
    return window.__ember.useGame.getState().toast;
  }, kind);
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await startGame(page);

  const melee = await setCombat(page, "sword", 1);
  await tick(page, 0.28);
  const meleeWindup = path.join(outputDir, `animation-melee-windup-${viewport.name}.png`);
  await page.screenshot({ path: meleeWindup });
  await tick(page, 0.3);
  const meleeAfter = await page.evaluate(
    (id) => window.__ember.getWorld().fauna.find((creature) => creature.id === id)?.hp,
    melee.targetId,
  );
  const meleeImpact = path.join(outputDir, `animation-melee-impact-${viewport.name}.png`);
  await page.screenshot({ path: meleeImpact });
  if (!(typeof meleeAfter === "number" && meleeAfter < melee.hp))
    throw new Error(`${viewport.name}: melee did not land`);

  const bow = await setCombat(page, "bow", 7);
  await tick(page, 0.3);
  const bowDraw = path.join(outputDir, `animation-bow-draw-${viewport.name}.png`);
  await page.screenshot({ path: bowDraw });
  await tick(page, 0.3);
  await page.evaluate(() => {
    window.__ember.getWorld().hour += 0.005;
  });
  await page.waitForTimeout(80);
  const arrowFlight = path.join(outputDir, `animation-arrow-flight-${viewport.name}.png`);
  await page.screenshot({ path: arrowFlight });
  const bowAfter = await page.evaluate(
    (id) => window.__ember.getWorld().fauna.find((creature) => creature.id === id)?.hp,
    bow.targetId,
  );
  if (!(typeof bowAfter === "number" && bowAfter < bow.hp))
    throw new Error(`${viewport.name}: arrow did not land`);

  await castProjectile(page, "magicarrow");
  await page.waitForTimeout(80);
  const magicArrow = path.join(outputDir, `animation-magic-arrow-${viewport.name}.png`);
  await page.screenshot({ path: magicArrow });

  await castProjectile(page, "fireball");
  await page.waitForTimeout(80);
  const fireball = path.join(outputDir, `animation-fireball-${viewport.name}.png`);
  await page.screenshot({ path: fireball });

  const teleportResult = await castTravel(page, "teleport");
  await page.waitForTimeout(80);
  const teleport = path.join(outputDir, `animation-teleport-${viewport.name}.png`);
  await page.screenshot({ path: teleport });
  if (
    teleportResult.from.x === teleportResult.to.x &&
    teleportResult.from.z === teleportResult.to.z
  )
    throw new Error(`${viewport.name}: teleport did not move`);

  const recallResult = await castTravel(page, "recall");
  await page.waitForTimeout(80);
  const recall = path.join(outputDir, `animation-recall-${viewport.name}.png`);
  await page.screenshot({ path: recall });
  if (recallResult.from.x === recallResult.to.x && recallResult.from.z === recallResult.to.z)
    throw new Error(`${viewport.name}: recall did not move`);

  const fizzleToast = await castFizzle(page);
  await page.waitForTimeout(80);
  const fizzle = path.join(outputDir, `animation-fizzle-${viewport.name}.png`);
  await page.screenshot({ path: fizzle });
  if (!String(fizzleToast).includes("fizzles"))
    throw new Error(`${viewport.name}: fizzle did not resolve`);

  const healingResult = await runBandage(page);
  await page.waitForTimeout(80);
  const healing = path.join(outputDir, `animation-healing-${viewport.name}.png`);
  await page.screenshot({ path: healing });
  if (healingResult.after.bandages !== healingResult.before.bandages - 1)
    throw new Error(`${viewport.name}: bandage was not consumed`);
  if (healingResult.after.hp <= healingResult.before.hp)
    throw new Error(`${viewport.name}: bandage did not restore health`);
  if (!String(healingResult.toast).toLowerCase().includes("cloth holds"))
    throw new Error(`${viewport.name}: healing feedback was not surfaced`);

  const taming = await startTaming(page, 100);
  await page.waitForTimeout(80);
  const tamingAttempt = path.join(outputDir, `animation-taming-attempt-${viewport.name}.png`);
  await page.screenshot({ path: tamingAttempt });
  const tameSuccess = await finishTaming(page, taming.targetId, true);
  await page.waitForTimeout(80);
  const tamingSuccess = path.join(outputDir, `animation-taming-success-${viewport.name}.png`);
  await page.screenshot({ path: tamingSuccess });
  if (!tameSuccess.ownerId)
    throw new Error(`${viewport.name}: taming success did not create a companion`);
  const refusal = await startTaming(page, 0);
  const tameFailure = await finishTaming(page, refusal.targetId, false);
  await page.waitForTimeout(80);
  const tamingFailure = path.join(outputDir, `animation-taming-failure-${viewport.name}.png`);
  await page.screenshot({ path: tamingFailure });
  if (tameFailure.ownerId || tameFailure.task !== "flee")
    throw new Error(`${viewport.name}: taming refusal did not flee`);

  const carpentryToast = await runCrafting(page, "carpentry");
  await page.waitForTimeout(100);
  const carpentry = path.join(outputDir, `animation-carpentry-${viewport.name}.png`);
  await page.screenshot({ path: carpentry });
  if (!String(carpentryToast).toLowerCase().includes("board")) throw new Error(`${viewport.name}: carpentry did not resolve`);

  const smithingToast = await runCrafting(page, "smithing");
  await page.waitForTimeout(100);
  const smithing = path.join(outputDir, `animation-smithing-${viewport.name}.png`);
  await page.screenshot({ path: smithing });
  if (!String(smithingToast).toLowerCase().includes("ingot")) throw new Error(`${viewport.name}: smithing did not resolve`);

  const cookingToast = await runCrafting(page, "cooking");
  await page.waitForTimeout(100);
  const cooking = path.join(outputDir, `animation-cooking-${viewport.name}.png`);
  await page.screenshot({ path: cooking });
  if (!String(cookingToast).toLowerCase().includes("fire crackles")) throw new Error(`${viewport.name}: cooking did not resolve`);

  if (consoleErrors.length || pageErrors.length) {
    throw new Error(
      `${viewport.name} browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`,
    );
  }
  results.push({
    viewport: viewport.name,
    meleeDamage: melee.hp - meleeAfter,
    arrowDamage: bow.hp - bowAfter,
    screenshots: {
      meleeWindup,
      meleeImpact,
      bowDraw,
      arrowFlight,
      magicArrow,
      fireball,
      teleport,
      recall,
      fizzle,
      healing,
      tamingAttempt,
      tamingSuccess,
      tamingFailure,
      carpentry,
      smithing,
      cooking,
    },
    consoleErrors,
    pageErrors,
  });
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ ok: true, results }, null, 2));
