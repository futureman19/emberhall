import assert from "node:assert/strict";
import test from "node:test";
import { equipmentAction } from "./equipment-transfer.ts";
import { commandEquip, commandEquipRare, commandUnequip, you } from "./player.ts";
import { createWorld } from "./world.ts";

function fixture() {
  const world = createWorld(17);
  for (const id of Object.keys(world.player.pack) as (keyof typeof world.player.pack)[]) world.player.pack[id] = 0;
  Object.assign(world.player.pack, { sword: 2, mace: 1, bread: 1 });
  world.player.wear = { main: "hatchet" };
  world.player.wearRare = {};
  world.player.rares = [{ uid: "unique", base: "sword", affixes: ["of force"], seed: 1, hour: 1,
    workmanship: "ordinary", components: [], inlays: [], recipeId: "loot", recipeVersion: 1, source: "loot" }];
  return world;
}

test("equipment transfer rejects wrong slots, non-gear, ghosts, stale sources and canceled drops", () => {
  const w = fixture();
  const p = w.player;
  assert.equal(equipmentAction(p, false, { kind: "pack", id: "sword" }, "head"), null);
  assert.equal(equipmentAction(p, false, { kind: "pack", id: "bread" }, "main"), null);
  assert.equal(equipmentAction(p, true, { kind: "pack", id: "sword" }, "main"), null);
  assert.equal(equipmentAction(p, false, { kind: "pack", id: "shield" }, "off"), null);
  assert.equal(equipmentAction(p, false, { kind: "worn", slot: "main", id: "sword" }, "pack"), null);
  assert.equal(equipmentAction(p, false, { kind: "rare", uid: "missing" }, "main"), null);
  assert.equal(equipmentAction(p, false, { kind: "pack", id: "sword" }, null), null);
  assert.equal(equipmentAction(p, false, { kind: "pack", id: "sword" }, "pack"), null);
});

test("equipment transfer uses existing atomic commands for stacks, occupied slots and exact rare identity", () => {
  const w = fixture();
  const apply = (source: Parameters<typeof equipmentAction>[2], target: Parameters<typeof equipmentAction>[3]) => {
    const action = equipmentAction(w.player, Boolean(you(w)?.ghost), source, target);
    assert.ok(action);
    if (action.kind === "equip") commandEquip(w, action.id);
    else if (action.kind === "rare") commandEquipRare(w, action.uid);
    else commandUnequip(w, action.slot);
  };
  apply({ kind: "pack", id: "sword" }, "main");
  assert.equal(w.player.pack.sword, 1);
  assert.equal(w.player.pack.hatchet, 1);
  const rare = structuredClone(w.player.rares[0]);
  apply({ kind: "rare", uid: rare.uid }, "main");
  assert.equal(w.player.pack.sword, 2);
  assert.equal(w.player.wear.main, undefined);
  assert.equal(w.player.wearRare.main, rare.uid);
  assert.equal(equipmentAction(w.player, false, { kind: "rare", uid: rare.uid }, "main"), null);
  apply({ kind: "worn", slot: "main", uid: rare.uid }, "pack");
  assert.equal(w.player.wearRare.main, undefined);
  assert.deepEqual(w.player.rares, [rare]);
  apply({ kind: "rare", uid: rare.uid }, "main");
  apply({ kind: "pack", id: "mace" }, "main");
  assert.deepEqual(w.player.rares, [rare]);
  assert.equal(w.player.wearRare.main, undefined);
  apply({ kind: "worn", slot: "main", id: "mace" }, "pack");
  assert.equal(w.player.pack.mace, 1);
});
