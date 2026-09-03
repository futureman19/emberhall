import assert from "node:assert/strict";
import test from "node:test";
import { getNpcInteractionFx, NPC_INTERACTION_DURATION, NPC_INTERACTION_LABEL, npcInteractionPose } from "./npc-interaction-animation.ts";
import { commandBankItem, commandBuy, commandDeposit, commandSell, commandTalk, commandUnbankItem, commandWithdraw } from "./npcs.ts";
import { you } from "./player.ts";
import { recruitPerson } from "./sim.ts";
import { createWorld } from "./world.ts";

function transferFx(world: ReturnType<typeof createWorld>) {
  const fx = getNpcInteractionFx(world);
  assert.ok(fx?.kind === "trade" || fx?.kind === "bank");
  return fx;
}

test("npc interaction animation - five profiles are bounded and distinct", () => {
  const kinds = ["talk", "heal", "trade", "bank", "recruit"] as const;
  const poses = kinds.map((kind) => npcInteractionPose(kind, NPC_INTERACTION_DURATION / 2));
  assert.equal(new Set(poses.map((pose) => JSON.stringify(pose))).size, kinds.length);
  assert.deepEqual(npcInteractionPose("talk", 0), { bow: 0, reach: 0, lift: 0, turn: 0 });
  assert.deepEqual(npcInteractionPose("talk", NPC_INTERACTION_DURATION), { bow: 0, reach: 0, lift: 0, turn: 0 });
  assert.equal(NPC_INTERACTION_LABEL.heal, "Restored");
});

test("npc interaction animation - talk and healing emit on the addressed NPC", () => {
  const world = createWorld();
  const player = you(world)!;
  const healer = world.people.find((person) => person.role === "healer")!;
  player.x = healer.x;
  player.z = healer.z;
  player.hp = 1;
  assert.match(commandTalk(world, healer.id), /wound closes/);
  assert.equal(player.hp, player.maxHp);
  assert.deepEqual(getNpcInteractionFx(world), { kind: "heal", targetId: healer.id, x: healer.x, z: healer.z, at: world.hour });

  const banker = world.people.find((person) => person.role === "banker")!;
  player.x = banker.x;
  player.z = banker.z;
  assert.match(commandTalk(world, banker.id), /Gold in, gold out/);
  assert.equal(getNpcInteractionFx(world)?.kind, "talk");
  assert.equal(getNpcInteractionFx(world)?.targetId, banker.id);
});

test("npc interaction animation - buying and selling preserve transfers and direction", () => {
  const world = createWorld();
  world.gold = 500;
  const before = world.player.pack.bandage ?? 0;
  assert.match(commandBuy(world, "bandage"), /Bought bandage/);
  assert.equal(world.player.pack.bandage, before + 1);
  assert.equal(getNpcInteractionFx(world)?.kind, "trade");
  assert.equal(transferFx(world).direction, "out");
  assert.equal(transferFx(world).item, "bandage");

  world.player.pack.log = 1;
  const gold = world.gold;
  assert.equal(commandSell(world, "log"), "Sold log.");
  assert.equal(world.player.pack.log, 0);
  assert.ok(world.gold > gold);
  assert.equal(transferFx(world).direction, "in");
  assert.equal(transferFx(world).item, "log");
});

test("npc interaction animation - bank gold and item directions preserve balances", () => {
  const world = createWorld();
  const player = you(world)!;
  const banker = world.people.find((person) => person.role === "banker")!;
  player.x = banker.x;
  player.z = banker.z;
  world.gold = 50;
  world.player.vault = 0;
  assert.equal(commandDeposit(world, 20), "The box holds 20 gold.");
  assert.equal(transferFx(world).direction, "in");
  assert.equal(transferFx(world).item, "gold");
  assert.equal(commandWithdraw(world, 10), "Purse 40.");
  assert.equal(transferFx(world).direction, "out");

  world.player.pack.log = 2;
  assert.equal(commandBankItem(world, "log", 2), "Into the box.");
  assert.equal(world.player.chest.log, 2);
  assert.equal(transferFx(world).direction, "in");
  assert.equal(commandUnbankItem(world, "log", 1), "Out of the box.");
  assert.equal(world.player.pack.log, 1);
  assert.equal(transferFx(world).direction, "out");
});

test("npc interaction animation - recruitment emits only after membership commits", () => {
  const world = createWorld();
  const candidate = world.people.find((person) => !person.member && !person.role)!;
  assert.ok(candidate);
  world.gold = 40;
  assert.match(recruitPerson(world, candidate.id), /stands with the hall/);
  assert.equal(candidate.member, true);
  assert.equal(world.gold, 20);
  assert.deepEqual(getNpcInteractionFx(world), { kind: "recruit", targetId: candidate.id, x: candidate.x, z: candidate.z, at: world.hour });
});

test("npc interaction animation - rejected transactions emit nothing", () => {
  const world = createWorld();
  world.gold = 0;
  assert.match(commandBuy(world, "bandage"), /Need/);
  assert.equal(getNpcInteractionFx(world), null);
  assert.equal(getNpcInteractionFx(createWorld()), null);
});
