import assert from "node:assert/strict";
import test from "node:test";
import { BANK_RANGE, BANK_SLOTS, commandBankGold, commandBankItem, commandDeposit, commandTalk, commandUnbankItem, commandWithdraw } from "./npcs.ts";
import { tickPlayer, you } from "./player.ts";
import { createWorld, seedEmberhallBank } from "./world.ts";
import { COURT, EMBERHALL_BANK } from "./atlas.ts";
import { verbsFor } from "./context.ts";
import { setWorld } from "./live.ts";
import type { World } from "./types.ts";

function bankerOf(w: World) {
  const b = w.people.find((p) => p.role === "banker" && p.name === "Old Pell");
  assert.ok(b, "Old Pell keeps the hall box");
  return b;
}

function standAtBank(w: World) {
  const self = you(w)!;
  const b = bankerOf(w);
  self.x = b.x;
  self.z = b.z;
}

function walkOff(w: World) {
  const self = you(w)!;
  const b = bankerOf(w);
  self.x = b.x + 20;
  self.z = b.z + 20;
}

test("bank - gold and goods move at the banker, not across the vale", () => {
  const w = createWorld();
  w.gold = 80;
  w.player.vault = 0;
  w.player.pack.log = 5;
  w.player.chest.log = 0;

  walkOff(w);
  assert.equal(commandDeposit(w, 10), "The banker is not here.");
  assert.equal(commandBankItem(w, "log", 5), "The banker is not here.");
  assert.equal(w.gold, 80);
  assert.equal(w.player.pack.log, 5);

  standAtBank(w);
  assert.equal(commandDeposit(w, 30), "The box holds 30 gold.");
  assert.equal(w.gold, 50);
  assert.equal(w.player.vault, 30);
  assert.equal(commandBankItem(w, "log", 5), "Into the box.");
  assert.equal(w.player.pack.log ?? 0, 0);
  assert.equal(w.player.chest.log, 5);
  assert.equal(commandUnbankItem(w, "log", 2), "Out of the box.");
  assert.equal(w.player.pack.log, 2);
  assert.equal(w.player.chest.log, 3);
});

test("bank - saying bank puts the purse in the box", () => {
  const w = createWorld();
  standAtBank(w);
  w.gold = 80;
  w.player.vault = 12;
  const note = commandBankGold(w);
  assert.equal(note, "The box holds 92 gold.");
  assert.equal(w.gold, 0);
  assert.equal(w.player.vault, 92);
  assert.equal(commandWithdraw(w, 20), "Purse 20.");
  assert.equal(w.gold, 20);
  assert.equal(w.player.vault, 72);
});

test("bank - the box is for the living", () => {
  const w = createWorld();
  standAtBank(w);
  w.player.ghost = true;
  you(w)!.ghost = true;
  w.gold = 40;
  w.player.vault = 10;
  w.player.pack.ore = 3;
  assert.match(commandTalk(w, bankerOf(w).id), /for the living/);
  assert.equal(commandBankGold(w), "The box is for the living.");
  assert.equal(commandWithdraw(w, 10), "The box is for the living.");
  assert.equal(commandBankItem(w, "ore"), "The box is for the living.");
  assert.equal(w.gold, 40);
  assert.equal(w.player.vault, 10);
  assert.equal(w.player.pack.ore, 3);
});

test("bank - death takes the purse, not the box", () => {
  const w = createWorld();
  standAtBank(w);
  w.gold = 30;
  w.player.vault = 77;
  w.player.pack.log = 8;
  w.player.chest.log = 12;
  w.player.chest.ore = 4;
  you(w)!.hp = 0;
  const note = tickPlayer(w, 0.016);
  assert.match(String(note), /You die/);
  assert.equal(w.player.vault, 77);
  assert.equal(w.player.chest.log, 12);
  assert.equal(w.player.chest.ore, 4);
  assert.equal(w.player.pack.log, 4);
  assert.equal(w.gold, 20);
});

test("bank - a full box takes no new kind", () => {
  const w = createWorld();
  standAtBank(w);
  w.player.pack.hatchet = 1;
  w.player.chest.hatchet = 0;
  const filled = { ...w.player.chest } as Record<string, number>;
  for (let i = 0; i < BANK_SLOTS; i++) filled[`slot${i}`] = 1;
  w.player.chest = filled as World["player"]["chest"];
  assert.equal(commandBankItem(w, "hatchet"), "The box is full.");
  assert.equal(w.player.pack.hatchet, 1);
  filled.log = 3;
  w.player.pack.log = 2;
  w.player.chest = filled as World["player"]["chest"];
  assert.equal(commandBankItem(w, "log", 2), "Into the box.");
  assert.equal(w.player.chest.log, 5);
});

test("bank - empty purse still names the balance", () => {
  const w = createWorld();
  standAtBank(w);
  w.gold = 0;
  w.player.vault = 15;
  assert.equal(commandBankGold(w), "The box holds 15 gold.");
});

test("bank - Emberhall keeps a bank on the spawn cobbles", () => {
  const w = createWorld();
  const bank = w.buildings.find((b) => b.kind === "bank");
  assert.ok(bank, "a bank stands by the hall");
  assert.equal(bank.tx, EMBERHALL_BANK.tx);
  assert.equal(bank.ty, EMBERHALL_BANK.ty);
  const self = you(w)!;
  const pell = bankerOf(w);
  assert.ok(Math.hypot(self.x - pell.x, self.z - pell.z) <= BANK_RANGE, "Pell is in reach of a new hall");
  w.gold = 40;
  w.player.vault = 0;
  assert.equal(commandBankGold(w), "The box holds 40 gold.");
  assert.equal(w.gold, 0);
  const n = w.buildings.filter((b) => b.kind === "bank").length;
  seedEmberhallBank(w);
  assert.equal(w.buildings.filter((b) => b.kind === "bank").length, n);
});

test("bank - the building opens the box, not a bench", () => {
  const w = createWorld();
  setWorld(w);
  const verbs = verbsFor({ kind: "building", id: "bank-1", tx: COURT.tx, ty: COURT.ty, label: "bank" });
  assert.ok(verbs.some((v) => v.verb === "bank" && v.label === "Open the box"));
  assert.ok(!verbs.some((v) => v.verb === "use"));
});
