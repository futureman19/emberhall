#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const url = process.env.METALWORK_SMOKE_URL || "http://127.0.0.1:8080/";
const output = resolve(process.env.METALWORK_SMOKE_OUTPUT_DIR || "screenshots/metalwork-smoke");
const flow = process.env.METALWORK_SMOKE_FLOW ?? "all";
mkdirSync(output, { recursive: true });

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
].filter((v) => !process.env.METALWORK_SMOKE_VIEWPORT || v.name === process.env.METALWORK_SMOKE_VIEWPORT);

const verdict = { url, viewports: {}, ok: true };
const t0 = Date.now();
const lap = (label) => console.error(`[smoke ${((Date.now() - t0) / 1000).toFixed(0)}s] ${label}`);
// SwiftShader stalls the main thread for seconds per frame, so Playwright's
// actionability loop (stability + hit-target polls) burns whole timeouts per
// click. Dispatch real DOM clicks instead — they fire the same React handlers,
// just without the stall-prone preflight. waitFor(visible) stays the gate.
const domClick = (locator) => locator.evaluate((el) => el.click());
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
// Warmup: the first page load after source edits absorbs vite's re-optimization
// and any queued HMR full-reload. Viewport pages then drive a quiet graph.
{
  const warm = await browser.newPage();
  await warm.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const ok = await warm.evaluate(() => {
      const btn = document.querySelector('[aria-label^="Music"]');
      return Boolean(btn) && Object.keys(btn).some((k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps"));
    }).catch(() => false);
    if (ok) break;
    await warm.waitForTimeout(1000);
  }
  await warm.waitForTimeout(1500);
  await warm.close();
}
try {
  for (const viewport of viewports) {
    lap(`${viewport.name}: new page`);
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.getByText("New hall").waitFor({ state: "visible", timeout: 45000 });
    // A fresh dev server can serve the first page before its module graph
    // settles; that page hydrates late or via a client-forced reload. Wait
    // for React's fiber marker on a real DOM node — pure-read, no clicks,
    // immune to actionability races and mid-poll navigations.
    let alive = false;
    for (let attempt = 0; attempt < 30 && !alive; attempt += 1) {
      alive = await page.evaluate(() => {
        const btn = document.querySelector('[aria-label^="Music"]');
        return Boolean(btn) && Object.keys(btn).some((k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps"));
      }).catch(() => false);
      if (!alive) await page.waitForTimeout(1000);
    }
    if (!alive) throw new Error("dev server page never hydrated (React dead after 30s)");
    lap(`${viewport.name}: hydrated`);
    await page.evaluate(async () => {
      // The app loads its modules with vite's ?t= invalidation query; a bare
      // dynamic import would spin up a SECOND store/world instance. Reuse the
      // exact URLs the app fetched for the stateful singletons.
      const appUrl = (path) => performance.getEntriesByType("resource").find((e) => e.name.includes(path))?.name ?? path;
      const live = await import(appUrl("/src/game/live.ts"));
      const inventory = await import("/src/game/inventory/resources.ts");
      const player = await import("/src/game/player.ts");
      const store = await import(appUrl("/src/game/store.ts"));
      const world = live.resetWorld();
      const self = player.you(world);
      const forge = world.buildings.find(({ kind }) => kind === "forge");
      if (!self || !forge) throw new Error("metalwork fixture needs player and forge");
      self.x = forge.tx;
      self.z = forge.ty;
      world.player.skills.smithing = 100;
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("copper_ore", "ore", "choice"), 2);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("copper_ore", "ingot", "choice"), 7);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("tin_ore", "ingot", "choice"), 1);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("iron_ore", "ingot", "choice"), 11);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("oak", "board", "sound"), 3);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("fine_linen", "cloth", "sound"), 6);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("diamond", "gem", "flawless"), 1);
      inventory.addResource(world.player.resources, inventory.makeResourceStackKey("amethyst", "gem", "flawless"), 1);
      Math.random = () => 0.5;
      store.useGame.setState({ phase: "playing", openCraft: true, panel: "none", snap: live.snapshot(world) });
      // Freeze the frame-driven sim: every tick re-renders the gump and replaces
      // radio nodes mid-click, which makes Playwright's actionability loop hang.
      store.useGame.getState().tick = () => {};
      store.useGame.setState({ snap: live.snapshot(world) });
    });

    // Refining panel: copper ore row smelts into an ingot through the real button.
    lap(`${viewport.name}: fixture applied`);
    const tabTo = (name) => domClick(page.getByRole("tab", { name, exact: true }));
    const refining = page.locator('[aria-label="Refining"]');
    const refineFlow = flow === "all" || flow === "a";
    const earlyForms = flow === "all" || flow === "a"; // sword, shield, helm
    const lateForms = flow === "all" || flow === "b"; // mail, gauntlets, inlay

    if (refineFlow) {
      await tabTo("Refine");
      await refining.getByText(/Copper Ore ×2 · choice → ingot/).waitFor({ state: "visible", timeout: 15000 });
      await domClick(refining.getByRole("button", { name: "Smelt" }).first());
      await refining.getByText(/Copper Ore ×1 · choice → ingot/).waitFor({ state: "visible", timeout: 15000 });
      lap(`${viewport.name}: copper smelted`);
    }

    if (earlyForms) {
      await tabTo("Forms");
      // Sword form: pick the exact stacks and craft through the real button.
      const swordWork = page.locator('[aria-label="Advanced sword work"]');
      await domClick(swordWork.getByRole("radio", { name: /Copper Ore · Choice ingot/ }));
      await domClick(swordWork.getByRole("radio", { name: /Oak · Sound board/ }));
      await domClick(swordWork.getByRole("radio", { name: /Fine Linen · Sound cloth/ }));
      await domClick(swordWork.getByRole("button", { name: "Craft selected sword" }));

      // Alloy: the copper-ingot row offers bronze once the sword work has taught
      // enough smithing — and shows its tin requirement.
      await tabTo("Refine");
      const bronzeRow = refining.locator("li", { hasText: "(+ 1 tin ore)" });
      await bronzeRow.getByText(/Bronze ×3 · choice → ingot/).waitFor({ state: "visible", timeout: 15000 });
      await domClick(bronzeRow.getByRole("button", { name: "Smelt" }));
      lap(`${viewport.name}: bronze smelted`);
      await tabTo("Forms");

      // Shield: first armor form — iron plates, oak frame, linen binding.
      const shieldWork = page.locator('[aria-label="Advanced shield work"]');
      await shieldWork.getByText("Form · Shield").waitFor({ state: "visible", timeout: 15000 });
      await domClick(shieldWork.getByRole("radio", { name: /Iron Ore · Choice ingot/ }));
      await domClick(shieldWork.getByRole("radio", { name: /Oak · Sound board/ }));
      await domClick(shieldWork.getByRole("radio", { name: /Fine Linen · Sound cloth/ }));
      await domClick(shieldWork.getByRole("button", { name: "Craft selected shield" }));

      // Helm: second armor form — two iron plates and a cloth lining, head slot.
      const helmWork = page.locator('[aria-label="Advanced helm work"]');
      await helmWork.getByText("Form · Helm").waitFor({ state: "visible", timeout: 15000 });
      await domClick(helmWork.getByRole("radio", { name: /Iron Ore · Choice ingot/ }));
      await domClick(helmWork.getByRole("radio", { name: /Fine Linen · Sound cloth/ }));
      await domClick(helmWork.getByRole("button", { name: "Craft selected helm" }));
      lap(`${viewport.name}: early forms crafted`);

      // Mastery: a flawless amethyst into the sword — the blade schools its wielder.
      await tabTo("Inlay");
      const earlyInlay = page.locator('[aria-label="Gem inlay"]');
      const earlyItem = earlyInlay.getByLabel("Crafted item");
      const swordValue = await earlyItem.evaluate((el) => [...el.options].find((o) => /sword/i.test(o.text))?.value ?? "");
      if (!swordValue) throw new Error("sword missing from the inlay item select");
      await earlyItem.selectOption(swordValue);
      await earlyInlay.getByLabel("Gem").selectOption({ value: "amethyst:gem:flawless" });
      await earlyInlay.getByText("Mastery IV: +2 skill").waitFor({ state: "visible", timeout: 15000 });
      await domClick(earlyInlay.getByRole("button", { name: "Inlay exact result" }));
      lap(`${viewport.name}: mastery inlay done`);
      await tabTo("Forms");
    }

    if (lateForms) {
      // The gump opens on the Forms tab by default — no switch needed in flow "b".
      // Mail: chest armor — four iron plates and two cloth lining.
      const mailWork = page.locator('[aria-label="Advanced mail work"]');
      await mailWork.getByText("Form · Mail").waitFor({ state: "visible", timeout: 15000 });
      await domClick(mailWork.getByRole("radio", { name: /Iron Ore · Choice ingot/ }));
      await domClick(mailWork.getByRole("radio", { name: /Fine Linen · Sound cloth/ }));
      await domClick(mailWork.getByRole("button", { name: "Craft selected mail" }));
      // Gauntlets: hands slot — the template-identical boots/greaves sections are
      // covered by the unit set test and the balance gate (same component path).
      const gauntletsWork = page.locator('[aria-label="Advanced gauntlets work"]');
      await gauntletsWork.getByText("Form · Gauntlets").waitFor({ state: "visible", timeout: 15000 });
      await domClick(gauntletsWork.getByRole("radio", { name: /Iron Ore · Choice ingot/ }));
      await domClick(gauntletsWork.getByRole("radio", { name: /Fine Linen · Sound cloth/ }));
      await domClick(gauntletsWork.getByRole("button", { name: "Craft selected gauntlets" }));
      lap(`${viewport.name}: late forms crafted`);

      // Gem inlay: a flawless diamond through the real panel — into the shield in
      // the full flow, into the mail in flow "b" (the first eligible item either way).
      await tabTo("Inlay");
      const inlayPanel = page.locator('[aria-label="Gem inlay"]');
      const itemSelect = inlayPanel.getByLabel("Crafted item");
      const targetValue = await itemSelect.evaluate((el, re) => [...el.options].find((o) => new RegExp(re, "i").test(o.text))?.value ?? "", flow === "b" ? "mail" : "shield");
      if (!targetValue) throw new Error("inlay target missing from the item select");
      await itemSelect.selectOption(targetValue);
      await inlayPanel.getByLabel("Gem").selectOption({ value: "diamond:gem:flawless" });
      await inlayPanel.getByText("Protection IV: +1 armor").waitFor({ state: "visible", timeout: 15000 });
      await domClick(inlayPanel.getByRole("button", { name: "Inlay exact result" }));
      lap(`${viewport.name}: inlay done`);
    }

    const state = await page.evaluate(async () => {
      const appUrl = (path) => performance.getEntriesByType("resource").find((e) => e.name.includes(path))?.name ?? path;
      const live = await import(appUrl("/src/game/live.ts"));
      const save = await import("/src/game/save.ts");
      const inventory = await import("/src/game/inventory/resources.ts");
      const player = await import("/src/game/player.ts");
      const rare = await import("/src/game/rare.ts");
      const world = live.getWorld();
      const shield = world.player.rares.find((r) => r.base === "shield");
      if (shield) player.commandEquipRare(world, shield.uid);
      const helm = world.player.rares.find((r) => r.base === "helm");
      if (helm) player.commandEquipRare(world, helm.uid);
      const mail = world.player.rares.find((r) => r.base === "mail");
      if (mail) player.commandEquipRare(world, mail.uid);
      const gauntlets = world.player.rares.find((r) => r.base === "gauntlets");
      if (gauntlets) player.commandEquipRare(world, gauntlets.uid);
      const armorWorn = rare.rareMods(world).armor;
      save.writeSave(world);
      const loaded = save.loadSave();
      const item = loaded?.player.rares[0];
      return {
        ingots: inventory.resourceCount(world.player.resources, "copper_ore:ingot:choice"),
        oreLeft: inventory.resourceCount(world.player.resources, "copper_ore:ore:choice"),
        bronze: inventory.resourceCount(world.player.resources, "bronze:ingot:choice"),
        tinLeft: inventory.resourceCount(world.player.resources, "tin_ore:ingot:choice"),
        shieldArmor: shield?.resolvedStats?.armor,
        shieldInlay: shield?.inlays?.[0] ? `${shield.inlays[0].resourceId}:${shield.inlays[0].clarity}` : null,
        diamondLeft: inventory.resourceCount(world.player.resources, "diamond:gem:flawless"),
        helmArmor: helm?.resolvedStats?.armor,
        helmEquipped: helm ? world.player.wearRare.head === helm.uid : false,
        mailArmor: mail?.resolvedStats?.armor,
        mailInlay: mail?.inlays?.[0] ? `${mail.inlays[0].resourceId}:${mail.inlays[0].clarity}` : null,
        mailEquipped: mail ? world.player.wearRare.chest === mail.uid : false,
        gauntletsArmor: gauntlets?.resolvedStats?.armor,
        gauntletsEquipped: gauntlets ? world.player.wearRare.hands === gauntlets.uid : false,
        ironLeft: inventory.resourceCount(world.player.resources, "iron_ore:ingot:choice"),
        clothLeft: inventory.resourceCount(world.player.resources, "fine_linen:cloth:sound"),
        swordSkills: world.player.rares.find((r) => r.base === "sword")?.resolvedStats?.skillBonuses?.swords,
        amethystLeft: inventory.resourceCount(world.player.resources, "amethyst:gem:flawless"),
        shieldEquipped: shield ? world.player.wearRare.off === shield.uid : false,
        armorWorn,
        itemName: item?.base,
        edge: item?.components?.[0]?.resourceId,
        hitBonus: item?.resolvedStats?.hitBonus,
        saved: Boolean(loaded),
      };
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    const screenshot = resolve(output, `${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    const passed = response?.ok()
      && state.saved
      && !overflow
      && errors.length === 0
      && (flow === "b"
        ? state.mailArmor === 6.5 // 4 base + 1.5 choice sturdy plates + 1 flawless protection diamond
          && state.mailInlay === "diamond:flawless"
          && state.diamondLeft === 0
          && state.mailEquipped // rare mail equips into the chest slot
          && state.gauntletsArmor === 3.5 // 2 base + 1.5 choice sturdy plates
          && state.gauntletsEquipped // rare gauntlets equip into the hands slot
          && state.ironLeft === 5 // 11 − 4 mail − 2 gauntlets
          && state.clothLeft === 3 // 6 − 2 mail lining − gauntlets lining
          && state.armorWorn === 10 // 6.5 mail + 3.5 gauntlets, both worn
        : flow === "a"
          ? state.ingots === 1 // 7 + 1 smelted − 5 sword edge − 2 alloyed
            && state.oreLeft === 1
            && state.bronze === 3 // 2 copper + 1 tin → 3 bronze ingots
            && state.tinLeft === 0
            && state.shieldArmor === 3.5 // 2 base + 1.5 choice sturdy plates; no inlay in this flow
            && state.shieldEquipped // rare shields equip into the off hand
            && state.helmArmor === 3.5 // 2 base + 1.5 choice sturdy plates; workmanship adds no armor
            && state.helmEquipped // rare helms equip into the head slot
            && state.ironLeft === 6 // 11 − 3 shield − 2 helm
            && state.clothLeft === 3 // 6 − sword binding − shield binding − helm lining
            && state.armorWorn === 7 // 3.5 shield + 3.5 helm, both worn
            && state.swordSkills === 2 // flawless mastery in the blade
            && state.amethystLeft === 0
            && state.itemName === "sword"
            && state.edge === "copper_ore"
            && state.hitBonus === 1.875 // 0.75 choice copper edge (primary) + 0.125 sound linen handling (secondary) + 1 fine workmanship
          : state.ingots === 1
            && state.oreLeft === 1
            && state.bronze === 3
            && state.tinLeft === 0
            && state.shieldArmor === 4.5 // 2 base + 1.5 choice sturdy plates + 1 flawless protection diamond
            && state.shieldInlay === "diamond:flawless"
            && state.diamondLeft === 0
            && state.shieldEquipped
            && state.helmArmor === 3.5
            && state.helmEquipped
            && state.mailArmor === 5.5
            && state.mailEquipped
            && state.gauntletsArmor === 3.5
            && state.gauntletsEquipped
            && state.ironLeft === 0 // 11 − 3 shield − 2 helm − 4 mail − 2 gauntlets
            && state.clothLeft === 0
            && state.armorWorn === 17
            && state.swordSkills === 2
            && state.amethystLeft === 0
            && state.itemName === "sword"
            && state.edge === "copper_ore"
            && state.hitBonus === 1.875);
    verdict.viewports[viewport.name] = { passed, state, overflow, errors, screenshot };
    lap(`${viewport.name}: verdict passed=${passed}`);
    if (!passed) verdict.ok = false;
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(resolve(output, "verdict.json"), JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
if (!verdict.ok) process.exitCode = 1;
