import assert from "node:assert/strict";
import test from "node:test";
import { createPerson, createStubWorld, BRANN_BANDAGES, BRANN_NAME, BRANN_PAY, BRANN_WANT, RYN_NAME, RYN_PAY, RYN_WANT } from "./world.ts";
import { commandApproach, commandBuy, commandSell, commandSellRare, commandTalk } from "./npcs.ts";
import { commandCommission, offerCommission, tickCommission, COMMISSION_HOURS } from "./commissions.ts";
import { appraiseRare } from "./rare.ts";
import { ITEM_META } from "./catalog.ts";
import { tickWorld } from "./sim.ts";
import type { NpcRole, Person, World } from "./types.ts";

function fixture() {
  const world = createStubWorld();
  const solo = createPerson(world, () => 0.5, { x: 10, z: 10, isPlayer: true });
  const body = createPerson(world, () => 0.5, { x: 100, z: 100 });
  world.people = [solo, body];
  world.player.id = solo.id;
  const actor = structuredClone(world.player);
  actor.id = body.id;
  world.playerStates = { [body.id]: actor };
  world.hour = 100;
  world.gold = 100;
  return { world, solo, body, actor };
}

function keeper(world: World, role: NpcRole | null, x: number, z: number, name?: string): Person {
  const npc = createPerson(world, () => 0.5, { x, z, role: role ?? undefined, name });
  world.people.push(npc);
  return npc;
}

test("buy and sell settle on the selected actor's pack; gold stays shared", () => {
  const { world, body, actor } = fixture();
  keeper(world, "provisioner", 100, 100);
  const solo = structuredClone(world.player);
  const meta = ITEM_META.bandage;
  actor.pack.bandage = 0;
  assert.equal(commandBuy(world, "bandage", body.id), `Bought ${meta.label.toLowerCase()}.`);
  assert.equal(actor.pack.bandage, 1);
  assert.equal(world.gold, 100 - meta.buy);
  assert.equal(commandSell(world, "bandage", body.id), "Sold bandage.");
  assert.equal(actor.pack.bandage, 0);
  assert.equal(world.gold, 100 - meta.buy + meta.sell);
  assert.deepEqual(world.player, solo);
});

test("buy rejects keep gameplay validation and mutate nothing", () => {
  const { world, body, actor } = fixture();
  keeper(world, "provisioner", 100, 100);
  actor.pack.bandage = 0;
  const before = JSON.stringify(world);
  assert.equal(commandBuy(world, "cooked_fish", body.id), "They do not keep that.");
  const gold = world.gold;
  world.gold = 0;
  assert.equal(commandBuy(world, "bandage", body.id), `Need ${ITEM_META.bandage.buy} gold.`);
  world.gold = gold;
  body.x += 50;
  assert.equal(commandBuy(world, "bandage", body.id), "The keeper is not here.");
  body.x -= 50;
  actor.ghost = true;
  assert.equal(commandBuy(world, "bandage", body.id), "A ghost cannot.");
  actor.ghost = false;
  assert.equal(world.gold, gold);
  assert.equal(actor.pack.bandage, 0);
  assert.equal(JSON.stringify(world), before);
});

test("sell checks the actor's pack and the keeper's trade, never the solo pack", () => {
  const { world, body, actor } = fixture();
  keeper(world, "alchemist", 100, 100);
  actor.pack.log = 1;
  assert.equal(commandSell(world, "log", body.id), "They will not take it.");
  // The solo sheet carries the reagent; the actor does not.
  world.player.pack.garlic = 1;
  actor.pack.garlic = 0;
  assert.equal(commandSell(world, "garlic", body.id), "You do not carry that.");
  const gold = world.gold;
  actor.pack.garlic = 1;
  assert.match(commandSell(world, "garlic", body.id)!, /^Sold /);
  assert.equal(actor.pack.garlic, 0);
  assert.equal(world.gold, gold + ITEM_META.garlic.sell);
  assert.equal(world.player.pack.garlic, 1);
});

test("rare sale removes only the actor's own rare and worn link", () => {
  const { world, body, actor } = fixture();
  keeper(world, "provisioner", 100, 100);
  const rare = { uid: "actor-rare", base: "club" as const, affixes: ["of force"], seed: 7, hour: 0 };
  const soloRare = { uid: "solo-rare", base: "club" as const, affixes: ["of force"], seed: 9, hour: 0 };
  actor.rares = [rare];
  actor.wearRare.main = rare.uid;
  world.player.rares = [soloRare];
  const gold = world.gold;
  const note = commandSellRare(world, rare.uid, body.id)!;
  assert.match(note, /gold — and lucky to have it/);
  assert.equal(actor.rares.length, 0);
  assert.equal(actor.wearRare.main, undefined);
  assert.equal(world.gold, gold + appraiseRare(rare).total);
  assert.deepEqual(world.player.rares, [soloRare]);
  // Another actor's rare is not for sale; gold does not move.
  assert.equal(commandSellRare(world, soloRare.uid, body.id), "No such wonder.");
  assert.equal(world.gold, gold + appraiseRare(rare).total);
  assert.deepEqual(world.player.rares, [soloRare]);
});

test("approach routes the actor's body and intent, not the solo sheet's", () => {
  const { world, solo, body, actor } = fixture();
  const npc = keeper(world, "provisioner", 106, 100);
  assert.equal(commandApproach(world, npc.id, body.id), null);
  assert.ok(body.path.length > 0);
  assert.equal(actor.intent.kind, "walk");
  assert.equal(actor.intent.targetId, npc.id);
  assert.equal(world.player.intent.kind, "none");
  assert.equal(solo.path.length, 0);
});

test("Brann pays the talking actor from the shared purse, once per world", () => {
  const { world, solo, body, actor } = fixture();
  const brann = keeper(world, "provisioner", 100, 100, BRANN_NAME);
  world.player.pack.cooked_fish = 5;
  world.player.pack.bandage = 4;
  actor.pack.cooked_fish = 2;
  const gold = world.gold;
  const bandages = actor.pack.bandage ?? 0;
  const note = commandTalk(world, brann.id, body.id);
  assert.match(note, /You have my thanks/);
  assert.equal(actor.pack.cooked_fish, 0);
  assert.equal(actor.pack.bandage, bandages + BRANN_BANDAGES);
  assert.equal(world.gold, gold + BRANN_PAY);
  assert.equal(world.rep[BRANN_WANT], 1);
  assert.ok(world.quests.some((q) => q.id === BRANN_WANT && q.title === "Brann has his supper"));
  // The solo sheet never moved.
  assert.equal(world.player.pack.cooked_fish, 5);
  assert.equal(world.player.pack.bandage, 4);
  // Shared rep means no second payout — even for the other actor.
  solo.x = brann.x;
  solo.z = brann.z;
  const again = commandTalk(world, brann.id);
  assert.match(again, /I remember/);
  assert.equal(world.player.pack.cooked_fish, 5);
  assert.equal(world.gold, gold + BRANN_PAY);
});

test("Ryn's hide want debits the talking actor's pack only", () => {
  const { world, body, actor } = fixture();
  const ryn = keeper(world, null, 100, 100, RYN_NAME);
  world.player.pack.hide = 3;
  actor.pack.hide = 1;
  const gold = world.gold;
  const note = commandTalk(world, ryn.id, body.id);
  assert.match(note, /Don't sleep in the hollow/);
  assert.equal(actor.pack.hide, 0);
  assert.equal(world.player.pack.hide, 3);
  assert.equal(world.gold, gold + RYN_PAY);
  assert.equal(world.rep[RYN_WANT], 1);
  assert.match(commandTalk(world, ryn.id, body.id), /I remember/);
  assert.equal(world.gold, gold + RYN_PAY);
});

test("talk guards use the selected actor: range, ghost, missing target", () => {
  const { world, body, actor } = fixture();
  const brann = keeper(world, "provisioner", 100, 100, BRANN_NAME);
  assert.equal(commandTalk(world, "missing", body.id), "They are gone.");
  body.x += 10;
  assert.equal(commandTalk(world, brann.id, body.id), "Walk closer.");
  body.x -= 10;
  actor.pack.cooked_fish = 2;
  actor.ghost = true;
  body.ghost = true;
  const gold = world.gold;
  assert.match(commandTalk(world, brann.id, body.id)!, /dead keep no suppers/);
  assert.equal(actor.pack.cooked_fish, 2);
  assert.equal(world.gold, gold);
  assert.equal(world.rep[BRANN_WANT] ?? 0, 0);
});

test("healer talk heals or raises the actor's own body and sheet", () => {
  const { world, solo, body, actor } = fixture();
  const healer = keeper(world, "healer", 100, 100, "Hilde");
  body.hp = 5;
  solo.hp = 7;
  assert.match(commandTalk(world, healer.id, body.id)!, /wound closes/);
  assert.equal(body.hp, body.maxHp);
  assert.equal(solo.hp, 7);
  actor.ghost = true;
  body.ghost = true;
  assert.match(commandTalk(world, healer.id, body.id)!, /Blood remembers/);
  assert.equal(actor.ghost, false);
  assert.equal(body.ghost, false);
  assert.equal(Boolean(world.player.ghost), false);
  assert.equal(Boolean(solo.ghost), false);
});

test("commission lifecycle is actor-owned: offer, accept, deliver, no replay", () => {
  const { world, body, actor } = fixture();
  const kip = keeper(world, "provisioner", 100, 100, "Kip Test");
  commandTalk(world, kip.id, body.id);
  assert.equal(actor.commission?.status, "offered");
  assert.equal(actor.commission?.npcId, kip.id);
  assert.equal(world.player.commission, undefined);
  assert.equal(commandCommission(world, kip.id, "accept", body.id), null);
  assert.equal(actor.commission?.status, "active");
  assert.equal(actor.commission?.expiresAt, world.hour + COMMISSION_HOURS);
  actor.pack.board = 2;
  const gold = world.gold;
  assert.equal(commandCommission(world, kip.id, "deliver", body.id), null);
  assert.equal(actor.pack.board, 0);
  assert.equal(world.gold, gold + 8);
  assert.equal(actor.commission?.status, "completed");
  assert.equal(world.player.commission, undefined);
  // Duplicate delivery is rejected and the shared purse does not move again.
  assert.ok(commandCommission(world, kip.id, "deliver", body.id));
  assert.equal(world.gold, gold + 8);
  assert.equal(actor.pack.board, 0);
});

test("commission cancel re-offers; a second keeper cannot steal an active order", () => {
  const { world, body, actor } = fixture();
  const kip = keeper(world, "provisioner", 100, 100, "Kip Test");
  const hilde = keeper(world, "healer", 100, 100, "Hilde");
  commandTalk(world, kip.id, body.id);
  commandCommission(world, kip.id, "accept", body.id);
  const active = structuredClone(actor.commission);
  offerCommission(world, hilde.id, body.id);
  assert.deepEqual(actor.commission, active);
  assert.equal(commandCommission(world, hilde.id, "accept", body.id), "Speak to this keeper about work first.");
  assert.equal(commandCommission(world, kip.id, "cancel", body.id), null);
  assert.equal(actor.commission?.status, "offered");
  assert.equal(actor.commission?.expiresAt, null);
  assert.equal(world.player.commission, undefined);
});

test("commission validation rejects short packs, distance, ghosts and stale orders", () => {
  const { world, body, actor } = fixture();
  const kip = keeper(world, "provisioner", 100, 100, "Kip Test");
  assert.equal(commandCommission(world, kip.id, "accept", body.id), "Speak to this keeper about work first.");
  commandTalk(world, kip.id, body.id);
  commandCommission(world, kip.id, "accept", body.id);
  actor.pack.board = 1;
  assert.equal(commandCommission(world, kip.id, "deliver", body.id), "Need 2 board in your pack (1/2).");
  actor.pack.board = 2;
  body.x += 20;
  assert.equal(commandCommission(world, kip.id, "deliver", body.id), "Walk closer.");
  body.x -= 20;
  actor.ghost = true;
  assert.equal(commandCommission(world, kip.id, "deliver", body.id), "Commissions are for the living.");
  actor.ghost = false;
  assert.equal(commandCommission(world, "missing", "deliver", body.id), "The keeper is gone.");
  // Expiry rescinds the deadline before the deliver attempt is validated.
  actor.commission = { ...actor.commission!, expiresAt: world.hour };
  const gold = world.gold;
  assert.ok(commandCommission(world, kip.id, "deliver", body.id));
  assert.equal(world.gold, gold);
  assert.equal(actor.pack.board, 2);
  assert.equal(actor.commission?.status, "offered");
});

test("commission expiry ticks per actor and sim expires every actor exactly once", () => {
  const { world, body, actor } = fixture();
  const kip = keeper(world, "provisioner", 100, 100, "Kip Test");
  world.player.commission = { templateId: "boards", npcId: kip.id, status: "active", expiresAt: world.hour - 1 };
  actor.commission = { templateId: "boards", npcId: kip.id, status: "active", expiresAt: world.hour - 1 };
  tickCommission(world);
  assert.equal(world.player.commission?.status, "offered");
  assert.equal(actor.commission?.status, "active", "omitted-id tick must not touch the actor sheet");
  tickCommission(world, body.id);
  assert.equal(actor.commission?.status, "offered");
  // The world beat expires both sheets and never double-ticks the solo sheet.
  world.player.commission = { templateId: "boards", npcId: kip.id, status: "active", expiresAt: world.hour - 1 };
  actor.commission = { templateId: "boards", npcId: kip.id, status: "active", expiresAt: world.hour - 1 };
  world.playerStates = { [world.player.id]: world.player, [body.id]: actor };
  const expiriesBefore = world.log.filter((entry) => entry.text.includes("Commission expired")).length;
  tickWorld(world, 0.1);
  assert.equal(world.player.commission?.status, "offered");
  assert.equal(actor.commission?.status, "offered");
  const expiries = world.log.filter((entry) => entry.text.includes("Commission expired")).length;
  assert.equal(expiries - expiriesBefore, 2);
});

test("omitted id keeps the legacy solo trade path", () => {
  const { world, actor } = fixture();
  keeper(world, "provisioner", 10, 10);
  const sheet = structuredClone(actor);
  const meta = ITEM_META.bandage;
  const carried = world.player.pack.bandage ?? 0;
  assert.equal(commandBuy(world, "bandage"), `Bought ${meta.label.toLowerCase()}.`);
  assert.equal(world.player.pack.bandage, carried + 1);
  assert.equal(commandSell(world, "bandage"), "Sold bandage.");
  assert.equal(world.player.pack.bandage, carried);
  assert.deepEqual(actor, sheet);
});

test("unknown actor ids fail closed across trade and commission commands", () => {
  const { world, body } = fixture();
  const kip = keeper(world, "provisioner", 100, 100, "Kip Test");
  const before = JSON.stringify(world);
  const calls = [
    () => commandApproach(world, kip.id, "missing"),
    () => commandTalk(world, kip.id, "missing"),
    () => commandBuy(world, "bandage", "missing"),
    () => commandSell(world, "bandage", "missing"),
    () => commandSellRare(world, "uid", "missing"),
    () => commandCommission(world, kip.id, "accept", "missing"),
    () => offerCommission(world, kip.id, "missing"),
    () => tickCommission(world, "missing"),
  ];
  for (const call of calls) assert.throws(call, /Unknown actor/);
  assert.equal(JSON.stringify(world), before);
  void body;
});
