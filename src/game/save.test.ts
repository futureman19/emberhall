import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { CURRENT_SAVE_VERSION, SAVE_KEY, clearSave, hasSave, loadSave, writeSave } from "./save.ts";
import { createWorld } from "./world.ts";
import { addResource, makeResourceStackKey } from "./inventory/resources.ts";
import { LOOK_SCHEMA } from "./look/types.ts";

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

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
});

afterEach(() => {
  if (originalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalStorageDescriptor);
  } else {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
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
  return { ...save, saveVersion: 1 };
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
  assert.equal(CURRENT_SAVE_VERSION, 2);
  assert.equal(stored.saveVersion, 2);
  assert.equal(stored.tiles, null);
  assert.equal(stored.seed, world.seed);
  assert.deepEqual(stored.player.resources, { stacks: {} });

  clearSave();
  assert.equal(hasSave(), false);
});

test("save - current-version write and load round-trip preserves representative state", () => {
  const world = createWorld();
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

  writeSave(world);
  const loaded = loadSave();

  assert.ok(loaded);
  assert.equal(loaded.gold, 321);
  assert.equal(loaded.weather.wet, 0.75);
  assert.equal(loaded.player.pack.log, 4);
  assert.deepEqual(loaded.player.resources, world.player.resources);
  assert.deepEqual(loaded.player.marks, world.player.marks);
  assert.deepEqual(loaded.player.rares, world.player.rares);
  assert.deepEqual(loaded.campfires, world.campfires);
  assert.equal(loaded.restored, true);
  assert.ok(Array.isArray(loaded.tiles));
});

test("save - migrates valid v1 to v2 without rewriting a person's look", () => {
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
  assert.deepEqual(loaded.people[0]!.look, look);
  assert.equal(localStorage.getItem(SAVE_KEY), raw, "loading must not mutate the stored v1 payload");
});

test("save - v1 migration keeps a lookless person lookless", () => {
  const payload = v1Save();
  delete record((payload.people as unknown[])[0]).look;
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));

  const loaded = loadSave();

  assert.ok(loaded);
  assert.deepEqual(loaded.player.resources, { stacks: {} });
  assert.equal(loaded.people[0]!.look, undefined);
});

test("save - rejects malformed v1 instead of blessing it during migration", () => {
  const payload = v1Save();
  record(payload.player).pack = { log: "many" };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  assert.equal(loadSave(), null);
});

test("save - native v2 resource stacks round-trip canonically", () => {
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

test("save - requires resources on native v2 players", () => {
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

test("save - rejects native v2 resources with unknown own fields without rewriting storage", () => {
  const payload = currentSave();
  record(payload.player).resources = { stacks: {}, extra: { smuggled: true } };
  const raw = JSON.stringify(payload);
  localStorage.setItem(SAVE_KEY, raw);

  assert.equal(loadSave(), null);
  assert.equal(localStorage.getItem(SAVE_KEY), raw);
});

test("save - rejects malformed, impossible, and non-positive v2 resource stacks", () => {
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
