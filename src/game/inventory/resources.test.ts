import assert from "node:assert/strict";
import test from "node:test";
import type { ResourceStackKey } from "../types.ts";
import { settleGear } from "../catalog.ts";
import { createWorld } from "../world.ts";
import {
  addResource,
  countPlayerResource,
  createResourceInventory,
  debitPlayerResources,
  debitResources,
  makeResourceStackKey,
  parseResourceInventory,
  parseResourceStackKey,
  resourceCount,
  takeResource,
} from "./resources.ts";

const OAK_LOG = makeResourceStackKey("oak", "log", "sound");
const IRON_ORE = makeResourceStackKey("iron_ore", "ore", "sound");
const REDWOOD_LOG = makeResourceStackKey("redwood", "log", "choice");
const RUBY = makeResourceStackKey("ruby", "gem", "flawless");

// Compile-time treaty: resource, form, and quality stay correlated.
const legalKey: ResourceStackKey = "ruby:gem:flawless";
void legalKey;
function compileTimeCorrelationTreaty() {
  // @ts-expect-error ruby cannot be a log or use a material grade
  const impossibleRuby: ResourceStackKey = "ruby:log:rough";
  // @ts-expect-error oak cannot be a gem or use gem clarity
  const impossibleOak: ResourceStackKey = "oak:gem:flawless";
  // @ts-expect-error gems use clarity, never material grades
  const impossibleRubyQuality: ResourceStackKey = "ruby:gem:rough";
  // @ts-expect-error timber uses material grades, never gem clarity
  const impossibleOakQuality: ResourceStackKey = "oak:log:flawless";
  // @ts-expect-error the constructor carries the same correlation
  makeResourceStackKey("ruby", "log", "rough");
  void impossibleRuby;
  void impossibleOak;
  void impossibleRubyQuality;
  void impossibleOakQuality;
}
void compileTimeCorrelationTreaty;

test("resource inventory - constructs and parses only correlated catalog keys", () => {
  assert.equal(OAK_LOG, "oak:log:sound");
  assert.equal(parseResourceStackKey("ruby:gem:flawless"), "ruby:gem:flawless");
  assert.throws(() => parseResourceStackKey("ruby:log:rough"), /form log is incompatible with resource ruby/);
  assert.throws(() => parseResourceStackKey("oak:gem:flawless"), /form gem is incompatible with resource oak/);
  assert.throws(() => parseResourceStackKey("oak:log:flawless"), /quality flawless is incompatible with resource oak/);
  assert.throws(() => parseResourceStackKey("bogwood:log:sound"), /unknown resource id: bogwood/);
  assert.throws(() => parseResourceStackKey("oak:log"), /invalid resource stack key: oak:log/);
  assert.throws(() => parseResourceStackKey(Object.create({ toString: () => OAK_LOG })), /resource stack key must be a string/);
});

test("resource inventory - exact count, add, and take keep canonical sparse stacks", () => {
  const inventory = createResourceInventory();
  assert.deepEqual(inventory, { stacks: {} });
  assert.equal(resourceCount(inventory, OAK_LOG), 0);

  assert.equal(addResource(inventory, OAK_LOG, 3), 3);
  assert.equal(addResource(inventory, OAK_LOG, 2), 5);
  assert.equal(resourceCount(inventory, OAK_LOG), 5);
  assert.equal(resourceCount(inventory, REDWOOD_LOG), 0);

  assert.equal(takeResource(inventory, OAK_LOG, 2), true);
  assert.equal(resourceCount(inventory, OAK_LOG), 3);
  assert.equal(takeResource(inventory, OAK_LOG, 3), true);
  assert.deepEqual(inventory, { stacks: {} });
});

test("resource inventory - new and normalized players start sparse without moving legacy pack", () => {
  const world = createWorld();
  assert.deepEqual(world.player.resources, { stacks: {} });

  world.player.pack.log = 4;
  world.player.pack.ore = 3;
  const legacyPlayer = world.player as unknown as Parameters<typeof settleGear>[0];
  delete legacyPlayer.resources;
  settleGear(legacyPlayer);

  assert.deepEqual(world.player.resources, { stacks: {} });
  assert.equal(world.player.pack.log, 4);
  assert.equal(world.player.pack.ore, 3);
});

test("resource inventory - invalid amounts and insufficient takes never mutate", () => {
  const invalid = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1];
  for (const amount of invalid) {
    const inventory = createResourceInventory({ [OAK_LOG]: 4 });
    const before = JSON.stringify(inventory);
    assert.throws(() => addResource(inventory, OAK_LOG, amount), /amount must be a positive safe integer/);
    assert.equal(JSON.stringify(inventory), before);
    assert.throws(() => takeResource(inventory, OAK_LOG, amount), /amount must be a positive safe integer/);
    assert.equal(JSON.stringify(inventory), before);
  }

  const inventory = createResourceInventory({ [OAK_LOG]: 2 });
  const before = JSON.stringify(inventory);
  assert.equal(takeResource(inventory, OAK_LOG, 3), false);
  assert.equal(JSON.stringify(inventory), before);
});

test("resource inventory - multi-stack debit is atomic and aggregates duplicates", () => {
  const inventory = createResourceInventory({ [OAK_LOG]: 5, [RUBY]: 2 });
  assert.equal(
    debitResources(inventory, [
      { key: OAK_LOG, amount: 2 },
      { key: RUBY, amount: 1 },
      { key: OAK_LOG, amount: 3 },
    ]),
    true,
  );
  assert.deepEqual(inventory, { stacks: { [RUBY]: 1 } });

  const insufficient = createResourceInventory({ [OAK_LOG]: 4, [RUBY]: 1 });
  const before = JSON.stringify(insufficient);
  assert.equal(
    debitResources(insufficient, [
      { key: OAK_LOG, amount: 3 },
      { key: OAK_LOG, amount: 2 },
      { key: RUBY, amount: 1 },
    ]),
    false,
  );
  assert.equal(JSON.stringify(insufficient), before);

  const malformed = createResourceInventory({ [OAK_LOG]: 4 });
  const malformedBefore = JSON.stringify(malformed);
  assert.throws(
    () => debitResources(malformed, [{ key: "ruby:log:rough" as ResourceStackKey, amount: 1 }]),
    /form log is incompatible with resource ruby/,
  );
  assert.equal(JSON.stringify(malformed), malformedBefore);
});

test("resource inventory - parser accepts canonical positive entries only", () => {
  assert.deepEqual(parseResourceInventory({ stacks: { [OAK_LOG]: 3, [RUBY]: 1 } }), {
    stacks: { [OAK_LOG]: 3, [RUBY]: 1 },
  });
  for (const count of [0, -1, 1.25, Number.MAX_SAFE_INTEGER + 1, "3"]) {
    assert.throws(
      () => parseResourceInventory({ stacks: { [OAK_LOG]: count } }),
      /resource stack count must be a positive safe integer/,
    );
  }
  assert.throws(() => parseResourceInventory({}), /resource inventory must have own stacks/);
  assert.throws(
    () => parseResourceInventory({ stacks: {}, extra: { smuggled: true } }),
    /resource inventory must contain only own stacks/,
  );
  assert.throws(
    () => parseResourceInventory(Object.create({ stacks: { [OAK_LOG]: 1 } })),
    /resource inventory must be a plain object/,
  );
  const nullPrototypeInventory = Object.create(null) as Record<string, unknown>;
  nullPrototypeInventory.stacks = { [OAK_LOG]: 1 };
  assert.deepEqual(parseResourceInventory(nullPrototypeInventory), { stacks: { [OAK_LOG]: 1 } });
  assert.throws(() => parseResourceInventory({ stacks: [] }), /resource stacks must be a plain object/);
});

test("resource inventory - debits reject unknown own fields", () => {
  const inventory = createResourceInventory({ [OAK_LOG]: 2 });
  const before = JSON.stringify(inventory);

  assert.throws(
    () => debitResources(inventory, [{ key: OAK_LOG, amount: 1, extra: true } as never]),
    /resource debit must contain only own key and amount/,
  );
  assert.equal(JSON.stringify(inventory), before);
});

test("resource inventory - legacy adapters count exact typed plus only matching generic stacks", () => {
  const player = {
    resources: createResourceInventory({ [OAK_LOG]: 2, [IRON_ORE]: 1, [REDWOOD_LOG]: 4, [RUBY]: 2 }),
    pack: { log: 3, ore: 5 },
  };

  assert.equal(countPlayerResource(player, OAK_LOG), 5);
  assert.equal(countPlayerResource(player, IRON_ORE), 6);
  assert.equal(countPlayerResource(player, REDWOOD_LOG), 4);
  assert.equal(countPlayerResource(player, makeResourceStackKey("oak", "board", "sound")), 0);
  assert.equal(countPlayerResource(player, RUBY), 2);
});

test("resource inventory - legacy debit uses typed first, falls back atomically, and never leaks", () => {
  const player = {
    resources: createResourceInventory({ [OAK_LOG]: 2, [IRON_ORE]: 1, [REDWOOD_LOG]: 1 }),
    pack: { log: 3, ore: 4 },
  };
  assert.equal(
    debitPlayerResources(player, [
      { key: OAK_LOG, amount: 4 },
      { key: IRON_ORE, amount: 3 },
    ]),
    true,
  );
  assert.deepEqual(player.resources.stacks, { [REDWOOD_LOG]: 1 });
  assert.deepEqual(player.pack, { log: 1, ore: 2 });

  const noLeak = {
    resources: createResourceInventory({ [REDWOOD_LOG]: 1 }),
    pack: { log: 99, ore: 99 },
  };
  const before = JSON.stringify(noLeak);
  assert.equal(debitPlayerResources(noLeak, [{ key: REDWOOD_LOG, amount: 2 }]), false);
  assert.equal(JSON.stringify(noLeak), before);
  assert.equal(debitPlayerResources(noLeak, [{ key: RUBY, amount: 1 }]), false);
  assert.equal(JSON.stringify(noLeak), before);

  const duplicateFailure = {
    resources: createResourceInventory({ [OAK_LOG]: 1 }),
    pack: { log: 2, ore: 0 },
  };
  const duplicateBefore = JSON.stringify(duplicateFailure);
  assert.equal(
    debitPlayerResources(duplicateFailure, [
      { key: OAK_LOG, amount: 2 },
      { key: OAK_LOG, amount: 2 },
    ]),
    false,
  );
  assert.equal(JSON.stringify(duplicateFailure), duplicateBefore);
});
