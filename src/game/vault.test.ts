import assert from "node:assert/strict";
import test from "node:test";
import {
  VAULT_APP,
  appendLedger,
  applyMint,
  applyMintRare,
  applyRedeem,
  decodeBase64Json,
  decodeItemInscription,
  encodeItemInscription,
  encodeRareInscription,
  inscriptionBase64,
  suggestSats,
  trackListing,
  untrackListing,
  type ItemInscription,
} from "./vault.ts";
import { AFFIXES, createCraftedItem } from "./rare.ts";
import { ITEM_META } from "./catalog.ts";
import { createWorld } from "./world.ts";
import type { ItemId, World } from "./types.ts";

function givePack(w: World, items: Partial<Record<ItemId, number>>) {
  w.player.pack = { ...items } as World["player"]["pack"];
}

test("vault - inscription round trip: encode → base64 → decode keeps the item", () => {
  const w = createWorld();
  const payload = encodeItemInscription(w, "sword")!;
  assert.equal(payload.app, VAULT_APP);
  assert.equal(payload.type, "item");
  assert.equal(payload.item, "sword");
  assert.equal(payload.label, "Sword");
  assert.equal(payload.world, w.seed);
  const b64 = inscriptionBase64(w, "sword")!;
  const back = decodeItemInscription(decodeBase64Json(b64))!;
  assert.deepEqual(back, payload);
});

test("vault - decode rejects foreign payloads and ghost items", () => {
  assert.equal(decodeItemInscription(null), null);
  assert.equal(decodeItemInscription({ app: "other", type: "item", item: "sword" }), null);
  assert.equal(decodeItemInscription({ app: VAULT_APP, type: "pin", item: "sword" }), null);
  assert.equal(decodeItemInscription({ app: VAULT_APP, type: "item", item: "excalibur" }), null);
  assert.equal(decodeItemInscription("not json"), null);
});

test("vault - v3 unique crafted identity is lossless and forged stats fail closed", () => {
  const world = createWorld();
  const crafted = createCraftedItem(world, {
    formId: "bow",
    base: "bow",
    workmanship: "exceptional",
    components: [
      { role: "body", resourceId: "redwood", form: "log", grade: "choice", amount: 5 },
      { role: "binding", resourceId: "common_cloth", form: "cloth", grade: "sound", amount: 1 },
    ],
    inlays: [{ resourceId: "ruby", clarity: "flawed" }],
    maker: "Ada",
    recipeId: "bow",
    recipeVersion: 1,
  });
  world.player.rares.push(crafted);
  const payload = encodeRareInscription(world, crafted)!;
  assert.equal(payload.v, 3);
  assert.deepEqual(payload.rare?.unique?.components, crafted.components);
  assert.deepEqual(payload.rare?.unique?.inlays, crafted.inlays);
  assert.deepEqual(payload.rare?.unique?.resolvedStats, crafted.resolvedStats);

  const decoded = decodeItemInscription(decodeBase64Json(inscriptionBase64(world, crafted.base, crafted)!));
  assert.ok(decoded?.rare?.unique);
  applyMintRare(world, crafted.uid);
  assert.equal(world.player.rares.length, 0);
  applyRedeem(world, decoded!.item, decoded!.rare);
  assert.deepEqual(world.player.rares[0], crafted);

  const forged = structuredClone(payload) as any;
  forged.rare.unique.resolvedStats.damage = 999;
  assert.equal(decodeItemInscription(forged), null);
});

test("vault - mint removes exactly one from the pack and refuses an empty slot", () => {
  const w = createWorld();
  givePack(w, { mail: 2 });
  const note = applyMint(w, "mail");
  assert.ok(note?.includes("Mail"), `minted: ${note}`);
  assert.equal(w.player.pack.mail, 1);
  givePack(w, { mail: 0 });
  assert.equal(applyMint(w, "mail"), "No mail to mint.");
});

test("vault - redeem returns the item to the pack", () => {
  const w = createWorld();
  givePack(w, { ring: 1 });
  applyRedeem(w, "ring");
  assert.equal(w.player.pack.ring, 2);
});

test("vault - a ghost cannot mint", () => {
  const w = createWorld();
  w.player.ghost = true;
  givePack(w, { sword: 1 });
  assert.equal(applyMint(w, "sword"), "A ghost cannot.");
  assert.equal(w.player.pack.sword, 1);
});

test("vault polish - the whisper: mundane sats follow the shop, wonders weigh rank", () => {
  const w = createWorld();
  const plain = encodeItemInscription(w, "sword")!;
  // Half the shop's gold (floored at five), rounded to fives only at the end.
  const prePlain = Math.max(5, Math.round(ITEM_META.sword.buy / 2));
  const expectPlain = Math.max(5, Math.round(prePlain / 5) * 5);
  assert.equal(suggestSats(plain), expectPlain);
  // A wonder doubles the base, adds 15 per rank, and 10 for a maker's mark.
  const affix = Object.keys(AFFIXES)[0];
  const rare = encodeRareInscription(w, {
    uid: "u1", base: "sword", affixes: [affix], maker: "Brunhilde", seed: 1, hour: 2,
  })!;
  const rank = AFFIXES[affix].rank;
  const expectRare = Math.max(5, Math.round((prePlain * 2 + 15 * rank + 10) / 5) * 5);
  assert.equal(suggestSats(rare), expectRare);
  assert.ok(suggestSats(rare) > suggestSats(plain));
  // Unknown item ids fall back to a token ten.
  const bogus = { ...plain, item: "nonexistent" as ItemId } as ItemInscription;
  assert.equal(suggestSats(bogus), 10);
});

test("vault polish - the ledger remembers its last rites", () => {
  let book: ReturnType<typeof appendLedger> = [];
  for (let i = 0; i < 30; i++) book = appendLedger(book, { at: i, kind: "mint", label: `item ${i}` });
  assert.equal(book.length, 24);
  assert.equal(book[book.length - 1].label, "item 29");
  assert.equal(book[0].label, "item 6");
});

test("vault polish - listings track, retag, and untrack", () => {
  let list: ReturnType<typeof trackListing> = [];
  list = trackListing(list, { id: "a_0", label: "Sword", sats: 25, at: 1 });
  list = trackListing(list, { id: "b_1", label: "Hatchet", sats: 5, at: 2 });
  // Re-listing the same id replaces the note, never duplicates.
  list = trackListing(list, { id: "a_0", label: "Sword", sats: 40, at: 3 });
  assert.equal(list.length, 2);
  assert.equal(list.find((t) => t.id === "a_0")!.sats, 40);
  list = untrackListing(list, "a_0");
  assert.deepEqual(list.map((t) => t.id), ["b_1"]);
});
