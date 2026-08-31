#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const url = process.env.CHAIN_SMOKE_URL || "http://127.0.0.1:8080/";
const output = resolve(process.env.CHAIN_SMOKE_OUTPUT_DIR || "screenshots/chain-smoke");
mkdirSync(output, { recursive: true });

const originLook = `${"a".repeat(64)}.0`;
const originPart = `${"b".repeat(64)}.0`;
const originListed = `${"c".repeat(64)}.0`;
const lookPayload = {
  app: "emberhall", v: 4, type: "look", name: "Ada Vale", calling: "mage",
  look: { schema: "emberhall.look/1", cls: "mage", skin: "#8b5f42", hairStyle: "tail", hairColor: "#d7c6a5", garb: "#3d526e" },
  world: 77, hour: 8, revision: 1,
};
const part = (id, name, slot) => ({
  app: "emberhall", v: 4, type: "part", world: 77, hour: 8,
  part: {
    schema: "emberhall.part/1", id, name, slot,
    voxels: [{ x: 1, y: 0, z: 1, c: "#e8b96a" }, { x: 2, y: 0, z: 1, c: "#a85a42" }],
    createdAt: 42, author: "Ada Vale", rarity: "common",
  },
});
const payloads = new Map([
  [originLook.replace(".0", "_0"), lookPayload],
  [originPart.replace(".0", "_0"), part("chain-crown", "Chain Crown", "hair")],
  [originListed.replace(".0", "_0"), part("market-cloak", "Market Cloak", "back")],
]);
const walletOutputs = [
  { satoshis: 1, spendable: true, outpoint: originLook, tags: ["id:look-now", "origin", "type:application/json"] },
  { satoshis: 1, spendable: true, outpoint: originPart, tags: ["id:part-now", "origin", "type:application/json"] },
  { satoshis: 1, spendable: true, outpoint: originListed, tags: ["id:part-listed", "origin", "type:application/json", "ordlock", "price:75"] },
];

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];
const verdict = { url, ok: true, viewports: {} };
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    const expectedDevFallbacks = [];
    page.on("pageerror", (error) => {
      const message = error.message;
      if (message.includes("Switched to client rendering") && message.includes("@1sat") && message.includes("dist\\types")) expectedDevFallbacks.push(message);
      else errors.push(`page: ${message}`);
    });
    page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
    await page.addInitScript(({ outputs }) => {
      localStorage.setItem("onesat_wallet_provider", JSON.stringify({ providerType: "emberhall-smoke" }));
      window.__EMBERHALL_SMOKE_WALLET__ = {
        listOutputs: async ({ offset = 0, limit = 100 }) => ({ outputs: outputs.slice(offset, offset + limit), totalOutputs: outputs.length }),
      };
    }, { outputs: walletOutputs });
    await page.route("https://api.1sat.app/content/**", async (route) => {
      const key = route.request().url().split("/").at(-1);
      const payload = payloads.get(key);
      await route.fulfill(payload ? { status: 200, contentType: "application/json", body: JSON.stringify(payload) } : { status: 404, body: "" });
    });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.getByText("New hall").waitFor({ state: "visible", timeout: 45000 });
    await page.evaluate(async () => {
      const live = await import("/src/game/live.ts");
      const parts = await import("/src/game/look/parts.ts");
      const store = await import("/src/game/store.ts");
      const world = live.resetWorld();
      const self = world.people.find(({ isPlayer }) => isPlayer);
      self.name = "Local Ash";
      self.cls = "ranger";
      self.look = { schema: "emberhall.look/1", cls: "ranger" };
      parts.savePart({
        schema: "emberhall.part/1", id: "bench-pin", name: "Bench Pin", slot: "trinket",
        voxels: [{ x: 0, y: 0, z: 0, c: "#e8b96a" }], createdAt: 7, author: "Local Ash", rarity: "common",
      });
      store.useGame.setState({ phase: "playing", openVault: true, panel: "none", snap: live.snapshot(world) });
    });

    await page.getByTestId("vault-look-section").waitFor({ state: "visible", timeout: 15000 });
    await page.getByTestId("vault-restore-look").click();
    await page.getByTestId("vault-local-parts").waitFor({ state: "visible" });
    await page.getByTestId("vault-chain-parts").waitFor({ state: "visible" });
    const listedRow = page.getByText("Market Cloak").locator(".." ).locator("..");
    const listedHasCancel = await listedRow.getByRole("button", { name: "Cancel listing" }).isVisible().catch(() => false);
    const listedHasRedeem = await page.getByTestId("vault-redeem-part-market-cloak").isVisible().catch(() => false);
    const state = await page.evaluate(async ({ origin, payload }) => {
      const artifacts = await import("/src/game/chain-artifacts.ts");
      const live = await import("/src/game/live.ts");
      const parts = await import("/src/game/look/parts.ts");
      const world = live.getWorld();
      const self = world.people.find(({ isPlayer }) => isPlayer);
      const before = parts.listParts().some(({ id }) => id === "bench-pin");
      artifacts.applyMintPart(world, "bench-pin");
      const removed = !parts.listParts().some(({ id }) => id === "bench-pin");
      const decoded = artifacts.decodePartInscription(payload);
      artifacts.applyRedeemPart(world, decoded, origin);
      const restoredId = artifacts.localPartIdFromOrigin(origin);
      const restored = parts.listParts().some(({ id }) => id === restoredId);
      artifacts.applyTogglePart(world, restoredId);
      const wearable = self.look.parts?.includes(restoredId) === true;
      return { name: self.name, calling: self.cls, resolved: (await import("/src/game/look/resolve.ts")).resolveLook(self.look), before, removed, restored, wearable };
    }, { origin: originPart, payload: payloads.get(originPart.replace(".0", "_0")) });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    const panelScroll = await page.getByTestId("vault-panel").evaluate((panel) => {
      const canScroll = panel.scrollHeight > panel.clientHeight;
      panel.scrollTop = panel.scrollHeight;
      return { canScroll, reachedBottom: panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1 };
    });
    await page.getByTestId("vault-chain-parts").waitFor({ state: "visible" });
    const screenshot = resolve(output, `${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    const passed = Boolean(response?.ok())
      && state.name === "Ada Vale"
      && state.calling === "mage"
      && state.resolved.hairStyle === "tail"
      && state.before && state.removed && state.restored && state.wearable
      && listedHasCancel && !listedHasRedeem
      && panelScroll.canScroll && panelScroll.reachedBottom
      && !overflow && errors.length === 0;
    verdict.viewports[viewport.name] = { passed, state, listedHasCancel, listedHasRedeem, panelScroll, overflow, errors, expectedDevFallbacks, screenshot };
    if (!passed) verdict.ok = false;
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(resolve(output, "verdict.json"), `${JSON.stringify(verdict, null, 2)}\n`);
console.log(JSON.stringify(verdict, null, 2));
if (!verdict.ok) process.exitCode = 1;
