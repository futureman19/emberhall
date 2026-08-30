import assert from "node:assert/strict";
import test from "node:test";
import {
  VAULT_APP,
  applyMint,
  applyRedeem,
  decodeBase64Json,
  decodeItemInscription,
  encodeItemInscription,
  inscriptionBase64,
} from "./vault.ts";
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
