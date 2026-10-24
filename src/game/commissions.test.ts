import assert from "node:assert/strict";
import test from "node:test";
import { COMMISSIONS, commandCommission, offerCommission, tickCommission } from "./commissions.ts";
import { commandTalk } from "./npcs.ts";
import { commandCraft, recipeById } from "./craft.ts";
import { you } from "./player.ts";
import { createWorld } from "./world.ts";

function fixture() {
  const w = createWorld(1);
  const npc = w.people.find((p) => p.role === "provisioner")!;
  const p = you(w)!; p.x = npc.x; p.z = npc.z;
  return { w, npc, p };
}

test("commission templates use existing ordinary crafting outputs", () => {
  assert.equal(COMMISSIONS.length, 3);
  for (const c of COMMISSIONS) assert.ok((recipeById(c.recipeId)?.give[c.item] ?? 0) > 0);
});

test("commission: talk, accept, existing craft, deliver, gold and completion log; no replay", () => {
  const { w, npc, p } = fixture();
  commandTalk(w, npc.id);
  assert.equal(w.player.commission?.status, "offered");
  assert.equal(commandCommission(w, npc.id, "accept"), null);
  const c = COMMISSIONS.find((c) => c.id === w.player.commission?.templateId)!;
  const yard = w.buildings.find((b) => b.kind === "yard")!;
  p.x = yard.tx; p.z = yard.ty;
  w.player.pack.board = 0; w.player.pack.log = 5;
  const random = Math.random; Math.random = () => 0;
  try { commandCraft(w, c.recipeId); } finally { Math.random = random; }
  assert.equal(w.player.pack.board, 2);
  p.x = npc.x; p.z = npc.z;
  const gold = w.gold;
  assert.equal(commandCommission(w, npc.id, "deliver"), null);
  assert.equal(w.player.pack.board, 0);
  assert.equal(w.gold, gold + c.reward);
  assert.equal(w.player.commission?.status, "completed");
  assert.ok(w.log.some((entry) => entry.text.includes("Commission complete")));
  assert.ok(commandCommission(w, npc.id, "deliver"));
  assert.equal(w.gold, gold + c.reward);
});

test("commission: cancel reoffers, only one active; expiry resets without payment", () => {
  const { w, npc } = fixture();
  commandTalk(w, npc.id); commandCommission(w, npc.id, "accept");
  const active = structuredClone(w.player.commission);
  const healer = w.people.find((p) => p.role === "healer")!;
  offerCommission(w, healer.id);
  assert.deepEqual(w.player.commission, active);
  assert.ok(commandCommission(w, healer.id, "accept"));
  assert.equal(commandCommission(w, npc.id, "cancel"), null);
  assert.equal(w.player.commission?.status, "offered");
  commandCommission(w, npc.id, "accept");
  w.hour = w.player.commission!.expiresAt!;
  const gold = w.gold;
  tickCommission(w);
  assert.equal(w.player.commission?.status, "offered");
  assert.ok(commandCommission(w, npc.id, "deliver"));
  assert.equal(w.gold, gold);
});

test("commission rejects missing goods, distant or wrong NPC, ghosts and stale deliveries", () => {
  const { w, npc, p } = fixture();
  assert.ok(commandCommission(w, npc.id, "accept"));
  commandTalk(w, npc.id); commandCommission(w, npc.id, "accept");
  w.player.pack.board = 0;
  assert.match(commandCommission(w, npc.id, "deliver")!, /Need/);
  w.player.pack.board = 2;
  const gold = w.gold;
  p.x += 20;
  assert.match(commandCommission(w, npc.id, "deliver")!, /closer/);
  p.x = npc.x;
  w.player.ghost = true;
  assert.match(commandCommission(w, npc.id, "deliver")!, /living/);
  w.player.ghost = false;
  assert.ok(commandCommission(w, "missing", "deliver"));
  w.hour = w.player.commission!.expiresAt!;
  assert.ok(commandCommission(w, npc.id, "deliver"));
  assert.equal(w.gold, gold);
  assert.equal(w.player.pack.board, 2);
});
