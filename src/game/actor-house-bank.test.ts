import assert from "node:assert/strict";
import test from "node:test";
import { createPerson, createStubWorld } from "./world.ts";
import { commandHouseItem, commandHouseTake, houseSiteError, placeHouse, playerHouse } from "./house.ts";
import { commandBankGold, commandBankItem, commandDeposit, commandUnbankItem, commandWithdraw, nearBank } from "./bank.ts";
import { encodeItemInscription, encodeRareInscription, inscriptionBase64 } from "./vault.ts";

function fixture() {
  const world = createStubWorld();
  const a = createPerson(world, () => 0.5, { x: 120, z: 120, isPlayer: true });
  const b = createPerson(world, () => 0.5, { x: 100, z: 100 });
  world.player.id = a.id;
  const sheet = { ...structuredClone(world.player), id: b.id };
  world.playerStates = { [a.id]: structuredClone(world.player), [b.id]: sheet };
  world.people = [a, b];
  world.buildings = [];
  world.plots = [];
  for (let z = 94; z <= 106; z++) for (let x = 94; x <= 106; x++) world.tiles[z]![x]!.kind = "grass";
  sheet.pack.deed_porch = 1;
  sheet.pack.log = 5;
  sheet.chest.log = 7;
  sheet.vault = 11;
  return { world, a, b, sheet };
}

test("second actor places and uses only its own house and pack, never the UO bank", () => {
  const { world, b, sheet } = fixture();
  const solo = structuredClone(world.player);
  const bank = structuredClone(sheet.chest);
  assert.equal(houseSiteError(world, "porch", 100, 100, b.id), null);
  assert.equal(placeHouse(world, "porch", 100, 100, b.id), null);
  const house = playerHouse(world, b.id)!;
  assert.ok(house);
  assert.equal(house.ownerId, b.id);
  assert.equal(playerHouse(world), null);
  assert.equal(sheet.pack.deed_porch, 0);
  assert.equal(commandHouseItem(world, house.id, "log", 3, b.id), "Into the chest.");
  assert.equal(commandHouseTake(world, house.id, "log", 1, b.id), "Out of the chest.");
  assert.equal(sheet.pack.log, 3);
  assert.equal(house.chest?.log, 2);
  assert.deepEqual(sheet.chest, bank);
  assert.deepEqual(world.player, solo);
  assert.equal(placeHouse(world, "porch", 101, 100, b.id), "You already have a house.");
});

test("house ownership, reach, ghost and missing-body guards use the selected actor", () => {
  const { world, a, b, sheet } = fixture();
  assert.equal(placeHouse(world, "porch", 100, 100, b.id), null);
  const house = playerHouse(world, b.id)!;
  a.x = b.x; a.z = b.z;
  assert.equal(commandHouseItem(world, house.id, "log"), "That house is not yours.");
  b.x += 10;
  assert.equal(commandHouseTake(world, house.id, "log", 1, b.id), "Walk closer.");
  sheet.ghost = true;
  assert.equal(commandHouseTake(world, house.id, "log", 1, b.id), "A ghost cannot.");
  sheet.ghost = false;
  world.people = [a];
  assert.equal(commandHouseTake(world, house.id, "log", 1, b.id), "No body.");
});

test("explicit body-only ghost cannot place or access house goods", () => {
  const { world, b, sheet } = fixture();
  b.ghost = true;
  assert.equal(placeHouse(world, "porch", 100, 100, b.id), "A ghost cannot.");
  assert.equal(sheet.pack.deed_porch, 1);
  b.ghost = false;
  assert.equal(placeHouse(world, "porch", 100, 100, b.id), null);
  const house = playerHouse(world, b.id)!;
  b.ghost = true;
  const before = structuredClone(sheet);
  assert.equal(commandHouseItem(world, house.id, "log", 1, b.id), "A ghost cannot.");
  assert.equal(commandHouseTake(world, house.id, "log", 1, b.id), "A ghost cannot.");
  assert.deepEqual(sheet, before);
});

test("NPC bank inventory and gold balance belong to the selected sheet", () => {
  const { world, b, sheet } = fixture();
  const banker = createPerson(world, () => 0.5, { x: b.x, z: b.z });
  banker.role = "banker";
  world.people.push(banker);
  const solo = structuredClone(world.player);
  assert.equal(nearBank(world), false);
  assert.equal(nearBank(world, b.id), true);
  assert.equal(commandBankItem(world, "log", 3, b.id), "Into the box.");
  assert.equal(commandUnbankItem(world, "log", 1, b.id), "Out of the box.");
  assert.equal(sheet.pack.log, 3);
  assert.equal(sheet.chest.log, 9);
  // Purse gold is still world-level; only the UO bank balance is actor-owned.
  world.gold = 20;
  assert.equal(commandDeposit(world, 5, b.id), "The box holds 16 gold.");
  assert.equal(commandWithdraw(world, 2, b.id), "Purse 17.");
  assert.equal(commandBankGold(world, b.id), "The box holds 31 gold.");
  assert.deepEqual(world.player, solo);
  b.x += 20;
  assert.equal(commandBankItem(world, "log", 1, b.id), "The banker is not here.");
  sheet.ghost = true;
  assert.equal(commandWithdraw(world, 1, b.id), "The box is for the living.");
});

test("bank building footprint and omitted ID retain legacy solo behavior", () => {
  const { world, a, b, sheet } = fixture();
  world.buildings.push({ id: "bank", kind: "bank", tx: b.x, ty: b.z, beds: [] });
  assert.equal(nearBank(world, b.id), true);
  assert.equal(nearBank(world), false);
  a.x = b.x; a.z = b.z;
  world.player.pack.log = 2;
  const before = structuredClone(sheet);
  assert.equal(commandBankItem(world, "log"), "Into the box.");
  assert.equal(commandUnbankItem(world, "log"), "Out of the box.");
  assert.deepEqual(sheet, before);
  world.player.ghost = true;
  assert.equal(commandBankItem(world, "log", 1, b.id), "Into the box.");
  assert.equal(commandBankItem(world, "log"), "The box is for the living.");
});

test("unknown actor IDs fail closed before house or bank mutations", () => {
  const { world } = fixture();
  const before = structuredClone(world);
  const calls = [
    () => playerHouse(world, "missing"),
    () => houseSiteError(world, "porch", 100, 100, "missing"),
    () => placeHouse(world, "porch", 100, 100, "missing"),
    () => commandHouseItem(world, "absent", "log", 1, "missing"),
    () => commandHouseTake(world, "absent", "log", 1, "missing"),
    () => nearBank(world, "missing"),
    () => commandBankItem(world, "log", 1, "missing"),
    () => commandUnbankItem(world, "log", 1, "missing"),
    () => commandDeposit(world, 1, "missing"),
    () => commandWithdraw(world, 1, "missing"),
    () => commandBankGold(world, "missing"),
  ];
  for (const call of calls) assert.throws(call, /Unknown actor/);
  assert.deepEqual(structuredClone(world), before);
});

test("Vault encoders read explicit payloads without reading or mutating either actor's keeping", () => {
  const { world, sheet } = fixture();
  const rare = { uid: "actor-b-rare", base: "club" as const, affixes: ["of force"], seed: 7, hour: 0 };
  sheet.rares = [rare];
  const before = structuredClone([world.player, sheet]);
  // These read-only helpers take item/rare data, not a player identity.
  assert.equal(encodeItemInscription(world, "log")?.item, "log");
  assert.ok(encodeRareInscription(world, rare));
  assert.deepEqual(encodeRareInscription(world, rare), encodeRareInscription({ ...world, player: sheet }, rare));
  assert.equal(inscriptionBase64(world, "log"), inscriptionBase64({ ...world, player: sheet }, "log"));
  assert.deepEqual([world.player, sheet], before);
});
