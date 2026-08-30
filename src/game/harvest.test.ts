import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { commandChop, commandMine, tickPlayer, you } from "./player.ts";
import { loadSave, writeSave } from "./save.ts";
import type { TileKind, World } from "./types.ts";
import { createPerson, createStubWorld } from "./world.ts";

const originalRandom = Math.random;
const originalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

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

function withRandom<T>(value: number, fn: () => T): T {
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

function withMemoryStorage<T>(fn: () => T): T {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
  try {
    return fn();
  } finally {
    if (originalStorageDescriptor) {
      Object.defineProperty(globalThis, "localStorage", originalStorageDescriptor);
    } else {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  }
}

const worldFixture = (() => {
  const world = createStubWorld();
  const player = createPerson(world, () => 0.5, {
    x: 40,
    z: 40,
    cls: "ranger",
    member: true,
    isPlayer: true,
  });
  world.player.id = player.id;
  world.people.push(player);
  return world;
})();

function harvestWorld(kind: TileKind): { world: World; tx: number; ty: number } {
  const world = structuredClone(worldFixture);
  const player = you(world)!;
  const tx = 41;
  const ty = 40;

  player.x = tx - 1;
  player.z = ty;
  player.path = [];
  world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
  world.player.workT = 0;
  world.player.skills.lumberjack = 100;
  world.player.skills.mining = 100;
  world.player.pack.log = 0;
  world.player.pack.ore = 0;

  for (let y = ty - 2; y <= ty + 2; y++) {
    for (let x = tx - 2; x <= tx + 2; x++) {
      world.tiles[y]![x] = { h: 1, kind: "grass" };
    }
  }
  world.tiles[ty]![tx]!.kind = kind;

  return { world, tx, ty };
}

function arrive(world: World) {
  you(world)!.path = [];
}

function harvestState(world: World) {
  return {
    pack: structuredClone(world.player.pack),
    tiles: JSON.stringify(world.tiles),
    scars: structuredClone(world.scars),
    landRev: world.landRev,
  };
}

afterEach(() => {
  Math.random = originalRandom;
  if (originalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalStorageDescriptor);
  } else {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});

test("harvest - an adjacent tree yields exactly one generic log", () => {
  const { world, tx, ty } = harvestWorld("tree");
  const packBefore = structuredClone(world.player.pack);

  assert.equal(commandChop(world, tx, ty), null);
  arrive(world);
  withRandom(0, () => tickPlayer(world, 0.6));

  assert.deepEqual(world.player.pack, { ...packBefore, log: packBefore.log + 1 });
});

test("harvest - an adjacent rock yields exactly one generic ore", () => {
  const { world, tx, ty } = harvestWorld("rock");
  world.player.wear.main = "pick";
  const packBefore = structuredClone(world.player.pack);

  assert.equal(commandMine(world, tx, ty), null);
  arrive(world);
  withRandom(0, () => tickPlayer(world, 0.6));

  assert.deepEqual(world.player.pack, { ...packBefore, ore: packBefore.ore + 1 });
});

test("harvest - a failed skill roll changes no terrain or inventory state", () => {
  const { world, tx, ty } = harvestWorld("tree");
  world.player.skills.lumberjack = 0;
  const tileBefore = structuredClone(world.tiles[ty]![tx]!);
  const scarsBefore = structuredClone(world.scars);
  const landRevBefore = world.landRev;
  const packBefore = structuredClone(world.player.pack);

  assert.equal(commandChop(world, tx, ty), null);
  arrive(world);
  withRandom(0.99, () => tickPlayer(world, 0.6));

  assert.deepEqual(world.tiles[ty]![tx], tileBefore);
  assert.deepEqual(world.scars, scarsBefore);
  assert.equal(world.landRev, landRevBefore);
  assert.deepEqual(world.player.pack, packBefore);
});

test("harvest - invalid or missing targets clear intent without yielding", () => {
  const invalid = harvestWorld("grass");
  const invalidBefore = harvestState(invalid.world);
  assert.equal(commandChop(invalid.world, invalid.tx, invalid.ty), null);
  arrive(invalid.world);
  withRandom(0, () => tickPlayer(invalid.world, 0.6));
  assert.equal(invalid.world.player.intent.kind, "none");
  assert.deepEqual(harvestState(invalid.world), invalidBefore);

  const missing = harvestWorld("grass");
  missing.world.player.wear.main = "pick";
  const missingBefore = harvestState(missing.world);
  assert.equal(commandMine(missing.world, -1, -1), null);
  arrive(missing.world);
  withRandom(0, () => tickPlayer(missing.world, 0.6));
  assert.equal(missing.world.player.intent.kind, "none");
  assert.deepEqual(harvestState(missing.world), missingBefore);
});

test("harvest - successful depletion scars once and later ticks do not duplicate it", () => {
  const { world, tx, ty } = harvestWorld("tree");
  const landRevBefore = world.landRev;

  assert.equal(commandChop(world, tx, ty), null);
  arrive(world);
  withRandom(0, () => tickPlayer(world, 0.6));

  assert.equal(world.tiles[ty]![tx]!.kind, "dirt");
  assert.deepEqual(world.scars, { [`${tx},${ty}`]: { kind: "dirt" } });
  assert.equal(world.landRev, landRevBefore + 1);
  assert.equal(world.player.pack.log, 1);

  withRandom(0, () => tickPlayer(world, 2));
  assert.deepEqual(world.scars, { [`${tx},${ty}`]: { kind: "dirt" } });
  assert.equal(world.landRev, landRevBefore + 1);
  assert.equal(world.player.pack.log, 1);
});

test("harvest - save reload preserves the depletion scar and generic result", () => {
  withMemoryStorage(() => {
    const { world, tx, ty } = harvestWorld("rock");
    world.player.wear.main = "pick";

    assert.equal(commandMine(world, tx, ty), null);
    arrive(world);
    withRandom(0, () => tickPlayer(world, 0.6));
    writeSave(world);

    const loaded = loadSave();
    assert.ok(loaded);
    assert.equal(loaded.tiles[ty]![tx]!.kind, "dirt");
    assert.deepEqual(loaded.scars[`${tx},${ty}`], { kind: "dirt" });
    assert.equal(loaded.player.pack.ore, 1);
  });
});
