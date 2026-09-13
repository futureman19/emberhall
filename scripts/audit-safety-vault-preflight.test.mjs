import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "../src/game/world.ts";
import { preflightItemRedeem } from "../src/chain/vault-preflight.ts";
import { VAULT_APP } from "../src/game/vault.ts";

test("redeem preflight rejects unsafe outcomes without live mutation or storage", () => {
  const world = createWorld();
  const before = structuredClone(world);
  const payload = { app: VAULT_APP, v: 1, type: "item", item: "log", world: world.seed, hour: world.hour };
  preflightItemRedeem(world, payload);
  assert.deepEqual(structuredClone(world), before);
  assert.throws(() => preflightItemRedeem(world, { ...payload, rare: {} }), /invalid|unsupported/);
  assert.deepEqual(structuredClone(world), before);
  world.gold = NaN;
  assert.throws(() => preflightItemRedeem(world, payload), /Invalid game state/);
  assert.equal(world.player.pack.log, before.player.pack.log);
});
