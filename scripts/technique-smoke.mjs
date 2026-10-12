#!/usr/bin/env node
/**
 * Smoke: the technique chips row — sword kit renders above the quick bar,
 * locked tier shows its skill badge, tap arms (gold ring + toast), re-tap
 * lets go, cooling chips count down, and swapping to a bow swaps the kit.
 * Trusted Playwright clicks; store/live module identity resolved from the
 * served hud.tsx; effects polled, never fixed-waited (SwiftShader sludge).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const url = process.env.TECHNIQUE_SMOKE_URL || "http://127.0.0.1:8080/";
const output = resolve(process.env.TECHNIQUE_SMOKE_OUTPUT_DIR || "screenshots/technique-smoke");
mkdirSync(output, { recursive: true });

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844, hasTouch: true },
];

const verdict = { url, ok: true, viewports: {}, errors: [] };
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => {
      const message = `page: ${error.message}`;
      if (!(message.includes("Switched to client rendering") && message.includes("@1sat"))) errors.push(message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    page.setDefaultTimeout(20000);
    await page.getByText("New hall").waitFor({ state: "visible", timeout: 45000 });

    const mods = await page.evaluate(async () => {
      const src = await (await fetch("/src/components/game/hud.tsx")).text();
      return {
        store: src.match(/from "(\/src\/game\/store\.ts[^"]*)"/)?.[1] ?? "/src/game/store.ts",
        live: src.match(/from "(\/src\/game\/live\.ts[^"]*)"/)?.[1] ?? "/src/game/live.ts",
      };
    });

    // Fixture: sword in hand, swords 60 (lunge + riposte open, cleave shut), sim frozen.
    await page.evaluate(async ({ live, store }) => {
      const liveMod = await import(live);
      const storeMod = await import(store);
      const world = liveMod.resetWorld();
      world.player.wear = { main: "sword" };
      world.player.skills.swords = 60;
      storeMod.useGame.setState({ phase: "playing", panel: "none", snap: liveMod.snapshot(world) });
      storeMod.useGame.getState().tick = () => {};
    }, mods);

    const steps = {};

    // 0. Combat chrome floats: chips + quick slots + vitals globes in the
    //    bottom-center cluster — no carved band anywhere.
    await page.waitForFunction(
      () => document.querySelector('[data-testid="combat-cluster"]') && document.querySelector('[data-testid="technique-bar"]'),
    );
    steps.noBand = await page.evaluate(() => !document.querySelector('[data-testid="bottom-band"]'));
    steps.chipsInCluster = await page.evaluate(() => {
      const cluster = document.querySelector('[data-testid="combat-cluster"]');
      const bar = document.querySelector('[data-testid="technique-bar"]');
      const hotbar = document.querySelector('[data-testid="hotbar"]');
      return Boolean(cluster && bar && cluster.contains(bar) && (!hotbar || cluster.contains(hotbar)));
    });
    steps.orbsFlank = await page.evaluate(() => {
      const hp = document.querySelector('[data-testid="orb-health"]');
      const mana = document.querySelector('[data-testid="orb-mana"]');
      if (!hp || !mana) return false;
      const h = hp.getBoundingClientRect();
      const m = mana.getBoundingClientRect();
      return h.right <= m.left;
    });
    steps.chipsOnScreen = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="technique-bar"]');
      if (!bar) return false;
      const r = bar.getBoundingClientRect();
      return r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight;
    });

    // 1. Row up with the three sword moves.
    await page.waitForFunction(() => document.querySelector('[data-testid="technique-bar"]'));
    steps.chips = await page.locator('[data-testid="technique-bar"] > button').count();

    // 2. Cleave (tier 75 > 60) stays locked and shows its asking tier.
    const cleave = page.getByRole("button", { name: "Cleave (technique)" });
    steps.cleaveLocked = (await cleave.getAttribute("aria-disabled")) === "true";
    steps.cleaveBadge = (await cleave.textContent())?.includes("75") ?? false;

    // 3. Tap Lunge → armed in the world, gold ring, ready toast.
    await page.getByRole("button", { name: "Lunge (technique)" }).click({ noWaitAfter: true });
    await page.waitForFunction(async (store) => {
      const storeMod = await import(store);
      return storeMod.useGame.getState().snap && (await import("/src/game/live.ts")).getWorld().player.armedTechnique === "lunge";
    }, mods.store);
    steps.lungeArmed = await page.evaluate(async ({ live }) => {
      const liveMod = await import(live);
      return liveMod.getWorld().player.armedTechnique;
    }, mods);
    steps.lungeGold = await page.getByRole("button", { name: "Lunge (technique)" }).evaluate((el) => el.className.includes("border-gold"));

    // 4. Re-tap lets go.
    await page.getByRole("button", { name: "Lunge (technique)" }).click({ noWaitAfter: true });
    await page.waitForFunction(async (live) => {
      const liveMod = await import(live);
      return liveMod.getWorld().player.armedTechnique === null;
    }, mods.live);
    steps.disarmWorks = true;

    // 5. A cooling move counts down and refuses (aria-disabled).
    await page.evaluate(async ({ live, store }) => {
      const liveMod = await import(live);
      const storeMod = await import(store);
      liveMod.getWorld().player.techniqueCoolUntil.riposte = liveMod.getWorld().hour + 0.5;
      storeMod.useGame.setState({ snap: liveMod.snapshot() });
    }, mods);
    const riposte = page.getByRole("button", { name: "Riposte (technique)" });
    await page.waitForFunction(() => {
      const el = [...document.querySelectorAll('[data-testid="technique-bar"] button')].find((b) => b.getAttribute("aria-label") === "Riposte (technique)");
      return el && /\d/.test(el.textContent ?? "");
    });
    steps.cooldownBadge = true;
    steps.riposteCooling = (await riposte.getAttribute("aria-disabled")) === "true";

    // 6. Bow in hand swaps the kit (Aimed Shot appears, Lunge leaves).
    await page.evaluate(async ({ live, store }) => {
      const liveMod = await import(live);
      const storeMod = await import(store);
      const w = liveMod.getWorld();
      w.player.wear.main = "bow";
      w.player.pack.arrows = 5;
      w.player.skills.archery = 80;
      storeMod.useGame.setState({ snap: liveMod.snapshot(w) });
    }, mods);
    await page.waitForFunction(() => {
      return [...document.querySelectorAll('[data-testid="technique-bar"] button')].some((b) => b.getAttribute("aria-label") === "Aimed Shot (technique)");
    });
    steps.bowKit = await page.locator('[data-testid="technique-bar"] > button').count();
    steps.lungeGone = (await page.getByRole("button", { name: "Lunge (technique)" }).count()) === 0;

    // 7. Knife in hand swaps to the fencing kit (Flurry appears), and a
    //    knife strike teaches Fencing in the skills list.
    await page.evaluate(async ({ live, store }) => {
      const liveMod = await import(live);
      const storeMod = await import(store);
      const w = liveMod.getWorld();
      w.player.wear.main = "knife";
      w.player.skills.fencing = 50;
      storeMod.useGame.setState({ snap: liveMod.snapshot(w) });
    }, mods);
    await page.waitForFunction(() => {
      return [...document.querySelectorAll('[data-testid="technique-bar"] button')].some((b) => b.getAttribute("aria-label") === "Flurry (technique)");
    });
    steps.knifeKit = await page.locator('[data-testid="technique-bar"] > button').count();
    steps.bowKitGone = (await page.getByRole("button", { name: "Aimed Shot (technique)" }).count()) === 0;

    await page.screenshot({ path: resolve(output, `technique-${viewport.name}.png`) });
    verdict.viewports[viewport.name] = { steps, errors };
    if (!steps.noBand || !steps.chipsInCluster || !steps.orbsFlank || !steps.chipsOnScreen || steps.chips !== 3 || !steps.cleaveLocked || !steps.cleaveBadge || steps.lungeArmed !== "lunge" || !steps.lungeGold
      || !steps.disarmWorks || !steps.cooldownBadge || !steps.riposteCooling || steps.bowKit !== 3 || !steps.lungeGone
      || steps.knifeKit !== 3 || !steps.bowKitGone || errors.length) {
      verdict.ok = false;
    }
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(resolve(output, "verdict.json"), JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
process.exit(verdict.ok ? 0 : 1);
