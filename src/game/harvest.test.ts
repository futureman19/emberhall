import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { verbsFor } from "./context.ts";
import { makeResourceStackKey, resourceCount } from "./inventory/resources.ts";
import { setWorld } from "./live.ts";
import { commandChop, commandMine, tickPlayer, you } from "./player.ts";
import { resolveResourceNode } from "./resources/nodes.ts";
import { loadSave, writeSave } from "./save.ts";
import { useGame } from "./store.ts";
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

function withForbiddenRandom<T>(fn: () => T): T {
  Math.random = () => {
    throw new Error("harvest gate must not invoke random");
  };
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

function harvestWorld(
  kind: TileKind,
  seed = 1,
  tx = 41,
  ty = 40,
): { world: World; tx: number; ty: number } {
  const world = structuredClone(worldFixture);
  const player = you(world)!;

  world.seed = seed;
  player.x = tx - 1;
  player.z = ty;
  player.path = [];
  world.player.intent = { kind: "none", tx: 0, ty: 0, targetId: null, spell: null };
  world.player.workT = 0;
  world.player.skills.lumberjack = 75;
  world.player.skills.mining = 75;
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

function redwoodWorld() {
  const tx = 360;
  const ty = 460;
  for (let seed = 0; seed < 20_000; seed += 1) {
    const identity = resolveResourceNode({ seed, tx, ty, nodeKind: "tree" }).identity;
    if (identity.resourceId === "redwood" && identity.qualityCeiling === "pristine") {
      return harvestWorld("tree", seed, tx, ty);
    }
  }
  throw new Error("no deterministic pristine redwood fixture");
}

function arrive(world: World) {
  you(world)!.path = [];
}

function harvestState(world: World) {
  return {
    pack: structuredClone(world.player.pack),
    resources: structuredClone(world.player.resources),
    resourceNodes: structuredClone(world.resourceNodes),
    tiles: JSON.stringify(world.tiles),
    scars: structuredClone(world.scars),
    landRev: world.landRev,
    skills: structuredClone(world.player.skills),
    lastGain: structuredClone(world.player.lastGain),
    objectives: structuredClone(world.objectives),
    log: structuredClone(world.log),
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

test("harvest - an adjacent tree yields exactly one canonical typed log", () => {
  const { world, tx, ty } = harvestWorld("tree");
  const packBefore = structuredClone(world.player.pack);

  assert.equal(commandChop(world, tx, ty), null);
  arrive(world);
  withRandom(0, () => tickPlayer(world, 0.6));

  const packAfter = world.player.pack;
  assert.ok((packAfter.acorn ?? 0) === packBefore.acorn || (packAfter.acorn ?? 0) === packBefore.acorn + 1);
  for (const id of Object.keys(packBefore) as (keyof typeof packBefore)[]) {
    if (id === "acorn") continue;
    assert.equal(packAfter[id], packBefore[id]);
  }
  assert.equal(
    resourceCount(world.player.resources, makeResourceStackKey("oak", "log", "rough")),
    1,
  );
});

test("harvest - an adjacent rock yields exactly one canonical typed ore", () => {
  const { world, tx, ty } = harvestWorld("rock");
  world.player.wear.main = "pick";
  const packBefore = structuredClone(world.player.pack);

  assert.equal(commandMine(world, tx, ty), null);
  arrive(world);
  withRandom(0, () => tickPlayer(world, 0.6));

  assert.deepEqual(world.player.pack, packBefore);
  assert.equal(
    resourceCount(world.player.resources, makeResourceStackKey("iron_ore", "ore", "rough")),
    1,
  );
});

test("harvest - a failed skill roll changes no terrain or inventory state", () => {
  const { world, tx, ty } = harvestWorld("tree");
  world.player.skills.lumberjack = 0;
  const tileBefore = structuredClone(world.tiles[ty]![tx]!);
  const scarsBefore = structuredClone(world.scars);
  const landRevBefore = world.landRev;
  const packBefore = structuredClone(world.player.pack);
  const resourcesBefore = structuredClone(world.player.resources);

  assert.equal(commandChop(world, tx, ty), null);
  arrive(world);
  withRandom(0.99, () => tickPlayer(world, 0.6));

  assert.deepEqual(world.tiles[ty]![tx], tileBefore);
  assert.deepEqual(world.scars, scarsBefore);
  assert.equal(world.landRev, landRevBefore);
  assert.deepEqual(world.player.pack, packBefore);
  assert.deepEqual(world.player.resources, resourcesBefore);
  const id = resolveResourceNode({ seed: world.seed, tx, ty, nodeKind: "tree" }).identity.nodeId;
  assert.equal(world.resourceNodes[id]?.discoveredAtHour, world.hour);
  assert.equal(world.resourceNodes[id]?.depletedAtHour, null);
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
  assert.equal(world.player.pack.log, 0);
  assert.equal(
    resourceCount(world.player.resources, makeResourceStackKey("oak", "log", "rough")),
    1,
  );
  const id = resolveResourceNode({ seed: world.seed, tx, ty, nodeKind: "tree" }).identity.nodeId;
  assert.equal(world.resourceNodes[id]?.discoveredAtHour, world.hour);
  assert.equal(world.resourceNodes[id]?.depletedAtHour, world.hour);

  withRandom(0, () => tickPlayer(world, 2));
  assert.deepEqual(world.scars, { [`${tx},${ty}`]: { kind: "dirt" } });
  assert.equal(world.landRev, landRevBefore + 1);
  assert.equal(world.player.pack.log, 0);
  assert.equal(
    resourceCount(world.player.resources, makeResourceStackKey("oak", "log", "rough")),
    1,
  );
});

test("harvest - save reload preserves the depletion scar and typed result", () => {
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
    assert.equal(loaded.player.pack.ore, 0);
    assert.equal(
      resourceCount(loaded.player.resources, makeResourceStackKey("iron_ore", "ore", "rough")),
      1,
    );
    const id = resolveResourceNode({ seed: world.seed, tx, ty, nodeKind: "rock" }).identity.nodeId;
    assert.deepEqual(loaded.resourceNodes[id], world.resourceNodes[id]);
    assert.equal(loaded.resourceNodes[id]?.depletedAtHour, world.hour);
  });
});

test("harvest - unknown and identified gate rejects disclose exactly the allowed node detail", () => {
  const unknown = redwoodWorld();
  unknown.world.player.skills.lumberjack = 34;
  assert.equal(commandChop(unknown.world, unknown.tx, unknown.ty), null);
  arrive(unknown.world);
  const unknownBefore = harvestState(unknown.world);
  assert.equal(
    withForbiddenRandom(() => tickPlayer(unknown.world, 0.6)),
    "You cannot identify this resource node.",
  );
  assert.equal(unknown.world.player.intent.kind, "none");
  assert.deepEqual(harvestState(unknown.world), unknownBefore);
  assert.equal(
    withForbiddenRandom(() => tickPlayer(unknown.world, 0.6)),
    null,
    "cleared rejection does not repeat",
  );
  assert.deepEqual(harvestState(unknown.world), unknownBefore);

  const identified = redwoodWorld();
  identified.world.player.skills.lumberjack = 49;
  assert.equal(commandChop(identified.world, identified.tx, identified.ty), null);
  arrive(identified.world);
  const identifiedBefore = harvestState(identified.world);
  assert.equal(
    withForbiddenRandom(() => tickPlayer(identified.world, 0.6)),
    "You identify Hardened Redwood, but need 50 Lumberjacking to extract it.",
  );
  assert.equal(identified.world.player.intent.kind, "none");
  const identifiedId = resolveResourceNode({
    seed: identified.world.seed,
    tx: identified.tx,
    ty: identified.ty,
    nodeKind: "tree",
  }).identity.nodeId;
  const identifiedAfter = harvestState(identified.world);
  assert.deepEqual({ ...identifiedAfter, resourceNodes: identifiedBefore.resourceNodes }, identifiedBefore);
  assert.equal(identified.world.resourceNodes[identifiedId]?.discoveredAtHour, identified.world.hour);
  assert.equal(identified.world.resourceNodes[identifiedId]?.depletedAtHour, null);

  const wrongTool = redwoodWorld();
  wrongTool.world.player.skills.lumberjack = 50;
  wrongTool.world.player.wear.main = "knife";
  assert.equal(commandChop(wrongTool.world, wrongTool.tx, wrongTool.ty), null);
  arrive(wrongTool.world);
  const wrongToolBefore = harvestState(wrongTool.world);
  assert.equal(
    withForbiddenRandom(() => tickPlayer(wrongTool.world, 0.6)),
    "You identify Hardened Redwood, but need a tier 2 tool to extract it.",
  );
  assert.equal(wrongTool.world.player.intent.kind, "none");
  const wrongToolId = resolveResourceNode({
    seed: wrongTool.world.seed,
    tx: wrongTool.tx,
    ty: wrongTool.ty,
    nodeKind: "tree",
  }).identity.nodeId;
  const wrongToolAfter = harvestState(wrongTool.world);
  assert.deepEqual({ ...wrongToolAfter, resourceNodes: wrongToolBefore.resourceNodes }, wrongToolBefore);
  assert.equal(wrongTool.world.resourceNodes[wrongToolId]?.discoveredAtHour, wrongTool.world.hour);
  assert.equal(wrongTool.world.resourceNodes[wrongToolId]?.depletedAtHour, null);
});

test("harvest - typed inventory guard errors leave the complete node and player state unchanged", () => {
  const overflow = harvestWorld("tree");
  const key = makeResourceStackKey("oak", "log", "rough");
  overflow.world.player.resources.stacks[key] = Number.MAX_SAFE_INTEGER;
  overflow.world.player.skills.lumberjack = 100;
  assert.equal(commandChop(overflow.world, overflow.tx, overflow.ty), null);
  arrive(overflow.world);
  const overflowBefore = structuredClone(overflow.world);
  const overflowPersonBefore = structuredClone(you(overflow.world));
  assert.throws(
    () => withForbiddenRandom(() => tickPlayer(overflow.world, 0.6)),
    /resource stack count exceeds safe integer range/,
  );
  assert.deepEqual(overflow.world, overflowBefore);
  assert.deepEqual(you(overflow.world), overflowPersonBefore);
  assert.equal(overflow.world.player.workT, 0);
  assert.equal(you(overflow.world)!.facing, overflowPersonBefore!.facing);

  const unrelated = harvestWorld("tree");
  unrelated.world.player.skills.lumberjack = 100;
  (unrelated.world.player.resources.stacks as Record<string, number>)["ruby:log:rough"] = 1;
  assert.equal(commandChop(unrelated.world, unrelated.tx, unrelated.ty), null);
  arrive(unrelated.world);
  const unrelatedBefore = structuredClone(unrelated.world);
  const unrelatedPersonBefore = structuredClone(you(unrelated.world));
  assert.throws(
    () => withForbiddenRandom(() => tickPlayer(unrelated.world, 0.6)),
    /form log is incompatible with resource ruby/,
  );
  // The complete world snapshot covers the full tiles, resources, scars, log,
  // objectives, player skills/intent/work timer, and every Person field.
  assert.deepEqual(unrelated.world, unrelatedBefore);
  assert.deepEqual(you(unrelated.world), unrelatedPersonBefore);
  assert.equal(unrelated.world.player.workT, 0);
  assert.equal(you(unrelated.world)!.facing, unrelatedPersonBefore!.facing);
});

test("harvest - context discovery persists once and later reveals the same identity below skill", () => {
  const { world, tx, ty } = redwoodWorld();
  world.hour = 12;
  world.player.skills.lumberjack = 34;
  setWorld(world);
  assert.equal(
    verbsFor({ kind: "tile", id: `${tx},${ty}`, tx, ty, label: "tree" }).find(
      ({ verb }) => verb === "chop",
    )?.label,
    "Chop",
  );
  assert.deepEqual(world.resourceNodes, {});
  world.player.skills.lumberjack = 35;
  assert.equal(
    verbsFor({ kind: "tile", id: `${tx},${ty}`, tx, ty, label: "tree" }).find(
      ({ verb }) => verb === "chop",
    )?.label,
    "Chop Hardened Redwood",
  );
  const id = resolveResourceNode({ seed: world.seed, tx, ty, nodeKind: "tree" }).identity.nodeId;
  assert.deepEqual(world.resourceNodes[id], {
    nodeId: id,
    tx,
    ty,
    nodeKind: "tree",
    discoveredAtHour: 12,
    depletedAtHour: null,
  });
  world.hour = 19;
  world.player.skills.lumberjack = 0;
  assert.equal(
    verbsFor({ kind: "tile", id: `${tx},${ty}`, tx, ty, label: "tree" }).find(
      ({ verb }) => verb === "chop",
    )?.label,
    "Chop Hardened Redwood",
  );
  assert.equal(world.resourceNodes[id]?.discoveredAtHour, 12);
  assert.equal(Object.keys(world.resourceNodes).length, 1);
});

test("harvest - exact journal result is bridged unchanged to the toast", () => {
  const { world, tx, ty } = harvestWorld("tree");
  world.player.skills.lumberjack = 100;
  world.speed = 3;
  world.log = [];
  setWorld(world);
  world.tiles[ty]![tx]!.kind = "tree";
  useGame.setState({ toast: null });
  assert.equal(commandChop(world, tx, ty), null);
  arrive(world);
  withRandom(0, () => {
    useGame.getState().tick(0.2);
    useGame.getState().tick(0.2);
  });
  const exact = "Recovered 2 rough oak logs.";
  assert.equal(world.log[0]?.text, exact);
  assert.equal(world.log.filter(({ text }) => text === exact).length, 1);
  assert.equal(useGame.getState().toast, exact);
  useGame.getState().tick(0.01);
  assert.equal(world.log.filter(({ text }) => text === exact).length, 1);
  assert.equal(useGame.getState().toast, exact);
});

test("harvest - pre-impact animation frames do not scan or clone sparse node state", () => {
  const { world, tx, ty } = harvestWorld("tree");
  const id = resolveResourceNode({ seed: world.seed, tx, ty, nodeKind: "tree" }).identity.nodeId;
  const state = {
    [id]: Object.freeze({
      nodeId: id,
      tx,
      ty,
      nodeKind: "tree" as const,
      discoveredAtHour: 0,
      depletedAtHour: null,
    }),
  };
  let ownKeyReads = 0;
  world.resourceNodes = new Proxy(state, {
    ownKeys(target) {
      ownKeyReads += 1;
      return Reflect.ownKeys(target);
    },
  });
  world.player.skills.lumberjack = 100;
  assert.equal(commandChop(world, tx, ty), null);
  arrive(world);

  for (let frame = 0; frame < 100; frame += 1) tickPlayer(world, 0.001);

  assert.ok(Math.abs(world.player.workT - 0.1) < Number.EPSILON);
  assert.equal(ownKeyReads, 0, "frames before the work beat must not traverse persistent node state");
  withRandom(0, () => tickPlayer(world, 0.43));
  assert.ok(ownKeyReads > 0, "the impact frame still validates the untrusted state boundary");
});
