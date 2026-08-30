import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { CURRENT_SAVE_VERSION, SAVE_KEY, clearSave, hasSave, loadSave, writeSave } from "./save.ts";
import { createWorld } from "./world.ts";

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
  assert.equal(stored.saveVersion, CURRENT_SAVE_VERSION);
  assert.equal(stored.tiles, null);
  assert.equal(stored.seed, world.seed);

  clearSave();
  assert.equal(hasSave(), false);
});

test("save - current-version write and load round-trip preserves representative state", () => {
  const world = createWorld();
  world.gold = 321;
  world.weather.wet = 0.75;
  world.player.pack.log = 4;
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
  assert.deepEqual(loaded.player.marks, world.player.marks);
  assert.deepEqual(loaded.player.rares, world.player.rares);
  assert.deepEqual(loaded.campfires, world.campfires);
  assert.equal(loaded.restored, true);
  assert.ok(Array.isArray(loaded.tiles));
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
