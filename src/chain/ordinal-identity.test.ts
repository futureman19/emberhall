import assert from "node:assert/strict";
import test from "node:test";
import { contentPointer, walletOrdinalIdentity } from "./ordinal-identity.ts";

const A = "a".repeat(64);
const B = "b".repeat(64);

test("ordinal identity - bare origin becomes the stable first outpoint", () => {
  assert.deepEqual(walletOrdinalIdentity({
    outpoint: `${A}.0`,
    tags: ["id:first_0", "origin", "type:application/json"],
  }), {
    trackingId: "first_0",
    origin: `${A}.0`,
    outpoint: `${A}.0`,
    listed: false,
  });
  assert.equal(contentPointer(`${A}.0`), `${A}_0`);
});

test("ordinal identity - spent output keeps origin but rotates tracking id", () => {
  assert.deepEqual(walletOrdinalIdentity({
    outpoint: `${B}.1`,
    tags: ["id:second_0", `origin:${A}.0`, "type:application/json"],
  }), {
    trackingId: "second_0",
    origin: `${A}.0`,
    outpoint: `${B}.1`,
    listed: false,
  });
});

test("ordinal identity - listed state and price come from wallet tags", () => {
  assert.deepEqual(walletOrdinalIdentity({
    outpoint: `${B}.2`,
    tags: ["id:list_0", `origin:${A}.0`, "ordlock", "price:75"],
  }), {
    trackingId: "list_0",
    origin: `${A}.0`,
    outpoint: `${B}.2`,
    listed: true,
    priceSats: 75,
  });
});

test("ordinal identity - malformed, ambiguous, and drifting listing tags fail closed", () => {
  const bad = [
    { outpoint: "bad", tags: ["id:a", "origin"] },
    { outpoint: `${A}.0`, tags: ["origin"] },
    { outpoint: `${A}.0`, tags: ["id:a", "id:b", "origin"] },
    { outpoint: `${A}.0`, tags: ["id:a", "origin", `origin:${B}.0`] },
    { outpoint: `${A}.0`, tags: ["id:a", "origin", "ordlock"] },
    { outpoint: `${A}.0`, tags: ["id:a", "origin", "price:10"] },
    { outpoint: `${A}.0`, tags: ["id:a", "origin", "ordlock", "price:0"] },
  ];
  for (const row of bad) assert.equal(walletOrdinalIdentity(row), null);
});
