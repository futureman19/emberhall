import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import {
  CURRENT_SAVE_VERSION,
  SAVE_KEY,
  clearSave,
  flushQueuedSave,
  hasSave,
  loadSave,
  queueSave,
  writeSave,
} from "./save.ts";
import { createWorld } from "./world.ts";
import { addResource, makeResourceStackKey } from "./inventory/resources.ts";
import { LOOK_SCHEMA } from "./look/types.ts";
import { depleteResourceNode, discoverResourceNode } from "./resources/state.ts";
import { resolveResourceNode } from "./resources/nodes.ts";
import { createCraftedItem } from "./rare.ts";

class MemoryStorage {
  #values = new Map<string, string>();

  getItem(key: string) {
    return this.#values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.#values.set(key, String(value));
  }

  removeItem(key: string) {
    this.#values.delete(key);
  }
}

const originalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalIdleDescriptor = Object.getOwnPropertyDescriptor(globalThis, "requestIdleCallback");
const originalCancelIdleDescriptor = Object.getOwnPropertyDescriptor(globalThis, "cancelIdleCallback");

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
});

afterEach(() => {
  flushQueuedSave();
  if (originalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalStorageDescriptor);
  } else {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
  if (originalIdleDescriptor) Object.defineProperty(globalThis, "requestIdleCallback", originalIdleDescriptor);
  else delete (globalThis as { requestIdleCallback?: typeof requestIdleCallback }).requestIdleCallback;
  if (originalCancelIdleDescriptor) Object.defineProperty(globalThis, "cancelIdleCallback", originalCancelIdleDescriptor);
  else delete (globalThis as { cancelIdleCallback?: typeof cancelIdleCallback }).cancelIdleCallback;
});

const persistedFixture = (() => {
  const { tiles: _tiles, ...world } = createWorld();
  return { ...world, tiles: null };
})();

function persistedWorld() {
  return structuredClone(persistedFixture);
}

function currentSave(): Record<string, unknown> {
  return { ...persistedWorld(), saveVersion: CURRENT_SAVE_VERSION };
}

function record(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function v1Save(): Record<string, unknown> {
  const save = persistedWorld();
  delete record(save.player).resources;
  delete record(save).resourceNodes;
  return { ...save, saveVersion: 1 };
}

function v2Save(): Record<string, unknown> {
  const save = persistedWorld();
  delete record(save).resourceNodes;
  return { ...save, saveVersion: 2 };
}

function hareFixture() {
  return {
    id: "legacy-hare",
    kind: "hare",
    x: 20,
    z: 21,
    hp: 8,
    maxHp: 8,
    path: [],
    task: "wander",
    taskUntil: 0,
    corpseUntil: 0,
    home: { tx: 20, ty: 21 },
    ownerId: null,
    loyalty: 0,
    stay: false,
    name: null,
    warnedLoyal: false,
  };
}

test("save - writes an explicit schema version without generated tiles", () => {
  const world = createWorld();
  writeSave(world);

  assert.equal(hasSave(), true);
  const stored = JSON.parse(localStorage.getItem(SAVE_KEY)!);
  assert.equal(CURRENT_SAVE_VERSION, 4);
  assert.equal(stored.saveVersion, 4);
  assert.equal(stored.tiles, null);
  assert.equal(stored.seed, world.seed);
  assert.deepEqual(stored.player.resources, { stacks: {} });
  assert.deepEqual(stored.resourceNodes, {});

  clearSave();
  assert.equal(hasSave(), false);
});

test("save - queued persistence snapshots the cadence state and serializes only during idle", () => {
  let idle: IdleRequestCallback | null = null;
  Object.defineProperty(globalThis, "requestIdleCallback", {
    configurable: true,
    value: (callback: IdleRequestCallback) => {
      idle = callback;
      return 41;
    },
  });
  Object.defineProperty(globalThis, "cancelIdleCallback", { configurable: true, value: () => undefined });
  const world = createWorld();
  world.gold = 111;
  queueSave(world);
  world.gold = 222;
  assert.equal(localStorage.getItem(SAVE_KEY), null, "active frame performs no stringify or storage write");
  assert.ok(idle);
  (idle as unknown as IdleRequestCallback)({ didTimeout: false, timeRemaining: () => 10 });
  assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)!).gold, 111, "idle write keeps the exact queued snapshot");
});

test("save - lifecycle flush commits a queued snapshot before idle", () => {
  Object.defineProperty(globalThis, "requestIdleCallback", { configurable: true, value: () => 42 });
  Object.defineProperty(globalThis, "cancelIdleCallback", { configurable: true, value: () => undefined });
  const world = createWorld();
  world.gold = 333;
  queueSave(world);
  flushQueuedSave();
  assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)!).gold, 333);
});

test("save - a newer immediate write cannot be overwritten by an older idle callback", () => {
  let idle: IdleRequestCallback | null = null;
  Object.defineProperty(globalThis, "requestIdleCallback", {
    configurable: true,
    value: (callback: IdleRequestCallback) => {
      idle = callback;
      return 43;
    },
  });
  Object.defineProperty(globalThis, "cancelIdleCallback", { configurable: true, value: () => undefined });
  const world = createWorld();
  world.gold = 444;
  queueSave(world);
  world.gold = 555;
  writeSave(world);
  (idle as unknown as IdleRequestCallback)({ didTimeout: false, timeRemaining: () => 10 });
  assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)!).gold, 555);
});

test("save - current-version write and load round-trip preserves representative state", () => {
  const world = createWorld();
  world.hour = 20;
  world.gold = 321;
  world.weather.wet = 0.75;
  world.player.pack.log = 4;
  addResource(world.player.resources, makeResourceStackKey("redwood", "board", "choice"), 3);
  world.player.marks.push({ id: "mark-home", tx: 12, ty: 34, name: "Home" });
  world.player.rares.push({
    uid: "rare-1",
    base: "sword",
    affixes: ["of power"],
    maker: "Ada",
    seed: 7,
    hour: 9,
  });
  world.campfires.push({ id: "fire-1", tx: 8, ty: 9, until: 14 });
  const look = {
    schema: LOOK_SCHEMA,
    cls: "ranger" as const,
    skin: "#96795d",
    hairStyle: "crop" as const,
    hairColor: "#4a2b20",
    garb: "#526b54",
    parts: ["u_roundtrip_cloak"],
  };
  world.people[0]!.look = look;
  const tree = { seed: world.seed, tx: 188, ty: 88, nodeKind: "tree" } as const;
  const rock = { seed: world.seed, tx: 470, ty: 420, nodeKind: "rock" } as const;
  world.resourceNodes = discoverResourceNode({ ...tree, hour: 10, resourceNodes: world.resourceNodes });
  world.resourceNodes = depleteResourceNode({ ...rock, hour: 12, resourceNodes: world.resourceNodes });
  world.tiles[rock.ty]![rock.tx]!.kind = "dirt";
  world.scars[`${rock.tx},${rock.ty}`] = { kind: "dirt" };

  writeSave(world);
  const loaded = loadSave();

  assert.ok(loaded);
  assert.equal(loaded.gold, 321);
  assert.equal(loaded.weather.wet, 0.75);
  assert.equal(loaded.player.pack.log, 4);
  assert.deepEqual(loaded.player.resources, world.player.resources);
  assert.deepEqual(loaded.player.marks, world.player.marks);
  assert.equal(loaded.player.rares[0]?.source, "legacy");
  assert.equal(loaded.player.rares[0]?.workmanship, "ordinary");
  assert.deepEqual(loaded.player.rares[0]?.affixes, world.player.rares[0]?.affixes);
  assert.deepEqual(loaded.campfires, world.campfires);
  assert.deepEqual(loaded.people[0]!.look, look);
  assert.deepEqual(loaded.resourceNodes, world.resourceNodes);
  assert.equal(Object.isFrozen(loaded.resourceNodes), true);
  assert.equal(Object.values(loaded.resourceNodes).every(Object.isFrozen), true);
  const treeId = resolveResourceNode(tree).identity.nodeId;
  const rockId = resolveResourceNode(rock).identity.nodeId;
  assert.equal(loaded.resourceNodes[treeId]?.depletedAtHour, null);
  assert.equal(loaded.resourceNodes[rockId]?.depletedAtHour, 12);
  assert.equal(loaded.tiles[rock.ty]![rock.tx]!.kind, "dirt");
  assert.equal(loaded.restored, true);
  assert.ok(Array.isArray(loaded.tiles));
});

test("save - v4 crafted identity round-trips canonically and rejects forged resolved stats", () => {
  const world = createWorld();
  const crafted = createCraftedItem(world, {
    formId: "bow",
    base: "bow",
    workmanship: "fine",
    components: [
      { role: "body", resourceId: "redwood", form: "log", grade: "choice", amount: 5 },
      { role: "binding", resourceId: "common_cloth", form: "cloth", grade: "sound", amount: 1 },
    ],
    inlays: [{ resourceId: "ruby", clarity: "flawed" }],
    maker: "Ada",
    recipeId: "bow",
    recipeVersion: 1,
  });
  world.player.rares.push(crafted);
  writeSave(world);
  const loaded = loadSave();
  assert.ok(loaded);
  assert.deepEqual(loaded.player.rares[0], crafted);

  const forged = JSON.parse(localStorage.getItem(SAVE_KEY)!);
  forged.player.rares[0].resolvedStats.damage = 999;
  localStorage.setItem(SAVE_KEY, JSON.stringify(forged));
  assert.equal(loadSave(), null);
});

test("save - migrates valid v1 through v2 to v3 without rewriting a person's look", () => {
  const payload = v1Save();
  const look = {
    schema: LOOK_SCHEMA,
    cls: "mage" as const,
    skin: "#96795d",
    hairStyle: "long" as const,
    hairColor: "#a85a42",
    garb: "#6a5a78",
    parts: ["u_test_cap"],
  };
  record((payload.people as unknown[])[0]).look = look;
  const raw = JSON.stringify(payload);
  localStorage.setItem(SAVE_KEY, raw);

  const loaded = loadSave();

  assert.ok(loaded);
  assert.deepEqual(loaded.player.resources, { stacks: {} });
  assert.deepEqual(Object.keys(loaded.resourceNodes), []);
  assert.deepEqual(loaded.people[0]!.look, look);
  assert.equal(localStorage.getItem(SAVE_KEY), raw, "loading must not mutate the stored v1 payload");
});

test("save - v1 to v2 to v3 migration keeps a lookless person lookless", () => {
  const payload = v1Save();
  delete record((payload.people as unknown[])[0]).look;
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));

  const loaded = loadSave();

  assert.ok(loaded);
  assert.deepEqual(loaded.player.resources, { stacks: {} });
  assert.deepEqual(Object.keys(loaded.resourceNodes), []);
  assert.equal(loaded.people[0]!.look, undefined);
});

test("save - migrates prior v2 by adding only empty resourceNodes and preserving optional nested data", () => {
  const payload = v2Save();
  const futurePerson = { badge: { name: "Wayfinder", rank: 2 } };
  const futurePlayer = { journal: { pinned: ["north-oak"] } };
  record((payload.people as unknown[])[0]).futureOptional = futurePerson;
  record(payload.player).futureOptional = futurePlayer;
  const resourcesBefore = structuredClone(record(payload.player).resources);
  const raw = JSON.stringify(payload);
  localStorage.setItem(SAVE_KEY, raw);

  const loaded = loadSave();

  assert.ok(loaded);
  assert.deepEqual(loaded.player.resources, resourcesBefore);
  assert.deepEqual(Object.keys(loaded.resourceNodes), []);
  assert.deepEqual(record(loaded.people[0]).futureOptional, futurePerson);
  assert.deepEqual(record(loaded.player).futureOptional, futurePlayer);
  assert.equal(localStorage.getItem(SAVE_KEY), raw, "loading must not rewrite the stored v2 payload");
});

test("save - rejects malformed v1 instead of blessing it during migration", () => {
  const payload = v1Save();
  record(payload.player).pack = { log: "many" };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  assert.equal(loadSave(), null);
});

test("save - native v3 resource stacks round-trip canonically", () => {
  const world = createWorld();
  const oak = makeResourceStackKey("oak", "log", "sound");
  const ruby = makeResourceStackKey("ruby", "gem", "flawed");
  addResource(world.player.resources, oak, 7);
  addResource(world.player.resources, ruby, 2);

  writeSave(world);
  const loaded = loadSave();

  assert.ok(loaded);
  assert.deepEqual(loaded.player.resources, { stacks: { [oak]: 7, [ruby]: 2 } });
});

test("save - rejects unversioned payloads", () => {
  localStorage.setItem(SAVE_KEY, JSON.stringify(persistedWorld()));
  assert.equal(loadSave(), null);
});

test("save - rejects future schemas instead of silently resetting fields", () => {
  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify({ ...persistedWorld(), saveVersion: CURRENT_SAVE_VERSION + 1 }),
  );
  assert.equal(loadSave(), null);
});

test("save - rejects corrupt JSON", () => {
  localStorage.setItem(SAVE_KEY, "{not valid json");
  assert.equal(loadSave(), null);
});

test("save - rejects malformed payloads", () => {
  const malformedPayloads = [
    null,
    [],
    { ...persistedWorld(), saveVersion: "1" },
    { ...persistedWorld(), seed: "not-a-number", saveVersion: CURRENT_SAVE_VERSION },
    { ...persistedWorld(), player: null, saveVersion: CURRENT_SAVE_VERSION },
    { ...persistedWorld(), people: {}, saveVersion: CURRENT_SAVE_VERSION },
  ];

  for (const payload of malformedPayloads) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    assert.equal(loadSave(), null);
  }
});

test("save - rejects current-version saves missing required World fields", () => {
  const requiredFields = [
    "seed",
    "hour",
    "speed",
    "gold",
    "prestige",
    "tiles",
    "people",
    "fauna",
    "piles",
    "campfires",
    "buildings",
    "plots",
    "player",
    "log",
    "objectives",
    "quests",
    "rep",
    "resourceNodes",
    "scars",
    "seen",
    "seenRev",
    "landRev",
    "tickCount",
    "restored",
    "weather",
    "boom",
    "nightOffer",
  ] as const;

  for (const field of requiredFields) {
    const payload = currentSave();
    delete payload[field];
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    assert.equal(loadSave(), null, `accepted save missing ${field}`);
  }
});

test("save - requires resources on native v3 players", () => {
  const payload = currentSave();
  delete record(payload.player).resources;
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  assert.equal(loadSave(), null);
});

test("save - malformed canonical runtime resources do not overwrite existing storage", () => {
  const world = createWorld();
  const sentinel = "existing-save-must-survive";
  localStorage.setItem(SAVE_KEY, sentinel);
  delete (world.player as unknown as { resources?: unknown }).resources;

  writeSave(world);

  assert.equal(localStorage.getItem(SAVE_KEY), sentinel);
});

test("save - malformed runtime resourceNodes do not invoke accessors or overwrite existing storage", () => {
  const sentinel = "existing-save-must-survive-resource-node-errors";
  let getterCalls = 0;
  const world = createWorld();
  const node = { seed: world.seed, tx: 188, ty: 88, nodeKind: "tree" } as const;
  const id = resolveResourceNode(node).identity.nodeId;
  const valid = {
    nodeId: id,
    tx: node.tx,
    ty: node.ty,
    nodeKind: node.nodeKind,
    discoveredAtHour: 1,
    depletedAtHour: null,
  };
  const accessorMap = {};
  Object.defineProperty(accessorMap, id, {
    enumerable: true,
    get() {
      getterCalls += 1;
      return valid;
    },
  });
  const malformedMaps = [
    { [id]: { ...valid, extra: "not schema" } },
    Object.assign(Object.create({ inherited: valid }), { [id]: valid }),
    accessorMap,
  ];

  for (const resourceNodes of malformedMaps) {
    localStorage.setItem(SAVE_KEY, sentinel);
    world.resourceNodes = resourceNodes as never;
    writeSave(world);
    assert.equal(localStorage.getItem(SAVE_KEY), sentinel);
  }
  assert.equal(getterCalls, 0);
});

test("save - rejects native v3 resources with unknown own fields without rewriting storage", () => {
  const payload = currentSave();
  record(payload.player).resources = { stacks: {}, extra: { smuggled: true } };
  const raw = JSON.stringify(payload);
  localStorage.setItem(SAVE_KEY, raw);

  assert.equal(loadSave(), null);
  assert.equal(localStorage.getItem(SAVE_KEY), raw);
});

test("save - rejects malformed, impossible, and non-positive v3 resource stacks", () => {
  const invalidStacks: Array<Record<string, unknown>> = [
    { "ruby:log:rough": 1 },
    { "oak:gem:flawless": 1 },
    { "oak:log:flawless": 1 },
    { "bogwood:log:sound": 1 },
    { "__proto__:log:sound": 1 },
    { "oak:log:sound": 0 },
    { "oak:log:sound": -1 },
    { "oak:log:sound": 1.5 },
    { "oak:log:sound": "2" },
    { "oak:log:sound": "NaN" },
    { "oak:log:sound": null },
    { "oak:log:sound": Number.MAX_SAFE_INTEGER + 1 },
  ];

  for (const stacks of invalidStacks) {
    const payload = currentSave();
    record(payload.player).resources = { stacks };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    assert.equal(loadSave(), null, `accepted resource stacks ${JSON.stringify(stacks)}`);
  }

  const missingOwnStacks = currentSave();
  record(missingOwnStacks.player).resources = {};
  localStorage.setItem(SAVE_KEY, JSON.stringify(missingOwnStacks));
  assert.equal(loadSave(), null);
});

test("save - native v3 rejects malformed, noncanonical, and temporally impossible resourceNodes", () => {
  const payload = currentSave();
  const seed = payload.seed as number;
  const node = { seed, tx: 188, ty: 88, nodeKind: "tree" } as const;
  const id = resolveResourceNode(node).identity.nodeId;
  const valid = {
    nodeId: id,
    tx: node.tx,
    ty: node.ty,
    nodeKind: node.nodeKind,
    discoveredAtHour: 4,
    depletedAtHour: 7,
  };
  const malformed: Array<unknown> = [
    null,
    [],
    { wrongKey: valid },
    { [id]: { ...valid, nodeId: "wrongKey" } },
    { [id]: { ...valid, tx: node.tx + 1 } },
    { [id]: { ...valid, tx: -1 } },
    { [id]: { ...valid, ty: 512 } },
    { [id]: { ...valid, nodeKind: "ore" } },
    { [id]: { ...valid, discoveredAtHour: -1 } },
    { [id]: { ...valid, discoveredAtHour: null } },
    { [id]: { ...valid, depletedAtHour: 3 } },
    { [id]: { ...valid, extra: true } },
  ];

  for (const resourceNodes of malformed) {
    const candidate = currentSave();
    candidate.resourceNodes = resourceNodes;
    localStorage.setItem(SAVE_KEY, JSON.stringify(candidate));
    assert.equal(loadSave(), null, `accepted resourceNodes ${JSON.stringify(resourceNodes)}`);
  }
});

test("save - native v3 rejects future resource discovery and depletion separately", () => {
  const payload = currentSave();
  const seed = payload.seed as number;
  const node = { seed, tx: 188, ty: 88, nodeKind: "tree" } as const;
  const id = resolveResourceNode(node).identity.nodeId;
  payload.hour = 10;
  const recordAt = (discoveredAtHour: number, depletedAtHour: number | null) => ({
    [id]: {
      nodeId: id,
      tx: node.tx,
      ty: node.ty,
      nodeKind: node.nodeKind,
      discoveredAtHour,
      depletedAtHour,
    },
  });

  for (const resourceNodes of [recordAt(11, null), recordAt(4, 11)]) {
    payload.resourceNodes = resourceNodes;
    const raw = JSON.stringify(payload);
    localStorage.setItem(SAVE_KEY, raw);
    assert.equal(loadSave(), null);
    assert.equal(localStorage.getItem(SAVE_KEY), raw);
  }
});

test("save - future runtime resource timestamps never overwrite existing storage", () => {
  const sentinel = "existing-save-must-survive-future-resource-time";
  const world = createWorld();
  const node = { seed: world.seed, tx: 188, ty: 88, nodeKind: "tree" } as const;
  const id = resolveResourceNode(node).identity.nodeId;
  world.hour = 10;

  for (const state of [
    { discoveredAtHour: 11, depletedAtHour: null },
    { discoveredAtHour: 4, depletedAtHour: 11 },
  ] as const) {
    world.resourceNodes = {
      [id]: {
        nodeId: id,
        tx: node.tx,
        ty: node.ty,
        nodeKind: node.nodeKind,
        ...state,
      },
    };
    localStorage.setItem(SAVE_KEY, sentinel);
    writeSave(world);
    assert.equal(localStorage.getItem(SAVE_KEY), sentinel);
  }
});

test("save - load order applies scars before regrowth and leaves v2 dirt scars permanent", () => {
  const legacy = v2Save();
  legacy.hour = 10_000;
  legacy.scars = { "188,88": { kind: "dirt" } };
  localStorage.setItem(SAVE_KEY, JSON.stringify(legacy));
  const legacyLoaded = loadSave();
  assert.ok(legacyLoaded);
  assert.equal(legacyLoaded.tiles[88]![188]!.kind, "dirt");
  assert.deepEqual(Object.keys(legacyLoaded.resourceNodes), []);
  assert.deepEqual(legacyLoaded.scars["188,88"], { kind: "dirt" });

  const current = currentSave();
  const seed = current.seed as number;
  const node = { seed, tx: 188, ty: 88, nodeKind: "tree" } as const;
  current.hour = 72;
  current.scars = { "188,88": { kind: "dirt" } };
  current.resourceNodes = depleteResourceNode({ ...node, hour: 0, resourceNodes: {} });
  localStorage.setItem(SAVE_KEY, JSON.stringify(current));
  const regrown = loadSave();
  assert.ok(regrown);
  assert.equal(regrown.tiles[node.ty]![node.tx]!.kind, "tree");
  assert.equal(Object.hasOwn(regrown.scars, `${node.tx},${node.ty}`), false);
  assert.equal(regrown.resourceNodes[resolveResourceNode(node).identity.nodeId]?.depletedAtHour, null);
});

test("save - rejects malformed elements in critical nested collections", () => {
  const malformedCollections: [string, (payload: Record<string, unknown>) => void][] = [
    ["people", (payload) => (payload.people = [null])],
    [
      "people fields",
      (payload) => {
        const people = payload.people as unknown[];
        record(people[0]).path = [null];
      },
    ],
    ["buildings", (payload) => (payload.buildings = [{ id: 1 }])],
    ["fauna", (payload) => (payload.fauna = [null])],
    ["piles", (payload) => (payload.piles = [{ id: "pile", items: null }])],
    ["campfires", (payload) => (payload.campfires = [{ id: "fire", tx: "8", ty: 9, until: 14 }])],
    [
      "plots",
      (payload) => (payload.plots = [{ id: "plot", tx: 1, ty: 2, crop: null, plantedHour: 3 }]),
    ],
    ["objectives", (payload) => (payload.objectives = [{ id: "goal", text: "Goal", done: "no" }])],
    ["log", (payload) => (payload.log = [{ t: "now", text: "Entry" }])],
    ["marks container", (payload) => (record(payload.player).marks = "bad")],
    [
      "marks elements",
      (payload) => (record(payload.player).marks = [{ id: "mark", tx: 1, ty: 2 }]),
    ],
    [
      "rares elements",
      (payload) =>
        (record(payload.player).rares = [
          { uid: "rare", base: "sword", affixes: [1], seed: 1, hour: 2 },
        ]),
    ],
  ];

  for (const [label, mutate] of malformedCollections) {
    const payload = structuredClone(currentSave());
    mutate(payload);
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    assert.equal(loadSave(), null, `accepted malformed ${label}`);
  }
});

test("save - rejects malformed player core fields and containers", () => {
  const malformedPlayer: [string, (player: Record<string, unknown>) => void][] = [
    ["id", (player) => (player.id = 7)],
    ["skills", (player) => (player.skills = [])],
    ["pack values", (player) => (record(player.pack).log = "four")],
    ["wear", (player) => (player.wear = null)],
    ["intent", (player) => (player.intent = { kind: "none" })],
    ["mana", (player) => (player.mana = "full")],
    ["corpseAt", (player) => (player.corpseAt = { tx: 1 })],
  ];

  for (const [label, mutate] of malformedPlayer) {
    const payload = structuredClone(currentSave());
    mutate(record(payload.player));
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    assert.equal(loadSave(), null, `accepted malformed player ${label}`);
  }
});

test("save - rejects values outside every persisted closed domain", () => {
  const invalidDomains: [string, (payload: Record<string, unknown>) => void][] = [
    ["speed", (payload) => (payload.speed = 4)],
    ["intent kind", (payload) => (record(record(payload.player).intent).kind = "dance")],
    ["intent spell", (payload) => (record(record(payload.player).intent).spell = "blink")],
    ["armed spell", (payload) => (record(payload.player).armedSpell = "blink")],
    ["notoriety", (payload) => (record(payload.player).notoriety = "famous")],
    ["skill id", (payload) => (record(record(payload.player).skills).alchemy2 = 1)],
    ["last-gain skill id", (payload) => (record(record(payload.player).lastGain).alchemy2 = 1)],
    ["pack item id", (payload) => (record(record(payload.player).pack).laser = 1)],
    ["chest item id", (payload) => (record(record(payload.player).chest).laser = 1)],
    ["wear slot", (payload) => (record(record(payload.player).wear).cape2 = "cloak")],
    ["wear item id", (payload) => (record(record(payload.player).wear).main = "laser")],
    ["rare wear slot", (payload) => (record(record(payload.player).wearRare).cape2 = "rare")],
    [
      "rare base",
      (payload) =>
        (record(payload.player).rares = [
          { uid: "rare", base: "laser", affixes: [], seed: 1, hour: 2 },
        ]),
    ],
    ["person class", (payload) => (record((payload.people as unknown[])[0]).cls = "bard")],
    ["person role", (payload) => (record((payload.people as unknown[])[0]).role = "mayor")],
    ["person vocation", (payload) => (record((payload.people as unknown[])[0]).vocation = "smith")],
    [
      "creature kind",
      (payload) => {
        payload.fauna = [hareFixture()];
        record((payload.fauna as unknown[])[0]).kind = "dragon";
      },
    ],
    [
      "creature task",
      (payload) => {
        payload.fauna = [hareFixture()];
        record((payload.fauna as unknown[])[0]).task = "dance";
      },
    ],
    ["building kind", (payload) => (record((payload.buildings as unknown[])[0]).kind = "castle")],
    [
      "crop",
      (payload) =>
        (payload.plots = [{ id: "plot", tx: 1, ty: 2, crop: "potato", plantedHour: 3, stage: 0 }]),
    ],
    [
      "crop stage",
      (payload) =>
        (payload.plots = [{ id: "plot", tx: 1, ty: 2, crop: "wheat", plantedHour: 3, stage: 4 }]),
    ],
    ["weather kind", (payload) => (record(payload.weather).kind = "hail")],
    ["scar tile kind", (payload) => (payload.scars = { "1,1": { kind: "lava" } })],
    ["stored tile kind", (payload) => (payload.tiles = [[{ h: 0, kind: "lava" }]])],
    [
      "pile item id",
      (payload) =>
        (payload.piles = [
          {
            id: "pile",
            tx: 1,
            ty: 2,
            items: { laser: 1 },
            gold: 0,
            until: 3,
            source: "drop",
            label: "Pile",
          },
        ]),
    ],
    [
      "pile source",
      (payload) =>
        (payload.piles = [
          { id: "pile", tx: 1, ty: 2, items: {}, gold: 0, until: 3, source: "gift", label: "Pile" },
        ]),
    ],
  ];

  for (const [label, mutate] of invalidDomains) {
    const payload = structuredClone(currentSave());
    mutate(payload);
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    assert.equal(loadSave(), null, `accepted invalid ${label}`);
  }
});
