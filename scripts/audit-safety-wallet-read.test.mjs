import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import ts from "typescript";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Execute the real adapter, replacing only the signing SDK boundary. No network.
const root = fileURLToPath(new URL("../", import.meta.url));
const source = await readFile(root + "src/chain/oneSat.ts", "utf8");
const sdk = "data:text/javascript," + encodeURIComponent("export const listOrdinals = { execute: (...args) => globalThis.__walletPage(...args) };");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replaceAll('import("@1sat/actions")', `import(${JSON.stringify(sdk)})`)
  .replace(/from "@\/([^"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(`../src/${path}.ts`, import.meta.url).href)}`)
  .replace(/from "\.\/([^"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(`../src/chain/${path}.ts`, import.meta.url).href)}`);
const adapter = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; delete globalThis.__walletPage; });
const ctx = { wallet: {}, chain: "main", isBaseWallet: true };
const row = (n = 0) => ({ outpoint: `${n.toString(16).padStart(64, "0")}.0`, tags: [`id:${n}`, "origin"] });
function page(outputs, totalOutputs = outputs.length) {
  globalThis.__walletPage = async () => ({ outputs, totalOutputs });
}
for (const status of [404, 429, 500]) {
  test(`HTTP ${status} is unavailable, never successful empty inventory`, async () => {
    page([row(status)]);
    globalThis.fetch = async () => new Response("unavailable", { status });
    await assert.rejects(adapter.listEmberhallNfts(ctx), /404|429|500|unavailable/i);
  });
}
test("transport failure is retryable and not cached as absence", async () => {
  page([row(9)]);
  globalThis.fetch = async () => { throw new Error("offline"); };
  await assert.rejects(adapter.listEmberhallNfts(ctx), /offline/);
  globalThis.fetch = async () => new Response("{}");
  assert.deepEqual(await adapter.listEmberhallNfts(ctx), []);
});
test("verified zero is a successful empty result", async () => {
  page([]); globalThis.fetch = () => { throw new Error("must not fetch"); };
  assert.deepEqual(await adapter.listEmberhallNfts(ctx), []);
});
for (const value of [null, {}, { outputs: null }, { outputs: [], totalOutputs: NaN }, { outputs: [], totalOutputs: 1 }]) {
  test(`malformed/incomplete provider response rejects: ${JSON.stringify(value)}`, async () => {
    globalThis.__walletPage = async () => value;
    await assert.rejects(adapter.listEmberhallNfts(ctx));
  });
}
test("non-progressing duplicate pages reject", async () => {
  page(Array.from({ length: 200 }, (_, i) => row(i)), 400);
  globalThis.fetch = async () => new Response("{}");
  await assert.rejects(adapter.listEmberhallNfts(ctx), /duplicate|progress/i);
});
test("oversized content rejects before JSON decode", async () => {
  page([row(1001)]);
  globalThis.fetch = async () => new Response(JSON.stringify({ padding: "x".repeat(300_000) }));
  await assert.rejects(adapter.listEmberhallNfts(ctx), /large|limit|bytes/i);
});
test("cancellation rejects an in-flight provider read", { timeout: 1000 }, async () => {
  globalThis.__walletPage = () => new Promise(() => {});
  const abort = new AbortController();
  const pending = adapter.listEmberhallNfts(ctx, { signal: abort.signal });
  abort.abort();
  await assert.rejects(pending, /abort/i);
});
test("Vault integrates keyed account isolation and post-await action guards", async () => {
  const source = await readFile(root + "src/components/game/vault-gump.tsx", "utf8");
  assert.match(source, /key=\{.*session/);
  assert.match(source, /walletScope\(identityKey/);
  assert.doesNotMatch(source, /const (LISTINGS|LEDGER)_KEY =/);
  for (const match of source.matchAll(/await (?:mint\w*Nft|redeemItemNft|sellItemNft|cancelItemNft)\([^\n]+\);\s*([^\n]+)/g)) {
    assert.match(match[1], /assertCurrent\(\)/, "each wallet action must guard its local continuation");
  }
});

for (const [type, content] of [["text/plain", "A non-game inscription"], ["image/png", new Uint8Array([137,80,78,71,255])], ["image/svg+xml", "<svg></svg>"]]) {
  test(`mixed wallet skips unrelated ${type} without hiding game holdings`, async () => {
    const n = type === "text/plain" ? 2101 : type === "image/png" ? 2102 : 2103;
    page([row(n), row(n + 100)]);
    globalThis.fetch = async (url) => String(url).includes((n + 100).toString(16).padStart(64, "0"))
      ? new Response(JSON.stringify({app:"emberhall",v:1,type:"item",item:"log",world:1,hour:1}), {headers:{"content-type":"application/json"}})
      : new Response(content, {headers:{"content-type":type}});
    const found = await adapter.listEmberhallNfts(ctx);
    assert.equal(found.length, 1);
    assert.equal(found[0].inscription.item, "log");
  });
}
test("JSON served as plain text is still decoded, malformed declared JSON rejects", async () => {
  page([row(2301)]);
  globalThis.fetch = async () => new Response(JSON.stringify({app:"emberhall",v:1,type:"item",item:"log",world:1,hour:1}));
  assert.equal((await adapter.listEmberhallNfts(ctx)).length, 1);
  page([row(2302)]);
  globalThis.fetch = async () => new Response('{"app":"emberhall",', {headers:{"content-type":"application/json"}});
  await assert.rejects(adapter.listEmberhallNfts(ctx), /JSON|position|property|end/i);
});
